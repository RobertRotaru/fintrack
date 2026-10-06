package com.fintrack.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * A bucket of files addressed by key. Browsers upload straight to it with a short-lived presigned URL,
 * so file bytes never pass through the database (and, with a real provider, not through this app either).
 * Implementations: {@link R2ObjectStorage} (Cloudflare R2, or any S3-compatible bucket) for real use, and
 * {@link LocalObjectStorage}, a stand-in on disk for development and tests.
 */
public interface ObjectStorage {
    /**
     * How the browser should send the file: method, URL and the headers the signature covers (the browser
     * adds Content-Length itself).
     */
    record Upload(String method, String url, Map<String, String> headers, long size, Instant expiresAt) {}

    /** A link that accepts exactly one PUT of {@code size} bytes of {@code contentType} at {@code key}, until {@code ttl} runs out. */
    Upload presignPut(String key, String contentType, long size, Duration ttl);

    /** Where anyone can read the object (it's public: keys are unguessable and change on every upload). */
    String publicUrl(String key);

    /** The object's first {@code n} bytes (fewer if it's shorter), or null when there's no such object. */
    byte[] head(String key, int n);

    void delete(String key);
}
