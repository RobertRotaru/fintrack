package com.fintrack;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Integration tests against a real PostgreSQL. By default an embedded server
 * (no Docker needed); set TEST_DB_URL (plus TEST_DB_USER / TEST_DB_PASSWORD)
 * to use an existing one — required when running as root, which PostgreSQL refuses.
 * Each test class gets its own fresh database (and application context), migrated by Flyway.
 */
@SpringBootTest(properties = "fintrack.fx.enabled=false")
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public abstract class PostgresTest {
    private static EmbeddedPostgres embedded;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) throws SQLException, IOException {
        String external = System.getenv("TEST_DB_URL");
        String user = external != null ? System.getenv().getOrDefault("TEST_DB_USER", "postgres") : "postgres";
        String password = external != null ? System.getenv().getOrDefault("TEST_DB_PASSWORD", "") : "postgres";
        String adminUrl;
        if (external != null) {
            adminUrl = external;
        } else {
            synchronized (PostgresTest.class) {
                if (embedded == null) embedded = EmbeddedPostgres.builder().start();
            }
            adminUrl = embedded.getJdbcUrl("postgres", "postgres");
        }
        String name = "fintrack_test_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection c = DriverManager.getConnection(adminUrl, user, password); Statement st = c.createStatement()) {
            st.execute("CREATE DATABASE " + name);
        }
        String url = adminUrl.replaceFirst("/[^/?]+(\\?|$)", "/" + name + "$1");
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> user);
        registry.add("spring.datasource.password", () -> password);
    }
}
