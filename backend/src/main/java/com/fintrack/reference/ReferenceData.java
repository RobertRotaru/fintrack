package com.fintrack.reference;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Countries, currencies, banks and default categories, loaded from
 * reference.json — generated from the TypeScript @ft/core package, which the
 * web app uses too, so both sides always agree.
 */
@Component
public class ReferenceData {
    public record Currency(String code, double perEur, int decimals) {}

    public record Country(String code, String name, String currency) {}

    public record DefaultCategory(String kind, String name, String icon, String color) {}

    public record Institution(String id, String name, String color, List<String> types) {}

    record File(List<Currency> currencies, List<Country> countries, List<DefaultCategory> defaultCategories,
            Map<String, List<Institution>> institutionsByCountry, List<Institution> globalInstitutions, List<String> discretionaryCategories) {}

    private final Map<String, Currency> currencies = new LinkedHashMap<>();
    private final Map<String, Country> countries = new LinkedHashMap<>();
    private final List<DefaultCategory> defaultCategories;
    private final Map<String, List<Institution>> byCountry;
    private final List<Institution> global;
    private final Set<String> discretionary;

    public ReferenceData(JsonMapper mapper) throws IOException {
        File f;
        try (InputStream in = new ClassPathResource("reference.json").getInputStream()) {
            f = mapper.readValue(in, File.class);
        }
        f.currencies().forEach(c -> currencies.put(c.code(), c));
        f.countries().forEach(c -> countries.put(c.code(), c));
        defaultCategories = List.copyOf(f.defaultCategories());
        byCountry = Map.copyOf(f.institutionsByCountry());
        global = List.copyOf(f.globalInstitutions());
        discretionary = Set.copyOf(f.discretionaryCategories());
    }

    public List<String> currencyCodes() {
        return List.copyOf(currencies.keySet());
    }

    public List<String> countryCodes() {
        return List.copyOf(countries.keySet());
    }

    public Optional<Country> country(String code) {
        return Optional.ofNullable(countries.get(code));
    }

    /** Offline fallback rates, units per 1 EUR. */
    public Map<String, Double> fallbackRates() {
        Map<String, Double> out = new LinkedHashMap<>();
        currencies.values().forEach(c -> out.put(c.code(), c.perEur()));
        return out;
    }

    /** Crypto is tracked to the satoshi; everything else to the cent. */
    public int decimalsFor(String currency) {
        Currency c = currencies.get(currency);
        return c == null ? 2 : c.decimals();
    }

    /** Smallest positive amount representable in {@code currency}. */
    public BigDecimal minUnit(String currency) {
        return BigDecimal.ONE.movePointLeft(decimalsFor(currency));
    }

    public List<DefaultCategory> defaultCategories() {
        return defaultCategories;
    }

    public Optional<Institution> findInstitution(String id) {
        if (id == null || id.isEmpty()) return Optional.empty();
        for (List<Institution> list : byCountry.values()) {
            for (Institution i : list) if (i.id().equals(id)) return Optional.of(i);
        }
        return global.stream().filter(i -> i.id().equals(id)).findFirst();
    }

    /** Institutions offered for an account of {@code type} (or any type when null) in {@code country}. */
    public List<Institution> institutionsFor(String country, String type) {
        List<Institution> list = new ArrayList<>(byCountry.getOrDefault(country, List.of()));
        list.addAll(global);
        return type == null ? list : list.stream().filter(i -> i.types().contains(type)).toList();
    }

    public boolean isDiscretionary(String category) {
        return discretionary.contains(category);
    }
}
