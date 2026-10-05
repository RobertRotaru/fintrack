package com.fintrack.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.beta.messages.BetaJsonOutputFormat;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.BetaOutputConfig;
import com.anthropic.models.beta.messages.BetaStopReason;
import com.anthropic.models.beta.messages.MessageCreateParams;
import com.fintrack.config.AppProperties;
import com.fintrack.web.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Asks Claude for investing suggestions grounded in an anonymised habit summary. */
@Service
public class InvestmentCoach {
    private static final Logger log = LoggerFactory.getLogger(InvestmentCoach.class);
    static final String NOT_CONFIGURED = "The AI coach is not configured. Set ANTHROPIC_API_KEY for the backend and restart it.";

    static final String SYSTEM = """
            You are the investment-education coach inside a personal finance app.
            You receive an anonymised summary of one user's real money habits (amounts are monthly averages in their base currency, computed from up to 12 months of tracked transactions and current account balances).

            Your job: suggest how this person could start or improve investing, grounded in their actual habits. Be concrete and use their numbers.
            - First judge readiness: high-interest debt (credit cards) should usually be paid down first, and an emergency fund of roughly 3-6 months of expenses should exist before taking market risk. Variable income argues for a bigger buffer.
            - Infer a risk profile from savings rate, income stability, buffer size, and goal deadlines (short-deadline goals belong in low-risk places).
            - monthlyInvestable: a realistic amount they could invest monthly without hurting their buffer or goals; 0 if they should not invest yet.
            - allocation: a generic asset-class mix (e.g. global equity index funds, bonds, cash/high-yield savings, a small crypto slice only if appropriate). Percents must sum to 100. Never name individual stocks, coins, or specific fund tickers.
            - recommendations: 3-6 actionable steps, ordered by priority, each tied to an observed habit (e.g. trimming a category that is a large share of spending to free up money).
            - habitsObserved: 3-5 short factual observations from the data that drove your suggestions.
            - Keep a warm, plain-language tone. Keep the summary to 2-3 sentences.
            - disclaimer: one sentence stating this is educational, not personalised financial advice, and to consult a licensed adviser.""";

    static final Map<String, Object> SCHEMA = Map.of(
            "type", "object",
            "additionalProperties", false,
            "required", List.of("riskProfile", "summary", "readiness", "monthlyInvestable", "allocation", "recommendations", "habitsObserved", "disclaimer"),
            "properties", Map.of(
                    "riskProfile", Map.of("type", "string", "enum", List.of("conservative", "moderate", "growth", "aggressive")),
                    "summary", Map.of("type", "string"),
                    "readiness", Map.of(
                            "type", "object",
                            "additionalProperties", false,
                            "required", List.of("emergencyFundMonths", "status", "explanation"),
                            "properties", Map.of(
                                    "emergencyFundMonths", Map.of("type", "number"),
                                    "status", Map.of("type", "string", "enum", List.of("not-ready", "build-buffer", "ready")),
                                    "explanation", Map.of("type", "string"))),
                    "monthlyInvestable", Map.of("type", "number"),
                    "allocation", Map.of("type", "array", "items", Map.of(
                            "type", "object",
                            "additionalProperties", false,
                            "required", List.of("label", "percent", "rationale"),
                            "properties", Map.of("label", Map.of("type", "string"), "percent", Map.of("type", "number"), "rationale", Map.of("type", "string")))),
                    "recommendations", Map.of("type", "array", "items", Map.of(
                            "type", "object",
                            "additionalProperties", false,
                            "required", List.of("title", "detail", "priority"),
                            "properties", Map.of(
                                    "title", Map.of("type", "string"),
                                    "detail", Map.of("type", "string"),
                                    "priority", Map.of("type", "string", "enum", List.of("high", "medium", "low"))))),
                    "habitsObserved", Map.of("type", "array", "items", Map.of("type", "string")),
                    "disclaimer", Map.of("type", "string")));

    private final AppProperties props;
    private volatile AnthropicClient client;

    public InvestmentCoach(AppProperties props) {
        this.props = props;
    }

    /** Any credential source the SDK resolves from the environment. */
    public boolean configured() {
        return present("ANTHROPIC_API_KEY") || present("ANTHROPIC_AUTH_TOKEN") || present("ANTHROPIC_PROFILE");
    }

    private static boolean present(String name) {
        String v = System.getenv(name);
        return v != null && !v.isBlank();
    }

    private AnthropicClient client() {
        if (client == null) {
            synchronized (this) {
                if (client == null) client = AnthropicOkHttpClient.fromEnv();
            }
        }
        return client;
    }

    /** Returns the model's JSON analysis (text), or throws an {@link ApiException} the UI can show. */
    public String analyse(String summaryJson) {
        Map<String, JsonValue> schema = new LinkedHashMap<>();
        SCHEMA.forEach((key, value) -> schema.put(key, JsonValue.from(value)));
        MessageCreateParams params = MessageCreateParams.builder()
                .model(props.ai().model())
                .maxTokens(16000L)
                .addBeta("server-side-fallback-2026-07-01")
                .fallbacksDefault()
                .system(SYSTEM)
                .outputConfig(BetaOutputConfig.builder()
                        .effort(BetaOutputConfig.Effort.MEDIUM)
                        .format(BetaJsonOutputFormat.builder()
                                .schema(BetaJsonOutputFormat.Schema.builder().putAllAdditionalProperties(schema).build())
                                .build())
                        .build())
                .addUserMessage("Here is my financial habit summary:\n\n" + summaryJson)
                .build();

        BetaMessage response;
        try {
            response = client().beta().messages().create(params);
        } catch (UnauthorizedException | PermissionDeniedException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, NOT_CONFIGURED);
        } catch (RateLimitException e) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "The AI coach is busy — try again in a minute.");
        } catch (AnthropicIoException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Could not reach the AI service.");
        } catch (AnthropicServiceException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI request failed: " + e.getMessage());
        } catch (RuntimeException e) {
            // Raised client-side before any request — almost always missing credentials.
            log.warn("AI coach unavailable: {}", e.toString());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, NOT_CONFIGURED);
        }

        BetaStopReason stop = response.stopReason().orElse(null);
        if (BetaStopReason.REFUSAL.equals(stop)) throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI declined to analyse this data. Try again later.");
        if (BetaStopReason.MAX_TOKENS.equals(stop)) throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI response was cut short. Try again.");
        return response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(text -> text.text())
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_GATEWAY, "The AI returned no analysis."));
    }
}
