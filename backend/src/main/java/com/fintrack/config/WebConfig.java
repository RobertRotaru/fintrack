package com.fintrack.config;

import com.fintrack.web.BodyArgumentResolver;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import tools.jackson.databind.json.JsonMapper;

@Configuration
@ConditionalOnWebApplication
public class WebConfig implements WebMvcConfigurer {
    private final JsonMapper mapper;

    public WebConfig(JsonMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new BodyArgumentResolver(mapper));
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration cors = new CorsConfiguration();
        List<String> origins = props.corsOrigins() == null ? List.of() : props.corsOrigins().stream().map(String::strip).filter(s -> !s.isEmpty()).toList();
        if (origins.isEmpty()) cors.addAllowedOriginPattern("*");
        else cors.setAllowedOrigins(origins);
        cors.setAllowedMethods(List.of("GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"));
        cors.addAllowedHeader("*");
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }
}
