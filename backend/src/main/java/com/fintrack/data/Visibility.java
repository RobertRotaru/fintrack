package com.fintrack.data;

import com.fintrack.money.Money;
import com.fintrack.reference.ReferenceData;
import com.fintrack.storage.ObjectStorage;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Who can see what. A user sees their own accounts and goals plus anything
 * shared into their family (household); transactions and transfers follow the
 * accounts they belong to.
 */
@Repository
public class Visibility {
    /** Accounts visible to :me, given :hh = their household (or null). */
    static final String VISIBLE = "(a.owner_id = :me OR (a.household_id IS NOT NULL AND a.household_id = CAST(:hh AS uuid)))";

    private static final String ACCOUNT_SELECT = """
            SELECT a.*,
              COALESCE((SELECT SUM(CASE WHEN t.kind = 'income' THEN t.amount ELSE -t.amount END) FROM transactions t WHERE t.account_id = a.id), 0)
              + COALESCE((SELECT SUM(x.to_amount) FROM transfers x WHERE x.to_account_id = a.id), 0)
              - COALESCE((SELECT SUM(x.amount) FROM transfers x WHERE x.from_account_id = a.id), 0) AS flow
            FROM accounts a""";

    private static final String TX_SELECT = """
            SELECT t.*, a.currency, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
            FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN categories c ON c.id = t.category_id""";

    private final JdbcClient db;
    private final ReferenceData ref;
    private final ObjectStorage storage;

    public Visibility(JdbcClient db, ReferenceData ref, ObjectStorage storage) {
        this.storage = storage;
        this.db = db;
        this.ref = ref;
    }

    // --- mapping helpers ---------------------------------------------------

    public static String ts(ResultSet rs, String col) throws SQLException {
        OffsetDateTime t = rs.getObject(col, OffsetDateTime.class);
        return t == null ? null : t.toInstant().toString();
    }

    public static String date(ResultSet rs, String col) throws SQLException {
        LocalDate d = rs.getObject(col, LocalDate.class);
        return d == null ? null : d.toString();
    }

    public static UUID uuid(ResultSet rs, String col) throws SQLException {
        return rs.getObject(col, UUID.class);
    }

    public Views.User user(ResultSet rs) throws SQLException {
        String avatar = rs.getString("avatar_key");
        return new Views.User(uuid(rs, "id"), rs.getString("email"), rs.getString("name"), rs.getString("base_currency"), rs.getString("country"), ts(rs, "created_at"),
                rs.getString("bio"), avatar == null ? null : storage.publicUrl(avatar));
    }

    public static Views.Category category(ResultSet rs) throws SQLException {
        return new Views.Category(uuid(rs, "id"), uuid(rs, "user_id"), rs.getString("kind"), rs.getString("name"), rs.getString("icon"), rs.getString("color"),
                rs.getBoolean("is_default"), rs.getBoolean("archived"));
    }

    private Views.Account account(ResultSet rs) throws SQLException {
        String currency = rs.getString("currency");
        BigDecimal balance = rs.getBigDecimal("initial_balance").add(rs.getBigDecimal("flow"));
        return new Views.Account(uuid(rs, "id"), uuid(rs, "owner_id"), uuid(rs, "household_id"), rs.getString("type"), rs.getString("name"),
                rs.getString("institution_id"), rs.getString("institution_name"), rs.getString("country"), currency, rs.getString("color"),
                rs.getString("icon"), rs.getString("image"), rs.getBigDecimal("initial_balance"), rs.getBigDecimal("credit_limit"),
                rs.getBoolean("archived"), ts(rs, "created_at"), Money.round(balance, ref.decimalsFor(currency)));
    }

    private static Views.Transaction transaction(ResultSet rs) throws SQLException {
        return new Views.Transaction(uuid(rs, "id"), uuid(rs, "account_id"), uuid(rs, "user_id"), rs.getString("kind"), rs.getBigDecimal("amount"),
                rs.getString("currency"), uuid(rs, "category_id"), rs.getString("category_name"), rs.getString("category_color"),
                rs.getString("category_icon"), date(rs, "date"), rs.getString("note"), ts(rs, "created_at"));
    }

    private static Views.Transfer transfer(ResultSet rs) throws SQLException {
        return new Views.Transfer(uuid(rs, "id"), uuid(rs, "user_id"), uuid(rs, "from_account_id"), uuid(rs, "to_account_id"), rs.getBigDecimal("amount"),
                rs.getBigDecimal("to_amount"), date(rs, "date"), rs.getString("note"), ts(rs, "created_at"));
    }

    private static Views.Contribution contribution(ResultSet rs) throws SQLException {
        return new Views.Contribution(uuid(rs, "id"), uuid(rs, "goal_id"), uuid(rs, "user_id"), rs.getBigDecimal("amount"), date(rs, "date"), rs.getString("note"));
    }

    // --- queries -----------------------------------------------------------

    public Optional<Views.User> user(UUID id) {
        return db.sql("SELECT * FROM users WHERE id = ?").param(id).query((rs, i) -> user(rs)).optional();
    }

    public UUID householdIdOf(UUID userId) {
        return db.sql("SELECT household_id FROM household_members WHERE user_id = ?").param(userId).query(UUID.class).optional().orElse(null);
    }

