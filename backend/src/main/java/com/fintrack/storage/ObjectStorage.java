package com.fintrack.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * A bucket of files addressed by key. Browsers upload straight to it with a short-lived presigned URL,
 * so file bytes never pass through the database (and, with a real provider, not through this app either).
 * Implementations: {@link LocalObjectStorage} today; an S3-compatible one (Cloudflare R2, DigitalOcean
 * Spaces, AWS S3) needs only these four methods.
 */
public interface ObjectStorage {
    /** How the browser should send the file: method, URL and the headers the signature covers. */
    record Upload(String method, String url, Map<String, String> headers, long maxBytes, Instant expiresAt) {}

    Upload presignPut(String key, String contentType, long maxBytes, Duration ttl);

    /** Where anyone can read the object (it's public: keys are unguessable and change on every upload). */
    String publicUrl(String key);

    boolean exists(String key);

    void delete(String key);
}
