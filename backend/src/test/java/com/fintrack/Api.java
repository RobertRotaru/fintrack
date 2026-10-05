package com.fintrack;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Small JSON-over-MockMvc client for integration tests. */
public final class Api {
    public record Res(int status, String text, JsonNode json) {}

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final MockMvc mvc;

    public Api(MockMvc mvc) {
        this.mvc = mvc;
    }

    public Res call(HttpMethod method, String path, Object body, String token) throws Exception {
        MockHttpServletRequestBuilder req = request(method, path);
        if (token != null) req.header("Authorization", "Bearer " + token);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body instanceof String s ? s : JSON.writeValueAsString(body));
        MockHttpServletResponse res = mvc.perform(req).andReturn().getResponse();
        String text = res.getContentAsString();
        return new Res(res.getStatus(), text, text.isEmpty() ? null : JSON.readTree(text));
    }

    public Res get(String path, String token) throws Exception {
        return call(HttpMethod.GET, path, null, token);
    }

    public Res post(String path, Object body, String token) throws Exception {
        return call(HttpMethod.POST, path, body, token);
    }

    public String login(String email, String password) throws Exception {
        Res r = post("/api/auth/login", java.util.Map.of("email", email, "password", password), null);
        if (r.status() != 200) throw new AssertionError("login failed: " + r.text());
        return r.json().get("token").stringValue();
    }

    public static JsonMapper json() {
        return JSON;
    }
}
