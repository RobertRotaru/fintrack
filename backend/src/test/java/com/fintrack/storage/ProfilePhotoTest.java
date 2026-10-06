package com.fintrack.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.fintrack.Api;
import com.fintrack.PostgresTest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;

/** Profile photos go to object storage through a presigned upload; the database only keeps the key. */
class ProfilePhotoTest extends PostgresTest {
    static final Path DIR;
    static {
        try {
            DIR = Files.createTempDirectory("fintrack-storage");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void storage(DynamicPropertyRegistry registry) {
        registry.add("fintrack.storage.local-dir", DIR::toString);
    }

    /** A tiny but genuine-looking WebP header. */
    static final byte[] WEBP = {'R', 'I', 'F', 'F', 20, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' ', 1, 2, 3, 4};

    @Autowired MockMvc mvc;
    @Autowired JdbcClient db;

    private String register(Api api, String email) throws Exception {
        return api.post("/api/auth/register", Map.of("name", "Ana Pop", "email", email, "password", "password123", "country", "RO"), null)
                .json().get("token").stringValue();
    }

    private int upload(String url, String type, byte[] body) throws Exception {
        // URI.create: the link is already encoded, exactly as a browser would send it.
        return mvc.perform(put(java.net.URI.create(url)).contentType(type).content(body)).andReturn().getResponse().getStatus();
    }

    @Test
    void uploadSetReplaceAndRemoveAPhoto() throws Exception {
        Api api = new Api(mvc);
        String token = register(api, "photo@test.dev");
        assertThat(api.get("/api/auth/me", token).json().get("avatarUrl").isNull()).isTrue();

        JsonNode t = api.post("/api/me/avatar/uploads", Map.of("contentType", "image/webp", "size", WEBP.length), token).json();
        String key = t.get("key").stringValue();
        String url = t.get("upload").get("url").stringValue();
        assertThat(key).matches("avatars/[0-9a-f-]{36}/[0-9a-f]{32}\\.webp");
        assertThat(t.get("upload").get("method").stringValue()).isEqualTo("PUT");

        // Not uploaded yet.
        assertThat(api.call(HttpMethod.PUT, "/api/me/avatar", Map.of("key", key), token).status()).isEqualTo(400);
        // The signature covers the content type and the bytes must match it.
        assertThat(upload(url, "image/png", WEBP)).isEqualTo(400);
        assertThat(upload(url, "image/webp", "not an image".getBytes())).isEqualTo(400);
        // Tampered link.
        assertThat(upload(url.replace("max=2000000", "max=9000000"), "image/webp", WEBP)).isEqualTo(403);
        assertThat(upload(url, "image/webp", WEBP)).isEqualTo(200);

        JsonNode me = api.call(HttpMethod.PUT, "/api/me/avatar", Map.of("key", key), token).json();
        assertThat(me.get("avatarUrl").stringValue()).isEqualTo("/api/storage/" + key);
        // Only the key is stored, never the bytes.
        assertThat(db.sql("SELECT avatar_key FROM users WHERE email = 'photo@test.dev'").query(String.class).single()).isEqualTo(key);
        var served = mvc.perform(get("/api/storage/" + key)).andReturn().getResponse();
        assertThat(served.getStatus()).isEqualTo(200);
        assertThat(served.getContentType()).isEqualTo("image/webp");
        assertThat(served.getContentAsByteArray()).isEqualTo(WEBP);
        assertThat(served.getHeader("Cache-Control")).contains("immutable");

        // Replacing deletes the old object.
        JsonNode t2 = api.post("/api/me/avatar/uploads", Map.of("contentType", "image/webp"), token).json();
        assertThat(upload(t2.get("upload").get("url").stringValue(), "image/webp", WEBP)).isEqualTo(200);
        api.call(HttpMethod.PUT, "/api/me/avatar", Map.of("key", t2.get("key").stringValue()), token);
        assertThat(Files.exists(DIR.resolve(key))).isFalse();

        // Removing clears the key and the object.
        assertThat(api.call(HttpMethod.DELETE, "/api/me/avatar", null, token).json().get("avatarUrl").isNull()).isTrue();
        assertThat(Files.exists(DIR.resolve(t2.get("key").stringValue()))).isFalse();
    }

    @Test
    void rulesForUploads() throws Exception {
        Api api = new Api(mvc);
        String ana = register(api, "ana@test.dev");
        String bob = register(api, "bob@test.dev");
        assertThat(api.post("/api/me/avatar/uploads", Map.of("contentType", "image/gif"), ana).status()).isEqualTo(400);
        assertThat(api.post("/api/me/avatar/uploads", Map.of("contentType", "image/webp", "size", 5_000_000), ana).status()).isEqualTo(400);
        assertThat(api.post("/api/me/avatar/uploads", Map.of("contentType", "image/webp"), null).status()).isEqualTo(401);

        // Someone else's key can't be claimed.
        JsonNode t = api.post("/api/me/avatar/uploads", Map.of("contentType", "image/webp"), ana).json();
        assertThat(upload(t.get("upload").get("url").stringValue(), "image/webp", WEBP)).isEqualTo(200);
        assertThat(api.call(HttpMethod.PUT, "/api/me/avatar", Map.of("key", t.get("key").stringValue()), bob).status()).isEqualTo(400);

        // Keys can't escape the storage folder.
        assertThat(mvc.perform(get("/api/storage/../../etc/passwd.png")).andReturn().getResponse().getStatus()).isIn(400, 404);
        assertThat(mvc.perform(get("/api/storage/avatars/x/missing.webp")).andReturn().getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    void bioIsPartOfTheProfile() throws Exception {
        Api api = new Api(mvc);
        String token = register(api, "bio@test.dev");
        assertThat(api.get("/api/auth/me", token).json().get("bio").stringValue()).isEmpty();
        var r = api.call(HttpMethod.PATCH, "/api/auth/me", Map.of("bio", "  Saving for a sailboat.  "), token);
        assertThat(r.json().get("bio").stringValue()).isEqualTo("Saving for a sailboat.");
        assertThat(api.call(HttpMethod.PATCH, "/api/auth/me", Map.of("bio", "x".repeat(281)), token).status()).isEqualTo(400);
        assertThat(api.call(HttpMethod.PATCH, "/api/auth/me", Map.of("bio", ""), token).json().get("bio").stringValue()).isEmpty();
    }
}
