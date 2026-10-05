package com.fintrack.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fintrack.web.Body.NumRule;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

class BodyTest {
    private static final JsonMapper JSON = JsonMapper.builder().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).build();

    private static Body body(String json) {
        return Body.of(JSON.readTree(json));
    }

    private static String error(Runnable r) {
        try {
            r.run();
        } catch (ApiException e) {
            return e.getMessage();
        }
        throw new AssertionError("expected a validation error");
    }

    @Test
    void nonObjectBodiesBehaveLikeEmpty() {
        assertThat(Body.of(JSON.readTree("[1,2]")).has("x")).isFalse();
        assertThat(Body.of(JSON.readTree("\"text\"")).nullish("x")).isTrue();
    }

    @Test
    void textIsTrimmedRequiredAndLengthChecked() {
        assertThat(body("{\"n\":\"  Ana  \"}").str("n", "Name", 80)).isEqualTo("Ana");
        assertThat(error(() -> body("{\"n\":\"   \"}").str("n", "Name", 80))).isEqualTo("Name is required");
        assertThat(error(() -> body("{\"n\":null}").str("n", "Name", 80))).isEqualTo("Name is required");
        assertThat(error(() -> body("{\"n\":12345}").str("n", "Email", 80))).isEqualTo("Email must be text");
        assertThat(error(() -> body("{\"n\":\"" + "x".repeat(81) + "\"}").str("n", "Name", 80))).isEqualTo("Name is too long");
        assertThat(body("{}").optStr("n", "Note", 10)).isEmpty();
    }

    @Test
    void numbersAcceptPlainDecimalsAndRoundHalfAwayFromZero() {
        NumRule cents = NumRule.decimals(2);
        assertThat(body("{\"a\":1.005}").num("a", "Amount", cents)).isEqualByComparingTo("1.01");
        assertThat(body("{\"a\":-1.005}").num("a", "Amount", cents)).isEqualByComparingTo("-1.01");
        assertThat(body("{\"a\":\"12.5\"}").num("a", "Amount", cents)).isEqualByComparingTo("12.5");
        assertThat(body("{\"a\":0.00012345}").num("a", "Amount", NumRule.decimals(8))).isEqualByComparingTo("0.00012345");
        assertThat(body("{\"a\":\"  \"}").optNum("a", "Amount", cents)).isNull();
        for (String bad : List.of("true", "\"1e9\"", "\"0x10\"", "\"ten\"", "{}")) {
            assertThat(error(() -> body("{\"a\":" + bad + "}").num("a", "Amount", cents))).as(bad).isEqualTo("Amount must be a number");
        }
        assertThat(error(() -> body("{\"a\":1e13}").num("a", "Amount", cents))).isEqualTo("Amount is too large");
        assertThat(error(() -> body("{\"a\":-1e13}").num("a", "Amount", cents))).isEqualTo("Amount is too small");
        assertThat(error(() -> body("{\"a\":0.004}").num("a", "Amount", cents.min(new BigDecimal("0.01"))))).isEqualTo("Amount must be at least 0.01");
        assertThat(body("{\"a\":1000000000000}").num("a", "Amount", cents)).isEqualByComparingTo("1000000000000");
    }

    @Test
    void datesMustBeRealAndInRange() {
        assertThat(Body.isoDate("2024-02-29", "Date")).isEqualTo(LocalDate.of(2024, 2, 29));
        assertThat(error(() -> Body.isoDate("2026-02-30", "Date"))).isEqualTo("Date is not a real date");
        assertThat(error(() -> Body.isoDate("2026-13-01", "Date"))).isEqualTo("Date is not a real date");
        assertThat(error(() -> Body.isoDate("01/02/2026", "Date"))).isEqualTo("Date must be yyyy-MM-dd");
        assertThat(error(() -> Body.isoDate("1899-12-31", "Date"))).isEqualTo("Date must be between 1970 and 2100");
    }

    @Test
    void coloursIconsAndImagesAreSanitised() {
        assertThat(Body.hexColorValue("#ABCDEF")).isEqualTo("#abcdef");
        assertThat(Body.hexColorValue("#abc")).isEqualTo("#abc");
        assertThatThrownBy(() -> Body.hexColorValue("red;background:url(x)")).isInstanceOf(ApiException.class);
        assertThat(Body.iconNameValue("shopping-cart")).isEqualTo("shopping-cart");
        assertThatThrownBy(() -> Body.iconNameValue("<script>")).isInstanceOf(ApiException.class);
        assertThat(body("{\"i\":\"\"}").image("i")).isNull();
        assertThat(error(() -> body("{\"i\":\"https://x/y.png\"}").image("i"))).isEqualTo("image must be a data URL");
        assertThat(error(() -> body("{\"i\":\"data:image/png;base64," + "A".repeat(400_001) + "\"}").image("i"))).isEqualTo("image is too large");
    }

    @Test
    void truthinessFollowsJavaScript() {
        Body b = body("{\"t\":true,\"f\":false,\"z\":0,\"one\":1,\"e\":\"\",\"s\":\"x\",\"n\":null,\"o\":{}}");
        assertThat(List.of("t", "one", "s", "o")).allMatch(b::truthy);
        assertThat(List.of("f", "z", "e", "n", "missing")).noneMatch(b::truthy);
        assertThat(b.nullish("n")).isTrue();
        assertThat(b.nullish("z")).isFalse();
    }

    @Test
    void choicesAndDefaults() {
        assertThat(body("{}").oneOfOr("c", "RO", "Country", List.of("RO", "DE"))).isEqualTo("RO");
        assertThat(body("{\"c\":null}").oneOfOr("c", "RO", "Country", List.of("RO", "DE"))).isEqualTo("RO");
        assertThat(error(() -> body("{\"c\":\"XX\"}").oneOf("c", "Country", List.of("RO", "DE")))).isEqualTo("Country must be one of RO, DE");
        assertThat(error(() -> body("{\"c\":1}").oneOf("c", "Country", List.of("RO")))).startsWith("Country must be one of");
    }
}
