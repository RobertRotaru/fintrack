package com.fintrack.ai;

import com.fintrack.analytics.HabitSummary;
import com.fintrack.data.Visibility;
import com.fintrack.money.FxService;
import com.fintrack.reference.ReferenceData;
import com.fintrack.web.ApiException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final JdbcClient db;
    private final Visibility view;
    private final ReferenceData ref;
    private final FxService fx;
    private final InvestmentCoach coach;
    private final JsonMapper mapper;
    private final AiJobs jobs;

    public AiController(JdbcClient db, Visibility view, ReferenceData ref, FxService fx, InvestmentCoach coach, JsonMapper mapper, AiJobs jobs) {
        this.db = db;
        this.view = view;
        this.ref = ref;
        this.fx = fx;
        this.coach = coach;
        this.mapper = mapper;
        this.jobs = jobs;
    }

    HabitSummary.Summary summaryFor(UUID me) {
        String base = view.user(me).orElseThrow().baseCurrency();
        var txs = view.visibleTransactions(me, null, null, null).stream()
                .map(t -> new HabitSummary.Tx(t.date(), t.kind(), fx.convert(t.amount().doubleValue(), t.currency(), base), t.categoryName(), t.note()))
                .toList();
        var accounts = view.visibleAccounts(me).stream()
                .map(a -> new HabitSummary.AccountIn(a.type(), a.currency(), a.balance().doubleValue(), a.archived()))
                .toList();
        var goals = view.visibleGoals(me).stream()
                .map(g -> new HabitSummary.GoalIn(g.name(), g.targetAmount().doubleValue(), g.saved().doubleValue(), g.currency(), g.deadline(), g.completedAt() != null))
                .toList();
        return HabitSummary.compute(txs, accounts, goals, base, LocalDate.now(), ref::isDiscretionary, fx::convert);
    }

    /** The habit snapshot, the latest analysis, and the analysis in progress (or the one that just failed), if any. */
    private Map<String, Object> state(UUID me, HabitSummary.Summary summary) {
        JsonNode advice = db.sql("SELECT payload::text FROM ai_reports WHERE user_id = ? AND kind = 'investment' ORDER BY created_at DESC LIMIT 1")
                .param(me).query(String.class).optional().map(mapper::readTree).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("configured", coach.configured());
        out.put("summary", summary);
        out.put("advice", advice);
        out.put("job", AiJobs.json(jobs.state(me, "investment")));
        return out;
    }

    @GetMapping("/investment")
    public Map<String, Object> latest(@AuthenticationPrincipal UUID me) {
        return state(me, summaryFor(me));
    }

    /**
     * Starts an analysis in the background and answers at once (202) with {@code job.status = "running"}; the app polls
     * GET until the job is gone (the new advice is there) or has failed (its error says why). Asking again while one is
     * running doesn't start a second.
     */
    @PostMapping("/investment")
    public ResponseEntity<Map<String, Object>> analyse(@AuthenticationPrincipal UUID me) {
        HabitSummary.Summary summary = summaryFor(me);
        if (summary.monthsAnalyzed() < 1) {
            throw ApiException.bad("Track at least one full month of income and expenses first, so the analysis has real habits to work with.");
        }
        String summaryJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(summary);
        jobs.start(me, "investment", () -> {
            String text = coach.analyse(summaryJson);
            ObjectNode advice;
            try {
                advice = (ObjectNode) mapper.readTree(text);
            } catch (JacksonException | ClassCastException e) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI returned an unreadable analysis.");
            }
            advice.put("generatedAt", Instant.now().toString());
            db.sql("INSERT INTO ai_reports (id, user_id, kind, payload) VALUES (?, ?, 'investment', CAST(? AS jsonb))")
                    .params(UUID.randomUUID(), me, mapper.writeValueAsString(advice))
                    .update();
        });
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(state(me, summary));
    }
}
