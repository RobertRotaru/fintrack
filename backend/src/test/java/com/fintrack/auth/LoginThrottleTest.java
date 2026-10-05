package com.fintrack.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fintrack.web.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class LoginThrottleTest {
    static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-05T10:00:00Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void blocksAfterTenFailuresAndForgivesAfterTheWindow() {
        MutableClock clock = new MutableClock();
        LoginThrottle t = new LoginThrottle(clock);
        for (int i = 0; i < 10; i++) {
            t.check("ip|a@b.c");
            t.failed("ip|a@b.c");
        }
        assertThatThrownBy(() -> t.check("ip|a@b.c")).isInstanceOf(ApiException.class).hasMessage("Too many attempts. Try again in 15 minutes.");
        assertThatCode(() -> t.check("other-ip|a@b.c")).doesNotThrowAnyException();
        clock.now = clock.now.plus(Duration.ofMinutes(14)).plusSeconds(30);
        assertThatThrownBy(() -> t.check("ip|a@b.c")).hasMessage("Too many attempts. Try again in 1 minute.");
        clock.now = clock.now.plus(Duration.ofMinutes(1));
        assertThatCode(() -> t.check("ip|a@b.c")).doesNotThrowAnyException();
    }

    @Test
    void aSuccessfulSignInResetsTheCount() {
        LoginThrottle t = new LoginThrottle(new MutableClock());
        for (int i = 0; i < 9; i++) t.failed("k");
        t.succeeded("k");
        for (int i = 0; i < 9; i++) t.failed("k");
        assertThatCode(() -> t.check("k")).doesNotThrowAnyException();
    }
}
