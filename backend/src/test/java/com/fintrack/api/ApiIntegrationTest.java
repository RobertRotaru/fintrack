package com.fintrack.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.fintrack.Api;
import com.fintrack.PostgresTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;

/**
 * Behaviour the full contract suite (tests/contract) also covers end to end;
 * these pin down the parts that are easy to get wrong in the Spring stack.
 */
class ApiIntegrationTest extends PostgresTest {
    @Autowired MockMvc mvc;

    private String register(Api api, String email) throws Exception {
        var r = api.post("/api/auth/register", Map.of("name", "Ana", "email", email, "password", "password123", "country", "RO"), null);
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.json().get("user").has("password_hash")).isFalse();
        return r.json().get("token").stringValue();
    }

    @Test
    void moneyComesBackAsExactPlainNumbers() throws Exception {
        Api api = new Api(mvc);
        String token = register(api, "money@test.dev");
        JsonNode acc = api.post("/api/accounts", Map.of("type", "crypto", "name", "BTC", "country", "RO", "currency", "BTC", "color", "#f7931a",
                "icon", "bitcoin", "initialBalance", 0.5, "institutionId", "binance"), token).json();
        String cat = api.get("/api/categories", token).json().get(0).get("id").stringValue();
        var tx = api.post("/api/transactions", Map.of("accountId", acc.get("id").stringValue(), "kind", "expense", "amount", 0.00012345, "categoryId", cat), token);
        assertThat(tx.status()).isEqualTo(201);
        assertThat(tx.text()).contains("\"amount\":0.00012345");
        String accounts = api.get("/api/accounts", token).text();
        assertThat(accounts).contains("\"balance\":0.49987655").contains("\"initialBalance\":0.5").doesNotContain("E-").doesNotContain("0.50000000");
    }

    @Test
    void categoriesUseTheWebAppsFieldNames() throws Exception {
        Api api = new Api(mvc);
        String token = register(api, "cats@test.dev");
        JsonNode c = api.get("/api/categories", token).json().get(0);
        assertThat(c.has("isDefault")).isTrue();
        assertThat(c.has("default")).isFalse();
        assertThat(api.get("/api/categories", token).json()).hasSize(34);
    }

    @Test
    void noFamilyIsJsonNull() throws Exception {
        Api api = new Api(mvc);
        String token = register(api, "nofamily@test.dev");
        var r = api.get("/api/household", token);
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.text()).isEqualTo("null");
    }

    @Test
    void errorsAreJsonWithUsefulMessages() throws Exception {
        Api api = new Api(mvc);
        assertThat(api.get("/api/accounts", null).json().get("error").stringValue()).isEqualTo("Not signed in");
        assertThat(api.get("/api/accounts", "garbage").json().get("error").stringValue()).isEqualTo("Session expired");
        var missing = api.get("/api/nope", null);
        assertThat(missing.status()).isEqualTo(404);
        assertThat(missing.json().get("error").stringValue()).isEqualTo("Not found");
        var malformed = api.post("/api/auth/login", "{\"email\":", null);
        assertThat(malformed.status()).isEqualTo(400);
        assertThat(malformed.json().get("error").stringValue()).isEqualTo("Request body is not valid JSON");
        var big = api.post("/api/auth/login", "{\"email\":\"" + "x".repeat(1_100_000) + "\"}", null);
        assertThat(big.status()).isEqualTo(413);
    }

    @Test
    void nonJsonBodiesAreTreatedAsEmpty() throws Exception {
        var res = mvc.perform(MockMvcRequestBuilders.post("/api/auth/register").contentType("application/x-www-form-urlencoded").content("email=a"))
                .andReturn().getResponse();
        assertThat(res.getStatus()).isEqualTo(400);
        assertThat(res.getContentAsString()).contains("Email is required");
    }

    @Test
    void malformedIdsAreNotFoundNotServerErrors() throws Exception {
        Api api = new Api(mvc);
        String token = register(api, "ids@test.dev");
        assertThat(api.call(HttpMethod.DELETE, "/api/transactions/nope", null, token).status()).isEqualTo(404);
        assertThat(api.call(HttpMethod.PATCH, "/api/accounts/' OR 1=1 --", Map.of("name", "x"), token).status()).isEqualTo(404);
        assertThat(api.get("/api/transactions?accountId=nope", token).json()).isEmpty();
        assertThat(api.post("/api/transactions", Map.of("accountId", "nope", "kind", "expense", "amount", 1, "categoryId", "x"), token).status()).isEqualTo(400);
    }

    @Test
    void healthAndRatesArePublic() throws Exception {
        Api api = new Api(mvc);
        assertThat(api.get("/api/health", null).text()).isEqualTo("{\"ok\":true}");
        JsonNode fx = api.get("/api/fx", null).json();
        assertThat(fx.get("rates").get("EUR").doubleValue()).isEqualTo(1.0);
        assertThat(fx.get("attribution").get("url").stringValue()).startsWith("https://");
        assertThat(api.get("/actuator/health", null).json().get("status").stringValue()).isEqualTo("UP");
    }
}