    public List<Views.Account> visibleAccounts(UUID me) {
        return db.sql(ACCOUNT_SELECT + " WHERE " + VISIBLE + " ORDER BY a.archived, a.created_at")
                .param("me", me).param("hh", householdIdOf(me))
                .query((rs, i) -> account(rs)).list();
    }

    public Optional<Views.Account> visibleAccount(UUID me, UUID accountId) {
        if (accountId == null) return Optional.empty();
        return db.sql(ACCOUNT_SELECT + " WHERE a.id = :id AND " + VISIBLE)
                .param("id", accountId).param("me", me).param("hh", householdIdOf(me))
                .query((rs, i) -> account(rs)).optional();
    }

    public List<Views.Transaction> visibleTransactions(UUID me, LocalDate from, LocalDate to, UUID accountId) {
        StringBuilder sql = new StringBuilder(TX_SELECT).append(" WHERE ").append(VISIBLE);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("me", me);
        params.put("hh", householdIdOf(me));
        if (from != null) {
            sql.append(" AND t.date >= :from");
            params.put("from", from);
        }
        if (to != null) {
            sql.append(" AND t.date <= :to");
            params.put("to", to);
        }
        if (accountId != null) {
            sql.append(" AND t.account_id = :account");
            params.put("account", accountId);
        }
        sql.append(" ORDER BY t.date DESC, t.created_at DESC");
        return db.sql(sql.toString()).params(params).query((rs, i) -> transaction(rs)).list();
    }

    public Optional<Views.Transaction> transaction(UUID id) {
        if (id == null) return Optional.empty();
        return db.sql(TX_SELECT + " WHERE t.id = ?").param(id).query((rs, i) -> transaction(rs)).optional();
    }

    public List<Views.Transfer> visibleTransfers(UUID me) {
        return db.sql("""
                SELECT x.* FROM transfers x
                JOIN accounts a ON a.id = x.from_account_id JOIN accounts b ON b.id = x.to_account_id
                WHERE (a.owner_id = :me OR (a.household_id IS NOT NULL AND a.household_id = CAST(:hh AS uuid)))
                   OR (b.owner_id = :me OR (b.household_id IS NOT NULL AND b.household_id = CAST(:hh AS uuid)))
                ORDER BY x.date DESC, x.created_at DESC""")
                .param("me", me).param("hh", householdIdOf(me))
                .query((rs, i) -> transfer(rs)).list();
    }

    public List<Views.Goal> visibleGoals(UUID me) {
        record Row(UUID id, UUID userId, UUID householdId, String name, BigDecimal target, String currency, String deadline, String icon,
                String color, String image, String createdAt, String completedAt) {}
        List<Row> rows = db.sql("""
                SELECT * FROM goals WHERE user_id = :me OR (household_id IS NOT NULL AND household_id = CAST(:hh AS uuid))
                ORDER BY completed_at IS NOT NULL, created_at""")
                .param("me", me).param("hh", householdIdOf(me))
                .query((rs, i) -> new Row(uuid(rs, "id"), uuid(rs, "user_id"), uuid(rs, "household_id"), rs.getString("name"),
                        rs.getBigDecimal("target_amount"), rs.getString("currency"), date(rs, "deadline"), rs.getString("icon"),
                        rs.getString("color"), rs.getString("image"), ts(rs, "created_at"), ts(rs, "completed_at")))
                .list();
        if (rows.isEmpty()) return List.of();
        Map<UUID, List<Views.Contribution>> byGoal = new LinkedHashMap<>();
        db.sql("SELECT * FROM goal_contributions WHERE goal_id = ANY(:ids) ORDER BY date DESC, id")
                .param("ids", rows.stream().map(Row::id).toArray(UUID[]::new))
                .query((rs, i) -> contribution(rs)).list()
                .forEach(c -> byGoal.computeIfAbsent(c.goalId(), k -> new ArrayList<>()).add(c));
        return rows.stream().map(g -> {
            List<Views.Contribution> cs = byGoal.getOrDefault(g.id(), List.of());
            BigDecimal saved = cs.stream().map(Views.Contribution::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
            return new Views.Goal(g.id(), g.userId(), g.householdId(), g.name(), g.target(), g.currency(), g.deadline(), g.icon(), g.color(), g.image(),
                    g.createdAt(), g.completedAt(), Money.round(saved, ref.decimalsFor(g.currency())), List.copyOf(cs));
        }).toList();
    }

    public Optional<Views.Household> household(UUID me) {
        UUID hh = householdIdOf(me);
        if (hh == null) return Optional.empty();
        List<Views.Member> members = db.sql("""
                SELECT m.user_id, m.role, m.joined_at, u.name, u.email, u.bio, u.avatar_key FROM household_members m JOIN users u ON u.id = m.user_id
                WHERE m.household_id = ? ORDER BY m.joined_at""")
                .param(hh)
                .query((rs, i) -> {
                    String avatar = rs.getString("avatar_key");
                    return new Views.Member(uuid(rs, "user_id"), rs.getString("name"), rs.getString("email"), rs.getString("role"), ts(rs, "joined_at"),
                            rs.getString("bio"), avatar == null ? null : storage.publicUrl(avatar));
                })
                .list();
        return db.sql("SELECT * FROM households WHERE id = ?").param(hh)
                .query((rs, i) -> new Views.Household(uuid(rs, "id"), rs.getString("name"), rs.getString("invite_code"), uuid(rs, "created_by"),
                        ts(rs, "created_at"), members))
                .optional();
    }
}
