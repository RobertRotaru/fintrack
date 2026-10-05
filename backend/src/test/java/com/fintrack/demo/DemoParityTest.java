package com.fintrack.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.fintrack.Api;
import com.fintrack.PostgresTest;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;

/**
 * The demo generator was ported from TypeScript; on the same day, with the
 * same seed and currency, it must produce the same year of activity as the
 * old server did (captured in the legacy snapshot on 2026-10-05).
 */
@Import(DemoParityTest.FixedClock.class)
class DemoParityTest extends PostgresTest {
    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-10-05T12:00:00Z"), ZoneOffset.UTC);
        }
    }

    @Autowired MockMvc mvc;

    private static List<String> rows(JsonNode list, String userId, List<String> keys) {
        List<String> out = new ArrayList<>();
        for (JsonNode t : list) {
            if (!t.get("userId").stringValue().equals(userId)) continue;
            StringBuilder row = new StringBuilder();
            for (String k : keys) row.append(t.get(k).isNumber() ? Double.toString(t.get(k).doubleValue()) : t.get(k).asString("null")).append('|');
            out.add(row.toString());
        }
        out.sort(null);
        return out;
    }

    @Test
    void generatesTheSameYearAsTheOldServer() throws Exception {
        JsonNode legacy;
        try (InputStream in = getClass().getResourceAsStream("/legacy/api-snapshot.json")) {
            legacy = Api.json().readTree(in).get("robert");
        }
        String legacyId = legacy.get("me").get("id").stringValue();

        Api api = new Api(mvc);
        var reg = api.post("/api/auth/register", Map.of("name", "Robert", "email", "parity@test.dev", "password", "password123", "country", "RO"), null);
        String token = reg.json().get("token").stringValue();
        String me = reg.json().get("user").get("id").stringValue();
        var seeded = api.post("/api/demo", Map.of(), token);
        assertThat(seeded.status()).isEqualTo(201);

        List<String> txKeys = List.of("date", "kind", "amount", "categoryName", "note", "currency");
        List<String> expectedTx = rows(legacy.get("transactions"), legacyId, txKeys);
        List<String> actualTx = rows(api.get("/api/transactions", token).json(), me, txKeys);
        assertThat(actualTx).hasSize(seeded.json().get("transactions").intValue()).isEqualTo(expectedTx);

        // Robert's demo transfers (his later "Holiday pot" transfer was added by hand).
        List<String> trKeys = List.of("date", "amount", "toAmount", "note");
        List<String> expectedTr = rows(legacy.get("transfers"), legacyId, trKeys);
        expectedTr.removeIf(r -> r.contains("Holiday pot"));
        assertThat(rows(api.get("/api/transfers", token).json(), me, trKeys)).isEqualTo(expectedTr);

        List<String> goalKeys = List.of("name", "targetAmount", "currency", "deadline", "saved");
        List<String> expectedGoals = rows(legacy.get("goals"), legacyId, goalKeys);
        expectedGoals.removeIf(r -> r.startsWith("Bike|") || r.startsWith("Family holiday|"));
        assertThat(rows(api.get("/api/goals", token).json(), me, goalKeys)).isEqualTo(expectedGoals);
    }
}
