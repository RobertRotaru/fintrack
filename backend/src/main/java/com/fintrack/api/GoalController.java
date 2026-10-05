package com.fintrack.api;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.forbidden;
import static com.fintrack.web.ApiException.notFound;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.money.Money;
import com.fintrack.reference.ReferenceData;
import com.fintrack.web.Body;
import com.fintrack.web.Body.NumRule;
import com.fintrack.web.Ids;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/goals")
public class GoalController {
    private final JdbcClient db;
    private final Visibility view;
    private final ReferenceData ref;

    public GoalController(JdbcClient db, Visibility view, ReferenceData ref) {
        this.db = db;
        this.view = view;
        this.ref = ref;
    }

    private Views.Goal find(UUID me, UUID id) {
        return view.visibleGoals(me).stream().filter(g -> g.id().equals(id)).findFirst().orElseThrow(() -> notFound("Goal not found"));
    }

    private NumRule target(String currency) {
        int d = ref.decimalsFor(currency);
        return NumRule.decimals(d).min(BigDecimal.ONE.movePointLeft(d));
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    /**
     * After savings or the target change: reaching the target completes the goal,
     * dropping back below it reopens it. A manual "mark as done" stands until the
     * next change to savings or target.
     */
    private void syncCompletion(UUID goalId) {
        record G(BigDecimal target, boolean completed, String currency) {}
        G g = db.sql("SELECT target_amount, completed_at IS NOT NULL AS completed, currency FROM goals WHERE id = ?").param(goalId)
                .query((rs, i) -> new G(rs.getBigDecimal("target_amount"), rs.getBoolean("completed"), rs.getString("currency"))).single();
        BigDecimal saved = db.sql("SELECT COALESCE(SUM(amount), 0) FROM goal_contributions WHERE goal_id = ?").param(goalId).query(BigDecimal.class).single();
        boolean reached = Money.round(saved, ref.decimalsFor(g.currency())).compareTo(g.target()) >= 0;
        if (reached && !g.completed()) db.sql("UPDATE goals SET completed_at = ? WHERE id = ?").params(now(), goalId).update();
        if (!reached && g.completed()) db.sql("UPDATE goals SET completed_at = NULL WHERE id = ?").param(goalId).update();
    }

    @GetMapping
    public List<Views.Goal> list(@AuthenticationPrincipal UUID me) {
        return view.visibleGoals(me);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Views.Goal create(@AuthenticationPrincipal UUID me, Body b) {
        // Validate everything before writing anything.
        String name = b.str("name", "Name", 60);
        String currency = b.oneOf("currency", "Currency", ref.currencyCodes());
        BigDecimal target = b.num("targetAmount", "Target", target(currency));
        LocalDate deadline = b.truthy("deadline") ? b.date("deadline", "Deadline") : null;
        String icon = b.nullish("icon") ? Body.iconNameValue("target") : b.iconName("icon");
        String color = b.nullish("color") ? Body.hexColorValue("#1d5c3d") : b.hexColor("color");
        String image = b.image("image");
        BigDecimal initial = b.nullish("initialSaved")
                ? BigDecimal.ZERO
                : b.num("initialSaved", "Already saved", NumRule.decimals(ref.decimalsFor(currency)).min(BigDecimal.ZERO));
        UUID household = null;
        if (b.truthy("shared")) {
            household = view.householdIdOf(me);
            if (household == null) throw forbidden("Join or create a family first to share goals");
        }
        UUID id = UUID.randomUUID();
        db.sql("""
                INSERT INTO goals (id, user_id, household_id, name, target_amount, currency, deadline, icon, color, image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                .params(id, me, household, name, target, currency, deadline, icon, color, image)
                .update();
        if (initial.signum() > 0) {
            db.sql("INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, 'Starting amount')")
                    .params(UUID.randomUUID(), id, me, initial, LocalDate.now())
                    .update();
        }
        syncCompletion(id);
        return find(me, id);
    }

    @PatchMapping("/{id}")
    @Transactional
    public Views.Goal update(@AuthenticationPrincipal UUID me, @PathVariable String id, Body b) {
        Views.Goal g = find(me, Ids.parse(id));
        if (!g.userId().equals(me)) throw forbidden("Only the creator can edit this goal");
        if (b.has("name")) db.sql("UPDATE goals SET name = ? WHERE id = ?").params(b.str("name", "Name", 60), g.id()).update();
        if (b.has("deadline")) db.sql("UPDATE goals SET deadline = ? WHERE id = ?").params(b.truthy("deadline") ? b.date("deadline", "Deadline") : null, g.id()).update();
        if (b.has("icon")) db.sql("UPDATE goals SET icon = ? WHERE id = ?").params(b.iconName("icon"), g.id()).update();
        if (b.has("color")) db.sql("UPDATE goals SET color = ? WHERE id = ?").params(b.hexColor("color"), g.id()).update();
        if (b.has("image")) db.sql("UPDATE goals SET image = ? WHERE id = ?").params(b.image("image"), g.id()).update();
        if (b.has("completed")) db.sql("UPDATE goals SET completed_at = ? WHERE id = ?").params(b.truthy("completed") ? now() : null, g.id()).update();
        if (b.has("targetAmount")) {
            db.sql("UPDATE goals SET target_amount = ? WHERE id = ?").params(b.num("targetAmount", "Target", target(g.currency())), g.id()).update();
            syncCompletion(g.id());
        }
        return find(me, g.id());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID me, @PathVariable String id) {
        Views.Goal g = find(me, Ids.parse(id));
        if (!g.userId().equals(me)) throw forbidden("Only the creator can delete this goal");
        db.sql("DELETE FROM goals WHERE id = ?").param(g.id()).update();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/contributions")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Views.Goal contribute(@AuthenticationPrincipal UUID me, @PathVariable String id, Body b) {
        Views.Goal g = find(me, Ids.parse(id));
        int decimals = ref.decimalsFor(g.currency());
        BigDecimal amount = b.num("amount", "Amount", NumRule.decimals(decimals));
        if (amount.signum() == 0) throw bad("Amount cannot be zero");
        if (Money.round(g.saved().add(amount), decimals).signum() < 0) {
            throw bad("You can withdraw at most " + g.saved().stripTrailingZeros().toPlainString() + " " + g.currency() + " from this goal");
        }
        LocalDate date = b.truthy("date") ? b.date("date", "Date") : LocalDate.now();
        String note = b.optStr("note", "Note", 120);
        db.sql("INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), g.id(), me, amount, date, note.isEmpty() ? null : note)
                .update();
        syncCompletion(g.id());
        return find(me, g.id());
    }

    @DeleteMapping("/{id}/contributions/{cid}")
    @Transactional
    public Views.Goal removeContribution(@AuthenticationPrincipal UUID me, @PathVariable String id, @PathVariable String cid) {
        Views.Goal g = find(me, Ids.parse(id));
        UUID contributionId = Ids.parse(cid);
        Views.Contribution c = g.contributions().stream().filter(x -> x.id().equals(contributionId)).findFirst()
                .orElseThrow(() -> notFound("Contribution not found"));
        if (!c.userId().equals(me)) throw forbidden("Only the person who added this can remove it");
        // Removing a deposit that later withdrawals relied on would leave the goal negative.
        if (g.saved().subtract(c.amount()).signum() < 0) throw bad("Remove the later withdrawals first — this would make the saved amount negative");
        db.sql("DELETE FROM goal_contributions WHERE id = ?").param(c.id()).update();
        syncCompletion(g.id());
        return find(me, g.id());
    }
}
