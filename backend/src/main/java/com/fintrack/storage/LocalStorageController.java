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
        if (!ImageSniff.matches(ct, bytes)) throw bad("That doesn't look like a " + ct.substring(ct.indexOf('/') + 1) + " image");

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
                .contentType(MediaType.parseMediaType(ImageSniff.typeOfKey(k)))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(file));
    }
}
