package com.fintrack.api;

import static com.fintrack.web.ApiException.bad;
import static com.fintrack.web.ApiException.unauthorized;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.storage.ObjectStorage;
import com.fintrack.web.Body;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Profile photo, in three steps so the image never touches the database:
 * <ol>
 *   <li>{@code POST /api/me/avatar/uploads} — ask for a short-lived upload link for a new key;</li>
 *   <li>the browser PUTs the file straight to object storage with that link;</li>
 *   <li>{@code PUT /api/me/avatar} — point the profile at the uploaded key (the old photo is deleted).</li>
 * </ol>
 */
@RestController
@RequestMapping("/api/me/avatar")
public class ProfileController {
    static final Map<String, String> TYPES = Map.of("image/webp", "webp", "image/jpeg", "jpg", "image/png", "png");
    /** The browser resizes to 512px first, so real photos land well under this. */
    static final long MAX_BYTES = 2_000_000;
    static final Duration UPLOAD_TTL = Duration.ofMinutes(5);

    private final JdbcClient db;
    private final Visibility view;
    private final ObjectStorage storage;

    public ProfileController(JdbcClient db, Visibility view, ObjectStorage storage) {
        this.db = db;
        this.view = view;
        this.storage = storage;
    }

    public record UploadTicket(String key, ObjectStorage.Upload upload) {}

    @PostMapping("/uploads")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadTicket upload(@AuthenticationPrincipal UUID me, Body b) {
        String type = b.oneOf("contentType", "Content type", TYPES.keySet());
        if (b.has("size")) {
            long size = b.num("size", "Size", Body.NumRule.decimals(0).min(java.math.BigDecimal.ONE)).longValue();
            if (size > MAX_BYTES) throw bad("Photos can be up to 2 MB");
        }
        String key = prefix(me) + UUID.randomUUID().toString().replace("-", "") + "." + TYPES.get(type);
        return new UploadTicket(key, storage.presignPut(key, type, MAX_BYTES, UPLOAD_TTL));
    }

    @PutMapping
    public Views.User set(@AuthenticationPrincipal UUID me, Body b) {
        String key = b.str("key", "Key", 200);
        if (!key.startsWith(prefix(me))) throw bad("That photo isn't yours");
        if (!storage.exists(key)) throw bad("Upload the photo first");
        String old = currentKey(me);
        db.sql("UPDATE users SET avatar_key = ? WHERE id = ?").params(key, me).update();
        if (old != null && !old.equals(key)) storage.delete(old);
        return user(me);
    }

    @DeleteMapping
    public Views.User remove(@AuthenticationPrincipal UUID me) {
        String old = currentKey(me);
        db.sql("UPDATE users SET avatar_key = NULL WHERE id = ?").param(me).update();
        if (old != null) storage.delete(old);
        return user(me);
    }

    private static String prefix(UUID me) {
        return "avatars/" + me + "/";
    }

    private String currentKey(UUID me) {
        return db.sql("SELECT avatar_key FROM users WHERE id = ?").param(me).query(String.class).optional().orElse(null);
    }

    private Views.User user(UUID me) {
        return view.user(me).orElseThrow(() -> unauthorized("Account no longer exists"));
    }
}
