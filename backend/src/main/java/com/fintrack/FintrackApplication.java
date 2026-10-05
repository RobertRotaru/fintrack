package com.fintrack;

import java.util.Arrays;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class FintrackApplication {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(FintrackApplication.class);
        // The one-off SQLite import runs without the web server.
        if (Arrays.stream(args).anyMatch(a -> a.startsWith("--import-sqlite="))) app.setWebApplicationType(WebApplicationType.NONE);
        app.run(args);
    }
}
