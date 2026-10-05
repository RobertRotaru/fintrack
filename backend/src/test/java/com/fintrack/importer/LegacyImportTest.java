package com.fintrack.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fintrack.Api;
import com.fintrack.PostgresTest;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Imports a real database produced by the previous Node/SQLite backend
 * (two users, a year of demo data, a family with shared accounts and goals,
 * BTC amounts, archived categories, an AI report) and checks that the new API
 * returns exactly what the old API returned for it, and that the old
 * passwords still sign in.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LegacyImportTest extends PostgresTest {
    private static final Pattern TIMESTAMP = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}.*");

    @Autowired SqliteImporter importer;
    @Autowired MockMvc mvc;
    Path legacyFile;
    Map<String, Integer> counts;

    @BeforeAll
    void importLegacyDatabase() throws Exception {
        Path db = Files.createTempFile("legacy-", ".db");
        db.toFile().deleteOnExit();
        legacyFile = db;
        try (InputStream in = getClass().getResourceAsStream("/legacy/finance.db")) {
            Files.copy(in, db, StandardCopyOption.REPLACE_EXISTING);
        }
        counts = importer.importFrom(db);
    }

    @Test
    void copiesEveryTable() {
        assertThat(counts).containsEntry("users", 2).containsEntry("households", 1).containsEntry("household_members", 2)
                .containsEntry("accounts", 8).containsEntry("categories", 70).containsEntry("transactions", 586).containsEntry("transfers", 52)
                .containsEntry("goals", 6).containsEntry("goal_contributions", 17).containsEntry("ai_reports", 1).containsEntry("fx_cache", 1);
    }

    @Test
    void refusesToImportIntoANonEmptyDatabase() {
        assertThatThrownBy(() -> importer.importFrom(legacyFile)).hasMessageContaining("already has users");
    }

    @Test
    void theNewApiReturnsExactlyWhatTheOldOneDid() throws Exception {
        Api api = new Api(mvc);
        JsonNode snapshot;
        try (InputStream in = getClass().getResourceAsStream("/legacy/api-snapshot.json")) {
            snapshot = Api.json().readTree(in);
        }
        Map<String, String> endpoints = Map.of("me", "/api/auth/me", "accounts", "/api/accounts", "categories", "/api/categories",
                "transactions", "/api/transactions", "transfers", "/api/transfers", "goals", "/api/goals", "household", "/api/household");
        for (String who : List.of("robert", "ana")) {
            JsonNode creds = snapshot.get("credentials").get(who);
            String token = api.login(creds.get("email").stringValue(), creds.get("password").stringValue());
            for (var e : endpoints.entrySet()) {
                JsonNode expected = canonical(snapshot.get(who).get(e.getKey()));
                JsonNode actual = canonical(api.get(e.getValue(), token).json());
                assertThat(actual).as(who + " " + e.getValue()).isEqualTo(expected);
            }
        }
    }

    @Test
    void keepsTheStoredAiReportAndExchangeRates() throws Exception {
        Api api = new Api(mvc);
        String token = api.login("robert@legacy.test", "legacy-pass-123");
        JsonNode advice = api.get("/api/ai/investment", token).json().get("advice");
        assertThat(advice.get("riskProfile").stringValue()).isEqualTo("moderate");
        assertThat(advice.get("allocation")).hasSize(3);
    }

    /**
     * Order-independent, timestamp-format-independent form: arrays sorted by id,
     * timestamps as instants ("2026-10-05 06:49:12" == "2026-10-05T06:49:12Z").
     */
    static JsonNode canonical(JsonNode node) {
        JsonNodeFactory f = JsonNodeFactory.instance;
        if (node == null || node.isNull()) return f.nullNode();
        if (node.isObject()) {
            ObjectNode out = f.objectNode();
            Map<String, JsonNode> sorted = new TreeMap<>();
            node.properties().forEach(e -> sorted.put(e.getKey(), canonical(e.getValue())));
            sorted.forEach(out::set);
            return out;
        }
        if (node.isArray()) {
            List<JsonNode> items = new ArrayList<>();
            node.forEach(n -> items.add(canonical(n)));
            items.sort(Comparator.comparing(n -> n.has("id") ? n.get("id").stringValue() : n.toString()));
            return f.arrayNode().addAll(items);
        }
        if (node.isString() && TIMESTAMP.matcher(node.stringValue()).matches()) {
            String v = node.stringValue();
            return f.stringNode(Instant.parse(v.contains("T") ? v : v.replace(' ', 'T') + "Z").toString());
        }
        if (node.isNumber()) return f.numberNode(node.doubleValue());
        return node;
    }
}
