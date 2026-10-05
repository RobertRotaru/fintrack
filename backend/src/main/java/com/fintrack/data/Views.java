package com.fintrack.data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** The JSON shapes the API returns — identical to the web app's types in @ft/core. */
public final class Views {
    private Views() {}

    public record User(UUID id, String email, String name, String baseCurrency, String country, String createdAt) {}

    public record Account(UUID id, UUID ownerId, UUID householdId, String type, String name, String institutionId, String institutionName,
            String country, String currency, String color, String icon, String image, BigDecimal initialBalance, BigDecimal creditLimit,
            boolean archived, String createdAt, BigDecimal balance) {}

    public record Category(UUID id, UUID userId, String kind, String name, String icon, String color, boolean isDefault, boolean archived) {}

    public record Transaction(UUID id, UUID accountId, UUID userId, String kind, BigDecimal amount, String currency, UUID categoryId,
            String categoryName, String categoryColor, String categoryIcon, String date, String note, String createdAt) {}

    public record Transfer(UUID id, UUID userId, UUID fromAccountId, UUID toAccountId, BigDecimal amount, BigDecimal toAmount, String date,
            String note, String createdAt) {}

    public record Contribution(UUID id, UUID goalId, UUID userId, BigDecimal amount, String date, String note) {}

    public record Goal(UUID id, UUID userId, UUID householdId, String name, BigDecimal targetAmount, String currency, String deadline, String icon,
            String color, String image, String createdAt, String completedAt, BigDecimal saved, List<Contribution> contributions) {}

    public record Member(UUID userId, String name, String email, String role, String joinedAt) {}

    public record Household(UUID id, String name, String inviteCode, UUID createdBy, String createdAt, List<Member> members) {}
}
