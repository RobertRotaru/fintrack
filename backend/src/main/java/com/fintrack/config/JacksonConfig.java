package com.fintrack.config;

import java.math.BigDecimal;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.ser.std.StdSerializer;

@Configuration
public class JacksonConfig {
    /** Amounts leave as plain JSON numbers without trailing zeros: 949.5, not 949.50000000 or 9.495E+2. */
    @Bean
    public static SimpleModule moneyModule() {
        return new SimpleModule("money").addSerializer(BigDecimal.class, new StdSerializer<>(BigDecimal.class) {
            @Override
            public void serialize(BigDecimal value, JsonGenerator gen, SerializationContext ctx) {
                gen.writeNumber(value.signum() == 0 ? "0" : value.stripTrailingZeros().toPlainString());
            }
        });
    }
}
