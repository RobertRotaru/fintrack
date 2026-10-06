package com.fintrack.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.env.MockEnvironment;

/** Heroku-style DATABASE_URL → the DB_URL / DB_USER / DB_PASSWORD the datasource reads. */
class DatabaseUrlEnvironmentTest {

    @Test
    void convertsAHerokuUrlAndRequiresTls() {
        assertThat(DatabaseUrlEnvironment.fromDatabaseUrl("postgres://u1abc:p%40ss@ec2-1-2-3-4.eu-west-1.compute.amazonaws.com:5432/d9xyz"))
                .containsExactly(
                        Map.entry("DB_URL", "jdbc:postgresql://ec2-1-2-3-4.eu-west-1.compute.amazonaws.com:5432/d9xyz?sslmode=require"),
                        Map.entry("DB_USER", "u1abc"),
                        Map.entry("DB_PASSWORD", "p@ss"));
    }

    @Test
    void keepsAnSslmodeTheUrlAlreadyHas() {
        assertThat(DatabaseUrlEnvironment.fromDatabaseUrl("postgresql://u:p@db.example.com/app?sslmode=disable").get("DB_URL"))
                .isEqualTo("jdbc:postgresql://db.example.com/app?sslmode=disable");
    }

    @Test
    void rejectsOtherDatabases() {
        assertThatThrownBy(() -> DatabaseUrlEnvironment.fromDatabaseUrl("mysql://u:p@h/db")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void appliesOnlyWhenDbUrlIsNotSet() {
        var env = new MockEnvironment().withProperty("DATABASE_URL", "postgres://u:p@h:5432/db");
        new DatabaseUrlEnvironment().postProcessEnvironment(env, null);
        assertThat(env.getProperty("DB_URL")).isEqualTo("jdbc:postgresql://h:5432/db?sslmode=require");
        assertThat(env.getProperty("DB_PASSWORD")).isEqualTo("p");

        var explicit = new MockEnvironment().withProperty("DATABASE_URL", "postgres://u:p@h:5432/db").withProperty("DB_URL", "jdbc:postgresql://mine/db");
        new DatabaseUrlEnvironment().postProcessEnvironment(explicit, null);
        assertThat(explicit.getProperty("DB_URL")).isEqualTo("jdbc:postgresql://mine/db");
        assertThat(explicit.getPropertySources().stream().noneMatch(s -> s instanceof MapPropertySource m && m.getName().equals("databaseUrl"))).isTrue();
    }
}
