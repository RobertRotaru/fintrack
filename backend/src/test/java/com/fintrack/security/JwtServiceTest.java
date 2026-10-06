package com.fintrack.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fintrack.config.AppProperties;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class JwtServiceTest {
    private static AppProperties props(String secret, Duration ttl) {
        return new AppProperties(secret, ttl, List.of(), new AppProperties.Fx(false), new AppProperties.Ai("m"), new AppProperties.Storage("local", ".data/uploads", null));
    }

    @Test
    void issuesTokensItCanVerify() {
        JwtService jwt = new JwtService(props(AppProperties.DEV_SECRET, Duration.ofDays(30)), new MockEnvironment());
        UUID id = UUID.randomUUID();
        assertThat(jwt.subject(jwt.issue(id))).contains(id.toString());
    }

    @Test
    void rejectsTamperedForeignAndExpiredTokens() {
        JwtService jwt = new JwtService(props(AppProperties.DEV_SECRET, Duration.ofDays(30)), new MockEnvironment());
        String token = jwt.issue(UUID.randomUUID());
        assertThat(jwt.subject(token.substring(0, token.length() - 2) + "xx")).isEmpty();
        assertThat(jwt.subject("garbage")).isEmpty();
        JwtService other = new JwtService(props("another-secret-that-is-long-enough-123", Duration.ofDays(30)), new MockEnvironment());
        assertThat(other.subject(token)).isEmpty();
        JwtService expired = new JwtService(props(AppProperties.DEV_SECRET, Duration.ofSeconds(-10)), new MockEnvironment());
        assertThat(jwt.subject(expired.issue(UUID.randomUUID()))).isEmpty();
    }

    @Test
    void refusesWeakSecretsAndTheDevSecretInProduction() {
        assertThatThrownBy(() -> new JwtService(props("short", Duration.ofDays(1)), new MockEnvironment())).hasMessageContaining("at least 32");
        MockEnvironment prod = new MockEnvironment();
        prod.setActiveProfiles("prod");
        assertThatThrownBy(() -> new JwtService(props(AppProperties.DEV_SECRET, Duration.ofDays(1)), prod)).hasMessageContaining("production");
    }
}
