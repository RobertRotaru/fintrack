package com.fintrack.security;

import com.fintrack.web.Ids;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads `Authorization: Bearer …`. A valid token for an existing user becomes
 * the request's principal (the user's UUID); otherwise the reason is kept for
 * the 401 that protected routes return.
 */
public class JwtAuthFilter extends OncePerRequestFilter {
    static final String REASON = "fintrack.authError";

    private final JwtService jwt;
    private final JdbcClient db;

    public JwtAuthFilter(JwtService jwt, JdbcClient db) {
        this.jwt = jwt;
        this.db = db;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7) : "";
        if (token.isEmpty()) {
            request.setAttribute(REASON, "Not signed in");
        } else {
            UUID userId = jwt.subject(token).map(Ids::parse).orElse(null);
            // A well-signed token for a user that no longer exists is not a session.
            boolean exists = userId != null && db.sql("SELECT 1 FROM users WHERE id = ?").param(userId).query().optionalValue().isPresent();
            if (exists) {
                var auth = new UsernamePasswordAuthenticationToken(userId, null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                request.setAttribute(REASON, "Session expired");
            }
        }
        chain.doFilter(request, response);
    }
}
