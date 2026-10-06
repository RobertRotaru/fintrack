package com.fintrack.storage;

import com.fintrack.config.AppProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * A stand-in bucket for development and demos: objects are files under {@code fintrack.storage.local-dir},
 * uploaded and served by {@link LocalStorageController}. It mimics S3 presigning — the upload URL carries
 * an expiry, size cap and content type, signed with HMAC — so the browser code is identical to the real thing.
 * Not for production on platforms with an ephemeral disk (App Platform, containers).
 */
@Component
@ConditionalOnProperty(name = "fintrack.storage.driver", havingValue = "local", matchIfMissing = true)
public class LocalObjectStorage implements ObjectStorage {
    /** Keys look like {@code avatars/<uuid>/<hex>.webp}: no dots in folders, so no way out of the root. */
    static final Pattern KEY = Pattern.compile("^[a-z]+(/[A-Za-z0-9-]{1,64}){1,3}\\.(webp|jpg|png)$");
    static final String PREFIX = "/api/storage/";

    private final Path root;
    private final byte[] secret;
    private final Clock clock;

    public LocalObjectStorage(AppProperties props, Clock clock) {
        String dir = props.storage() == null || props.storage().localDir() == null ? ".data/uploads" : props.storage().localDir();
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.secret = ("storage:" + props.jwtSecret()).getBytes(StandardCharsets.UTF_8);
        this.clock = clock;
    }

    @Override
    public Upload presignPut(String key, String contentType, long maxBytes, Duration ttl) {
        if (file(key) == null) throw new IllegalArgumentException("Bad storage key: " + key);
        Instant expires = clock.instant().plus(ttl);
        long exp = expires.getEpochSecond();
        String sig = sign(key, contentType, maxBytes, exp);
        String url = PREFIX + key + "?ct=" + URLEncoder.encode(contentType, StandardCharsets.UTF_8) + "&max=" + maxBytes + "&exp=" + exp + "&sig=" + sig;
        return new Upload("PUT", url, Map.of("Content-Type", contentType), maxBytes, expires);
    }

    @Override
    public String publicUrl(String key) {
        return PREFIX + key;
    }

    @Override
    public boolean exists(String key) {
        Path f = file(key);
        return f != null && Files.isRegularFile(f);
    }

    @Override
    public void delete(String key) {
        Path f = file(key);
        if (f == null) return;
        try {
            Files.deleteIfExists(f);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // --- used by LocalStorageController -------------------------------------------------------

    /** The file for a key, or null when the key isn't one we'd ever hand out. */
    Path file(String key) {
        if (key == null || !KEY.matcher(key).matches()) return null;
        Path f = root.resolve(key).normalize();
        return f.startsWith(root) ? f : null;
    }

    boolean verify(String key, String contentType, long maxBytes, long exp, String sig) {
        if (sig == null || clock.instant().getEpochSecond() > exp) return false;
        return MessageDigest.isEqual(sign(key, contentType, maxBytes, exp).getBytes(StandardCharsets.US_ASCII), sig.getBytes(StandardCharsets.US_ASCII));
    }

    private String sign(String key, String contentType, long maxBytes, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] out = mac.doFinal(("PUT\n" + key + "\n" + contentType + "\n" + maxBytes + "\n" + exp).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
