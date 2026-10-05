package com.fintrack.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {
    /** The server's notion of "now" — replaceable in tests. */
    @Bean
    Clock clock() {
        return Clock.systemDefaultZone();
    }
}
