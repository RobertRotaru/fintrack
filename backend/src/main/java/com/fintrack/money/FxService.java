package com.fintrack.money;

import com.fintrack.config.AppProperties;
import com.fintrack.reference.ReferenceData;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Live exchange rates, all free and keyless:
 * <ul>
 *   <li>Fiat: ExchangeRate-API open access, updated daily, covers RON and MDL. Its terms require the
 *       attribution link the UI shows.</li>
 *   <li>Crypto: Coinbase's public exchange-rates endpoint.</li>
 * </ul>
 * Live rates overlay the fallback table; the last good snapshot is stored so restarts work offline.
 */
@Service
public class FxService {
    private static final Logger log = LoggerFactory.getLogger(FxService.class);
    private static final String FIAT_URL = "https://open.er-api.com/v6/latest/EUR";
    private static final String CRYPTO_URL = "https://api.coinbase.com/v2/exchange-rates?currency=EUR";
    private static final List<String> CRYPTO = List.of("BTC", "ETH", "USDT");

    public static final Map<String, String> ATTRIBUTION = Map.of("label", "Rates by Exchange Rate API", "url", "https://www.exchangerate-api.com");

    public record Snapshot(String base, Map<String, Double> rates, String updatedAt, String source) {}

    private final ReferenceData ref;
    private final JdbcClient db;
    private final JsonMapper mapper;
    private final AppProperties props;
    private final HttpClient http = HttpClient.newBuilder().proxy(ProxySelector.getDefault()).connectTimeout(Duration.ofSeconds(10)).build();
    private volatile Snapshot snapshot;

    public FxService(ReferenceData ref, JdbcClient db, JsonMapper mapper, AppProperties props) {
        this.ref = ref;
        this.db = db;
        this.mapper = mapper;
        this.props = props;
        this.snapshot = new Snapshot("EUR", ref.fallbackRates(), null, "fallback");
        db.sql("SELECT rates::text AS rates, updated_at FROM fx_cache WHERE id = 1")
                .query((rs, i) -> Map.entry(rs.getString("rates"), rs.getObject("updated_at", OffsetDateTime.class)))
                .optional()
                .ifPresent(c -> apply(readRates(c.getKey()), c.getValue().toInstant().toString(), "cached"));
    }

    public Snapshot current() {
        return snapshot;
    }

    /** Converts via EUR; unknown currencies pass through unchanged. */
    public double convert(double amount, String from, String to) {
        if (from.equals(to)) return amount;
        Double f = snapshot.rates().get(from);
        Double t = snapshot.rates().get(to);
        if (f == null || t == null || f == 0 || t == 0) return amount;
        return (amount / f) * t;
    }

    private void apply(Map<String, Double> live, String updatedAt, String source) {
        Map<String, Double> next = new LinkedHashMap<>(ref.fallbackRates());
        for (String code : ref.currencyCodes()) {
            Double r = live.get(code);
            if (r != null && Double.isFinite(r) && r > 0) next.put(code, r);
        }
        next.put("EUR", 1.0);
        snapshot = new Snapshot("EUR", Collections.unmodifiableMap(next), updatedAt, source);
    }

    private Map<String, Double> readRates(String json) {
        Map<String, Double> out = new LinkedHashMap<>();
        mapper.readTree(json).properties().forEach(e -> {
            if (e.getValue().isNumber()) out.put(e.getKey(), e.getValue().doubleValue());
        });
        return out;
    }

    @Scheduled(initialDelay = 0, fixedDelayString = "PT6H")
    public void scheduledRefresh() {
        if (!props.fx().enabled()) return;
        try {
            refresh();
        } catch (RuntimeException e) {
            log.warn("[fx] refresh failed: {}", e.getMessage());
        }
    }

    public Snapshot refresh() {
        CompletableFuture<JsonNode> fiat = fetch(FIAT_URL);
        CompletableFuture<JsonNode> crypto = fetch(CRYPTO_URL);
        Map<String, Double> next = new LinkedHashMap<>(snapshot.rates());
        int got = 0;
        try {
            JsonNode body = fiat.join();
            if ("success".equals(body.path("result").asString(null)) && body.path("rates").isObject()) {
                for (String code : ref.currencyCodes()) {
                    JsonNode r = body.path("rates").path(code);
                    if (!CRYPTO.contains(code) && r.isNumber() && r.doubleValue() > 0) {
                        next.put(code, r.doubleValue());
                        got++;
                    }
                }
            }
        } catch (RuntimeException e) {
            log.warn("[fx] fiat rates unavailable: {}", rootMessage(e));
        }
        try {
            JsonNode rates = crypto.join().path("data").path("rates");
            for (String code : CRYPTO) {
                double r = parse(rates.path(code).asString(""));
                if (r > 0) {
                    next.put(code, r);
                    got++;
                }
            }
        } catch (RuntimeException e) {
            log.warn("[fx] crypto rates unavailable: {}", rootMessage(e));
        }
        if (got > 0) {
            String now = Instant.now().toString();
            apply(next, now, "live");
            db.sql("""
                    INSERT INTO fx_cache (id, rates, updated_at) VALUES (1, CAST(? AS jsonb), now())
                    ON CONFLICT (id) DO UPDATE SET rates = excluded.rates, updated_at = excluded.updated_at""")
                    .param(mapper.writeValueAsString(snapshot.rates()))
                    .update();
        }
        return snapshot;
    }

    private CompletableFuture<JsonNode> fetch(String url) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10)).header("accept", "application/json").GET().build();
        return http.sendAsync(req, HttpResponse.BodyHandlers.ofString()).thenApply(res -> {
            if (res.statusCode() >= 400) throw new IllegalStateException(url + " → " + res.statusCode());
            return mapper.readTree(res.body());
        });
    }

    private static double parse(String s) {
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String rootMessage(Throwable e) {
        while (e.getCause() != null) e = e.getCause();
        return e.getMessage();
    }
}
