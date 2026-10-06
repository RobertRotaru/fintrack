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
     * @param driver   "r2" — Cloudflare R2 (see R2ObjectStorage), or "local" — a stand-in bucket on disk served by
     *                 this app, for development and tests (the default)
     * @param localDir directory the local bucket writes to
     */
    public record Storage(String driver, String localDir, R2 r2) {}

    /**
     * Cloudflare R2 (or any S3-compatible bucket).
     *
     * @param accountId Cloudflare account id; the endpoint is derived from it unless {@code endpoint} is set
     * @param publicUrl where objects are read from: the bucket's r2.dev URL or a custom domain
     */
    public record R2(String accountId, String endpoint, String bucket, String accessKeyId, String secretAccessKey, String publicUrl) {}

    public static final String DEV_SECRET = "dev-only-secret-change-me-32-chars-min";
}
