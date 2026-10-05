package com.fintrack.importer;

import com.fintrack.money.Money;
import com.fintrack.reference.ReferenceData;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Copies a database from the previous Node/SQLite backend (finance.db) into
 * PostgreSQL, preserving ids, passwords (bcrypt hashes) and history:
 * text ids become UUIDs, floating-point amounts become exact decimals at each
 * currency's precision, text timestamps become real ones (SQLite's
 * datetime('now') is UTC). Runs in one transaction into an empty database.
 */
@Service
public class SqliteImporter {
    private static final Logger log = LoggerFactory.getLogger(SqliteImporter.class);
    private static final DateTimeFormatter SQLITE_TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** Tables in foreign-key order. */
    static final String[] TABLES = {"users", "households", "household_members", "accounts", "categories", "transactions", "transfers",
        "goals", "goal_contributions", "ai_reports", "fx_cache"};

    private final JdbcClient db;
    private final ReferenceData ref;

    public SqliteImporter(JdbcClient db, ReferenceData ref) {
        this.db = db;
        this.ref = ref;
    }

    @FunctionalInterface
    private interface RowHandler {
        void accept(ResultSet rs) throws SQLException;
    }

    @Transactional
    public Map<String, Integer> importFrom(Path file) throws SQLException {
        if (!Files.isRegularFile(file)) throw new IllegalArgumentException("No SQLite database at " + file);
        if (db.sql("SELECT COUNT(*) FROM users").query(Long.class).single() > 0) {
            throw new IllegalStateException("The PostgreSQL database already has users - import only into an empty database.");
        }
        Map<String, Integer> counts = new LinkedHashMap<>();
        try (Connection sqlite = DriverManager.getConnection("jdbc:sqlite:" + file.toAbsolutePath() + "?open_mode=1")) {
            // Currencies decide how many decimals each amount keeps.
            Map<String, String> accountCurrency = new HashMap<>();
            Map<String, String> goalCurrency = new HashMap<>();

            counts.put("users", copy(sqlite, "SELECT * FROM users", rs -> db.sql("""
                    INSERT INTO users (id, email, name, password_hash, base_currency, country, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""")
                    .params(uuid(rs, "id"), rs.getString("email").toLowerCase(), rs.getString("name"), rs.getString("password_hash"),
                            rs.getString("base_currency"), rs.getString("country"), ts(rs, "created_at"))
                    .update()));
            counts.put("households", copy(sqlite, "SELECT * FROM households", rs -> db.sql("""
                    INSERT INTO households (id, name, invite_code, created_by, created_at) VALUES (?, ?, ?, ?, ?)""")
                    .params(uuid(rs, "id"), rs.getString("name"), rs.getString("invite_code"), uuid(rs, "created_by"), ts(rs, "created_at"))
                    .update()));
            counts.put("household_members", copy(sqlite, "SELECT * FROM household_members", rs -> db.sql("""
                    INSERT INTO household_members (household_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)""")
                    .params(uuid(rs, "household_id"), uuid(rs, "user_id"), rs.getString("role"), ts(rs, "joined_at"))
                    .update()));
            counts.put("accounts", copy(sqlite, "SELECT * FROM accounts", rs -> {
                String currency = rs.getString("currency");
                accountCurrency.put(rs.getString("id"), currency);
                db.sql("""
                        INSERT INTO accounts (id, owner_id, household_id, type, name, institution_id, institution_name, country, currency, color,
                          icon, image, initial_balance, credit_limit, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                        .params(uuid(rs, "id"), uuid(rs, "owner_id"), uuid(rs, "household_id"), rs.getString("type"), rs.getString("name"),
                                rs.getString("institution_id"), rs.getString("institution_name"), rs.getString("country"), currency,
                                rs.getString("color"), rs.getString("icon"), rs.getString("image"), money(rs, "initial_balance", currency),
                                money(rs, "credit_limit", "EUR"), rs.getInt("archived") != 0, ts(rs, "created_at"))
                        .update();
            }));
            counts.put("categories", copy(sqlite, "SELECT * FROM categories", rs -> db.sql("""
                    INSERT INTO categories (id, user_id, kind, name, icon, color, is_default, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""")
                    .params(uuid(rs, "id"), uuid(rs, "user_id"), rs.getString("kind"), rs.getString("name"), rs.getString("icon"),
                            rs.getString("color"), rs.getInt("is_default") != 0, rs.getInt("archived") != 0)
                    .update()));
            counts.put("transactions", copy(sqlite, "SELECT * FROM transactions", rs -> db.sql("""
                    INSERT INTO transactions (id, account_id, user_id, kind, amount, category_id, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                    .params(uuid(rs, "id"), uuid(rs, "account_id"), uuid(rs, "user_id"), rs.getString("kind"),
                            money(rs, "amount", accountCurrency.get(rs.getString("account_id"))), uuid(rs, "category_id"), date(rs, "date"),
                            rs.getString("note"), ts(rs, "created_at"))
                    .update()));
            counts.put("transfers", copy(sqlite, "SELECT * FROM transfers", rs -> db.sql("""
                    INSERT INTO transfers (id, user_id, from_account_id, to_account_id, amount, to_amount, date, note, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                    .params(uuid(rs, "id"), uuid(rs, "user_id"), uuid(rs, "from_account_id"), uuid(rs, "to_account_id"),
                            money(rs, "amount", accountCurrency.get(rs.getString("from_account_id"))),
                            money(rs, "to_amount", accountCurrency.get(rs.getString("to_account_id"))), date(rs, "date"), rs.getString("note"),
                            ts(rs, "created_at"))
                    .update()));
            counts.put("goals", copy(sqlite, "SELECT * FROM goals", rs -> {
                String currency = rs.getString("currency");
                goalCurrency.put(rs.getString("id"), currency);
                db.sql("""
                        INSERT INTO goals (id, user_id, household_id, name, target_amount, currency, deadline, icon, color, image, created_at, completed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                        .params(uuid(rs, "id"), uuid(rs, "user_id"), uuid(rs, "household_id"), rs.getString("name"),
                                money(rs, "target_amount", currency), currency, date(rs, "deadline"), rs.getString("icon"), rs.getString("color"),
                                rs.getString("image"), ts(rs, "created_at"), ts(rs, "completed_at"))
                        .update();
            }));
            counts.put("goal_contributions", copy(sqlite, "SELECT * FROM goal_contributions", rs -> db.sql("""
                    INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)""")
                    .params(uuid(rs, "id"), uuid(rs, "goal_id"), uuid(rs, "user_id"), money(rs, "amount", goalCurrency.get(rs.getString("goal_id"))),
                            date(rs, "date"), rs.getString("note"))
                    .update()));
            counts.put("ai_reports", copy(sqlite, "SELECT * FROM ai_reports", rs -> db.sql("""
                    INSERT INTO ai_reports (id, user_id, kind, payload, created_at) VALUES (?, ?, ?, CAST(? AS jsonb), ?)""")
                    .params(uuid(rs, "id"), uuid(rs, "user_id"), rs.getString("kind"), rs.getString("payload"), ts(rs, "created_at"))
                    .update()));
            counts.put("fx_cache", tableExists(sqlite, "fx_cache") ? copy(sqlite, "SELECT * FROM fx_cache", rs -> db.sql("""
                    INSERT INTO fx_cache (id, rates, updated_at) VALUES (1, CAST(? AS jsonb), ?)""")
                    .params(rs.getString("rates"), ts(rs, "updated_at"))
                    .update()) : 0);
        }
        // Verify: every row arrived.
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            long n = db.sql("SELECT COUNT(*) FROM " + e.getKey()).query(Long.class).single();
            if (n != e.getValue()) throw new IllegalStateException(e.getKey() + ": copied " + e.getValue() + " rows but found " + n);
        }
        log.info("Imported {}", counts);
        return counts;
    }

    private static int copy(Connection sqlite, String sql, RowHandler handler) throws SQLException {
        int n = 0;
        try (Statement st = sqlite.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                handler.accept(rs);
                n++;
            }
        }
        return n;
    }

    private static boolean tableExists(Connection sqlite, String table) throws SQLException {
        try (var st = sqlite.prepareStatement("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")) {
            st.setString(1, table);
            try (ResultSet rs = st.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static UUID uuid(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);
        return v == null ? null : UUID.fromString(v);
    }

    private static LocalDate date(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);
        return v == null ? null : LocalDate.parse(v.substring(0, 10));
    }

    /** SQLite's datetime('now') ("2026-10-05 06:49:12", UTC) or an ISO-8601 instant. */
    static OffsetDateTime ts(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);
        if (v == null) return null;
        if (v.contains("T")) return Instant.parse(v).atOffset(ZoneOffset.UTC);
        return LocalDateTime.parse(v.substring(0, 19), SQLITE_TS).atOffset(ZoneOffset.UTC);
    }

    /** REAL → exact decimal at the currency's precision (via the shortest decimal form, like JavaScript did). */
    private BigDecimal money(ResultSet rs, String col, String currency) throws SQLException {
        double v = rs.getDouble(col);
        if (rs.wasNull()) return null;
        return Money.round(v, ref.decimalsFor(currency == null ? "EUR" : currency));
    }
}
