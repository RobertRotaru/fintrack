package com.fintrack.money;

import static org.assertj.core.api.Assertions.assertThat;

import com.fintrack.config.JacksonConfig;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MoneyTest {
    @Test
    void roundsDoublesLikeJavaScriptRoundTo() {
        assertThat(Money.round(1.005, 2)).isEqualByComparingTo("1.01");
        assertThat(Money.round(-1.005, 2)).isEqualByComparingTo("-1.01");
        assertThat(Money.round(2.675, 2)).isEqualByComparingTo("2.68");
        assertThat(Money.round(0.1 + 0.2, 2)).isEqualByComparingTo("0.3");
        assertThat(Money.round(0.000000015, 8)).isEqualByComparingTo("0.00000002");
        assertThat(Money.round2(1234.5678)).isEqualTo(1234.57);
    }

    @Test
    void amountsSerialiseAsPlainNumbersWithoutTrailingZeros() {
        JsonMapper json = JsonMapper.builder().addModule(JacksonConfig.moneyModule()).build();
        String out = json.writeValueAsString(Map.of(
                "a", new BigDecimal("949.50000000"), "b", new BigDecimal("1000000000000.00000000"),
                "c", new BigDecimal("0.00012345"), "d", new BigDecimal("0E-8"), "e", new BigDecimal("-200.00")));
        assertThat(json.readTree(out).get("a").toString()).isEqualTo("949.5");
        assertThat(json.readTree(out).get("b").toString()).isEqualTo("1000000000000");
        assertThat(out).contains("\"c\":0.00012345").contains("\"d\":0").contains("\"e\":-200").doesNotContain("E+");
    }
}
