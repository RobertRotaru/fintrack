package com.fintrack.ai;

import com.fintrack.web.ApiException;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Runs AI analyses in the background, one at a time per user and kind, so no HTTP request waits on the AI: hosts
 * like Heroku end any request after 30 seconds, and an analysis can take longer. The state lives in {@code ai_jobs},
 * so it survives across requests (and dynos); a run that hasn't finished after {@link #STALE} (say, the server
 * restarted mid-way) counts as interrupted and can be started again.
 */
@Service
public class AiJobs {
    private static final Logger log = LoggerFactory.getLogger(AiJobs.class);
    static final Duration STALE = Duration.ofMinutes(5);
    static final String INTERRUPTED = "The analysis was interrupted. Try again.";

    /** A run in progress, or the last one that failed; {@code null} from {@link #state} when there's neither. */
    public record Job(String status, String error, OffsetDateTime startedAt) {}

    private final JdbcClient db;
    private final ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();

    public AiJobs(JdbcClient db) {
        this.db = db;
    }

    public Job state(UUID user, String kind) {
        return db.sql("SELECT status, error, started_at FROM ai_jobs WHERE user_id = ? AND kind = ?")
                .params(user, kind)
                .query((rs, i) -> new Job(rs.getString("status"), rs.getString("error"), rs.getObject("started_at", OffsetDateTime.class)))
                .optional()
                .map(j -> "running".equals(j.status()) && j.startedAt().isBefore(now().minus(STALE)) ? new Job("failed", INTERRUPTED, j.startedAt()) : j)
                .orElse(null);
    }

    /**
     * Starts {@code work} unless a run is already in progress (then it's left alone: asking twice doesn't run twice).
     * The work saves its own result; when it throws, the error is kept for the app to show.
     */
    public void start(UUID user, String kind, Runnable work) {
        UUID run = UUID.randomUUID();
        int claimed = db.sql("""
                INSERT INTO ai_jobs (user_id, kind, run_id, status, error, started_at) VALUES (?, ?, ?, 'running', NULL, ?)
                ON CONFLICT (user_id, kind) DO UPDATE SET run_id = EXCLUDED.run_id, status = 'running', error = NULL, started_at = EXCLUDED.started_at
                WHERE ai_jobs.status = 'failed' OR ai_jobs.started_at < ?""")
                .params(user, kind, run, now(), now().minus(STALE))
                .update();
        if (claimed == 0) return;
        pool.execute(() -> {
            try {
                work.run();
                db.sql("DELETE FROM ai_jobs WHERE user_id = ? AND kind = ? AND run_id = ?").params(user, kind, run).update();
            } catch (RuntimeException e) {
                String message = e instanceof ApiException ? e.getMessage() : "The analysis failed. Try again.";
                if (!(e instanceof ApiException)) log.warn("AI {} analysis failed", kind, e);
                db.sql("UPDATE ai_jobs SET status = 'failed', error = ? WHERE user_id = ? AND kind = ? AND run_id = ?")
                        .params(message, user, kind, run)
                        .update();
            }
        });
    }

    static Map<String, Object> json(Job job) {
        if (job == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", job.status());
        out.put("error", job.error());
        out.put("startedAt", job.startedAt().toInstant().toString());
        return out;
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }
}
