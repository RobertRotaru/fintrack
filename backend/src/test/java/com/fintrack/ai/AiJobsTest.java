package com.fintrack.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.fintrack.Api;
import com.fintrack.PostgresTest;
import com.fintrack.config.AppProperties;
import com.fintrack.web.ApiException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;

/** The coach runs in the background: POST answers at once, GET is polled until the advice is there. */
@Import(AiJobsTest.FakeCoach.class)
class AiJobsTest extends PostgresTest {
    static volatile CountDownLatch gate = new CountDownLatch(0);
    static volatile RuntimeException failWith;
    static final AtomicInteger calls = new AtomicInteger();

    @TestConfiguration
    static class FakeCoach {
        @Bean
        @Primary
        InvestmentCoach fakeCoach(AppProperties props) {
            return new InvestmentCoach(props) {
                @Override
                public boolean configured() {
                    return true;
                }

                @Override
                public String analyse(String summaryJson) {
                    calls.incrementAndGet();
                    try {
                        gate.await(10, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    if (failWith != null) throw failWith;
                    return "{\"riskProfile\":\"moderate\",\"summary\":\"Steady.\",\"monthlyInvestable\":300}";
                }
            };
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcClient db;

    private String lastEmail;

    private String seededUser() throws Exception {
        Api api = new Api(mvc);
        String email = lastEmail = "coach-" + UUID.randomUUID() + "@test.dev";
        String token = api.post("/api/auth/register", Map.of("name", "Coach", "email", email, "password", "password123", "country", "RO"), null)
                .json().get("token").stringValue();
        assertThat(api.post("/api/demo", Map.of(), token).status()).isLessThan(300);
        return token;
    }

    private JsonNode pollUntilSettled(Api api, String token) throws Exception {
        for (int i = 0; i < 100; i++) {
            JsonNode s = api.get("/api/ai/investment", token).json();
            if (s.get("job").isNull() || "failed".equals(s.get("job").get("status").stringValue())) return s;
            Thread.sleep(50);
        }
        throw new AssertionError("the analysis never finished");
    }

    @Test
    void answersAtOnceThenTheAdviceArrivesAndAskingTwiceRunsOnce() throws Exception {
        Api api = new Api(mvc);
        String token = seededUser();
        gate = new CountDownLatch(1);
        failWith = null;
        calls.set(0);

        var started = api.post("/api/ai/investment", Map.of(), token);
        assertThat(started.status()).isEqualTo(202);
        assertThat(started.json().get("job").get("status").stringValue()).isEqualTo("running");
        assertThat(started.json().get("advice").isNull()).isTrue();
        assertThat(api.post("/api/ai/investment", Map.of(), token).json().get("job").get("status").stringValue()).isEqualTo("running");
        assertThat(api.get("/api/ai/investment", token).json().get("job").get("status").stringValue()).isEqualTo("running");

        gate.countDown();
        JsonNode done = pollUntilSettled(api, token);
        assertThat(done.get("job").isNull()).isTrue();
        assertThat(done.get("advice").get("riskProfile").stringValue()).isEqualTo("moderate");
        assertThat(done.get("advice").get("generatedAt").stringValue()).isNotBlank();
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void aFailureIsKeptForTheAppAndTryingAgainStartsANewRun() throws Exception {
        Api api = new Api(mvc);
        String token = seededUser();
        gate = new CountDownLatch(0);
        failWith = new ApiException(HttpStatus.TOO_MANY_REQUESTS, "The AI coach is busy — try again in a minute.");

        assertThat(api.post("/api/ai/investment", Map.of(), token).status()).isEqualTo(202);
        JsonNode failed = pollUntilSettled(api, token);
        assertThat(failed.get("job").get("status").stringValue()).isEqualTo("failed");
        assertThat(failed.get("job").get("error").stringValue()).isEqualTo("The AI coach is busy — try again in a minute.");
        assertThat(failed.get("advice").isNull()).isTrue();

        failWith = null;
        assertThat(api.post("/api/ai/investment", Map.of(), token).json().get("job").get("status").stringValue()).isEqualTo("running");
        assertThat(pollUntilSettled(api, token).get("advice").isNull()).isFalse();
    }

    @Test
    void aRunThatNeverFinishedCountsAsInterruptedAndCanBeRestarted() throws Exception {
        Api api = new Api(mvc);
        String token = seededUser();
        gate = new CountDownLatch(0);
        failWith = null;
        UUID me = db.sql("SELECT id FROM users WHERE email = ?").param(lastEmail).query(UUID.class).single();
        db.sql("INSERT INTO ai_jobs (user_id, kind, run_id, status, started_at) VALUES (?, 'investment', ?, 'running', now() - interval '10 minutes')")
                .params(me, UUID.randomUUID()).update();

        JsonNode stale = api.get("/api/ai/investment", token).json().get("job");
        assertThat(stale.get("status").stringValue()).isEqualTo("failed");
        assertThat(stale.get("error").stringValue()).isEqualTo(AiJobs.INTERRUPTED);
        assertThat(api.post("/api/ai/investment", Map.of(), token).status()).isEqualTo(202);
        assertThat(pollUntilSettled(api, token).get("advice").isNull()).isFalse();
    }

    @Test
    void stillNeedsAMonthOfHistory() throws Exception {
        Api api = new Api(mvc);
        String token = api.post("/api/auth/register", Map.of("name", "New", "email", "new-" + UUID.randomUUID() + "@test.dev", "password", "password123", "country", "RO"), null)
                .json().get("token").stringValue();
        assertThat(api.post("/api/ai/investment", Map.of(), token).status()).isEqualTo(400);
        assertThat(api.get("/api/ai/investment", token).json().get("job").isNull()).isTrue();
    }
}
