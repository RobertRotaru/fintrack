package com.fintrack.storage;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.forbidden;
import static com.fintrack.web.ApiException.notFound;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Arrays;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The HTTP side of {@link LocalObjectStorage}: accepts presigned uploads and serves objects publicly,
 * the way an S3-compatible bucket would. Public on purpose — the signature, not a session, authorises a PUT.
 */
@RestController
@ConditionalOnProperty(name = "fintrack.storage.driver", havingValue = "local", matchIfMissing = true)
public class LocalStorageController {
    private final LocalObjectStorage storage;

    public LocalStorageController(LocalObjectStorage storage) {
        this.storage = storage;
    }

    @PutMapping("/api/storage/{*key}")
    public ResponseEntity<Void> put(@PathVariable String key, @RequestParam String ct, @RequestParam long max, @RequestParam long exp,
            @RequestParam String sig, @RequestHeader(value = "Content-Type", required = false) String contentType, HttpServletRequest request)
            throws IOException {
        String k = key.startsWith("/") ? key.substring(1) : key;
        Path file = storage.file(k);
        if (file == null) throw notFound("No such object");
        if (!storage.verify(k, ct, max, exp, sig)) throw forbidden("Upload link is invalid or has expired");
        if (contentType == null || !MediaType.parseMediaType(contentType).equalsTypeAndSubtype(MediaType.parseMediaType(ct))) {
            throw bad("Content-Type must be " + ct);
        }
        if (request.getContentLengthLong() > max) throw bad("File is too large");

        // Read at most max + 1 bytes, so a missing or lying Content-Length can't fill the disk.
        byte[] bytes;
        try (InputStream in = request.getInputStream()) {
            bytes = in.readNBytes((int) Math.min(Integer.MAX_VALUE - 1, max + 1));
        }
        if (bytes.length > max) throw bad("File is too large");
        if (bytes.length == 0) throw bad("File is empty");
        if (!looksLike(ct, bytes)) throw bad("That doesn't look like a " + ct.substring(ct.indexOf('/') + 1) + " image");

        Files.createDirectories(file.getParent());
        Path tmp = Files.createTempFile(file.getParent(), ".upload", ".tmp");
        Files.write(tmp, bytes);
        Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/storage/{*key}")
    public ResponseEntity<FileSystemResource> get(@PathVariable String key) {
        String k = key.startsWith("/") ? key.substring(1) : key;
        Path file = storage.file(k);
        if (file == null || !Files.isRegularFile(file)) throw notFound("No such object");
        // Keys change on every upload, so an object never changes: cache it forever.
        return ResponseEntity.ok()
                .contentType(typeOf(k))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(file));
    }

    private static MediaType typeOf(String key) {
        if (key.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        if (key.endsWith(".png")) return MediaType.IMAGE_PNG;
        return MediaType.IMAGE_JPEG;
    }

    /** Checks the file's magic bytes match the declared image type. */
    static boolean looksLike(String contentType, byte[] b) {
        return switch (contentType) {
            case "image/jpeg" -> b.length > 3 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8 && (b[2] & 0xff) == 0xff;
            case "image/png" -> b.length > 8 && Arrays.equals(Arrays.copyOf(b, 8), new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'});
            case "image/webp" -> b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
            default -> false;
        };
    }
}
