package com.fintrack.security;

import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.json.JsonMapper;

@Configuration
@ConditionalOnWebApplication
public class SecurityConfig {
    /** Everything under these needs a session; health, FX, sign-up and sign-in are public. */
    static final String[] PROTECTED = {
        "/api/auth/me", "/api/me/**", "/api/accounts/**", "/api/categories/**", "/api/transactions/**", "/api/transfers/**",
        "/api/goals/**", "/api/household/**", "/api/ai/**", "/api/demo/**",
    };

    @Bean
    SecurityFilterChain api(HttpSecurity http, JwtService jwt, JdbcClient db, JsonMapper mapper) throws Exception {
        http.csrf(c -> c.disable())
                .cors(Customizer.withDefaults())
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable())
                .logout(l -> l.disable())
                .requestCache(r -> r.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a.requestMatchers(PROTECTED).authenticated().anyRequest().permitAll())
                .exceptionHandling(e -> e.authenticationEntryPoint((request, response, ex) -> {
                    Object reason = request.getAttribute(JwtAuthFilter.REASON);
                    response.setStatus(401);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    mapper.writeValue(response.getOutputStream(), Map.of("error", reason != null ? reason : "Not signed in"));
                }))
                .addFilterBefore(new JwtAuthFilter(jwt, db), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** Tokens, not usernames: stops Spring Boot from generating a default user. */
    @Bean
    UserDetailsService noUsers() {
        return new InMemoryUserDetailsManager();
    }

}
