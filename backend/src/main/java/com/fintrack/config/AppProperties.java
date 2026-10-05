package com.fintrack.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("fintrack")
public record AppProperties(String jwtSecret, Duration tokenTtl, List<String> corsOrigins, Fx fx, Ai ai) {
    public record Fx(boolean enabled) {}

    public record Ai(String model) {}

    public static final String DEV_SECRET = "dev-only-secret-change-me-32-chars-min";
}
