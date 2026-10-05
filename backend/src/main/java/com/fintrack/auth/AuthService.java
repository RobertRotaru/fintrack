package com.fintrack.auth;

import com.fintrack.data.Views;
import com.fintrack.data.Visibility;
import com.fintrack.reference.ReferenceData;
import com.fintrack.security.JwtService;
import com.fintrack.web.ApiException;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    public record Session(String token, Views.User user) {}

    private final JdbcClient db;
    private final Visibility view;
    private final ReferenceData ref;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final LoginThrottle throttle;

    public AuthService(JdbcClient db, Visibility view, ReferenceData ref, PasswordEncoder passwords, JwtService jwt, LoginThrottle throttle) {
        this.db = db;
        this.view = view;
        this.ref = ref;
        this.passwords = passwords;
        this.jwt = jwt;
        this.throttle = throttle;
    }

    @Transactional
    public Session register(String email, String name, String password, String country, String currency) {
        if (db.sql("SELECT 1 FROM users WHERE lower(email) = ?").param(email).query().optionalValue().isPresent()) {
            throw ApiException.conflict("An account with this email already exists");
        }
        UUID id = UUID.randomUUID();
        db.sql("INSERT INTO users (id, email, name, password_hash, base_currency, country) VALUES (?, ?, ?, ?, ?, ?)")
                .params(id, email, name, passwords.encode(password), currency, country)
                .update();
        seedDefaultCategories(id);
        return new Session(jwt.issue(id), view.user(id).orElseThrow());
    }

    public void seedDefaultCategories(UUID userId) {
        for (ReferenceData.DefaultCategory c : ref.defaultCategories()) {
            db.sql("INSERT INTO categories (id, user_id, kind, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?, ?, TRUE)")
                    .params(UUID.randomUUID(), userId, c.kind(), c.name(), c.icon(), c.color())
                    .update();
        }
    }

    public Session login(String email, String password, String clientIp) {
        String key = clientIp + "|" + email;
        throttle.check(key);
        record Row(UUID id, String hash) {}
        Row row = db.sql("SELECT id, password_hash FROM users WHERE lower(email) = ?").param(email)
                .query((rs, i) -> new Row(rs.getObject("id", UUID.class), rs.getString("password_hash")))
                .optional().orElse(null);
        if (row == null || !passwords.matches(password, row.hash())) {
            throttle.failed(key);
            throw ApiException.unauthorized("Wrong email or password");
        }
        throttle.succeeded(key);
        return new Session(jwt.issue(row.id()), view.user(row.id()).orElseThrow());
    }

    /** All-or-nothing: fields are validated before this runs; null means "leave as is". */
    @Transactional
    public Views.User update(UUID me, String name, String country, String currency) {
        if (name != null) db.sql("UPDATE users SET name = ? WHERE id = ?").params(name, me).update();
        if (country != null) db.sql("UPDATE users SET country = ? WHERE id = ?").params(country, me).update();
        if (currency != null) db.sql("UPDATE users SET base_currency = ? WHERE id = ?").params(currency, me).update();
        return view.user(me).orElseThrow();
    }
}
