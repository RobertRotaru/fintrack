package com.fintrack.auth;

import com.fintrack.web.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Brute-force guard: at most {@value #MAX_FAILS} failed sign-ins per email and
 * client IP in a 15-minute window. Kept in memory, so with several instances
 * each enforces its own window.
 */
@Component
public class LoginThrottle {
    static final int MAX_FAILS = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private record Fails(int count, long first) {}

    private final Map<String, Fails> failures = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginThrottle() {
        this(Clock.systemUTC());
    }

    LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    public void check(String key) {
        long now = clock.millis();
        Fails f = failures.get(key);
        if (f == null) return;
        long elapsed = now - f.first();
        if (elapsed > WINDOW.toMillis()) {
            failures.remove(key);
        } else if (f.count() >= MAX_FAILS) {
            long minutes = (long) Math.ceil((WINDOW.toMillis() - elapsed) / 60_000.0);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Try again in " + minutes + " minute" + (minutes == 1 ? "" : "s") + ".");
        }
    }

    public void failed(String key) {
        long now = clock.millis();
        if (failures.size() > 10_000) failures.values().removeIf(v -> now - v.first() > WINDOW.toMillis());
        failures.merge(key, new Fails(1, now), (old, one) -> new Fails(old.count() + 1, old.first()));
    }

    public void succeeded(String key) {
        failures.remove(key);
    }
}
