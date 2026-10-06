package com.fintrack.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Hosts like Heroku hand the database over as one {@code DATABASE_URL} ({@code postgres://user:pass@host:5432/db}),
 * and may rotate it. When {@code DB_URL} isn't set, this turns that into the {@code DB_URL}, {@code DB_USER} and
 * {@code DB_PASSWORD} the datasource reads, at every start. Explicit {@code DB_*} variables always win.
 */
public class DatabaseUrlEnvironment implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication application) {
        String url = env.getProperty("DATABASE_URL");
        if (url == null || url.isBlank() || env.containsProperty("DB_URL")) return;
        env.getPropertySources().addLast(new MapPropertySource("databaseUrl", fromDatabaseUrl(url)));
    }

    static Map<String, Object> fromDatabaseUrl(String databaseUrl) {
        URI uri = URI.create(databaseUrl.strip());
        if (!"postgres".equals(uri.getScheme()) && !"postgresql".equals(uri.getScheme()))
            throw new IllegalStateException("DATABASE_URL must be a postgres:// URL");
        Map<String, Object> props = new LinkedHashMap<>();
        String query = uri.getRawQuery();
        // Managed databases are reached over the internet: require TLS unless the URL says otherwise.
        if (query == null || !query.contains("sslmode=")) query = (query == null ? "" : query + "&") + "sslmode=require";
        String port = uri.getPort() == -1 ? "" : ":" + uri.getPort();
        props.put("DB_URL", "jdbc:postgresql://" + uri.getHost() + port + uri.getRawPath() + "?" + query);
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null) {
            int colon = userInfo.indexOf(':');
            props.put("DB_USER", decode(colon < 0 ? userInfo : userInfo.substring(0, colon)));
            if (colon >= 0) props.put("DB_PASSWORD", decode(userInfo.substring(colon + 1)));
        }
        return props;
    }

    private static String decode(String s) {
        return URLDecoder.decode(s, StandardCharsets.UTF_8);
    }
}
