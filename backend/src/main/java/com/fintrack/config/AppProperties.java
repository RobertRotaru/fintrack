package com.fintrack.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("fintrack")
public record AppProperties(String jwtSecret, Duration tokenTtl, List<String> corsOrigins, Fx fx, Ai ai, Storage storage) {
    public record Fx(boolean enabled) {}

    public record Ai(String model) {}

    /**
     * Where uploaded files (profile photos) live. Only the object key is kept in the database.
     *
     * @param driver   "local" — a stand-in bucket on disk, served by this app (the default; see LocalObjectStorage)
     * @param localDir directory the local bucket writes to
     */
    public record Storage(String driver, String localDir) {}

    public static final String DEV_SECRET = "dev-only-secret-change-me-32-chars-min";
}
