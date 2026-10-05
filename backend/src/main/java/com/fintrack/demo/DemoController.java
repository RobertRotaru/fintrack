package com.fintrack.demo;

import com.fintrack.reference.ReferenceData;
import com.fintrack.web.ApiException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Fills an empty profile with ~13 months of realistic activity so reports,
 * insights and projections have something to show. Only allowed when the user
 * has no accounts or transactions yet. Deterministic: the same seed every time.
 */
@RestController
@RequestMapping("/api/demo")
public class DemoController {
    private final JdbcClient db;
    private final ReferenceData ref;
    private final Clock clock;

    public DemoController(JdbcClient db, ReferenceData ref, Clock clock) {
        this.db = db;
        this.ref = ref;
        this.clock = clock;
    }

    /** Same linear congruential generator as before, so demo data is unchanged. */
    static final class Rng {
        private long seed;

        Rng(long seed) {
            this.seed = seed;
        }

        double next() {
            seed = (seed * 1664525 + 1013904223) % 4294967296L;
            return seed / 4294967296.0;
        }
    }

    private record Tx(UUID account, String kind, BigDecimal amount, UUID category, LocalDate date, String note) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> seed(@AuthenticationPrincipal UUID me) {
        boolean hasData = db.sql("SELECT 1 FROM transactions WHERE user_id = ? LIMIT 1").param(me).query().optionalValue().isPresent()
                || db.sql("SELECT 1 FROM accounts WHERE owner_id = ? LIMIT 1").param(me).query().optionalValue().isPresent();
        if (hasData) throw ApiException.conflict("Demo data can only be loaded into an empty profile.");
        record U(String currency, String country) {}
        U user = db.sql("SELECT base_currency, country FROM users WHERE id = ?").param(me)
                .query((rs, i) -> new U(rs.getString("base_currency"), rs.getString("country"))).single();
        String currency = user.currency();
        String country = user.country();
        double k = ref.fallbackRates().getOrDefault(currency, 1.0); // amounts below are in EUR
        Rng rand = new Rng(42);

        // Use the user's active categories; recreate any default the demo needs that was deleted or archived.
        Map<String, UUID> cats = new HashMap<>();
        db.sql("SELECT id, kind, name FROM categories WHERE user_id = ? AND NOT archived").param(me)
                .query((rs, i) -> Map.entry(rs.getString("kind") + ":" + rs.getString("name"), rs.getObject("id", UUID.class)))
                .list().forEach(e -> cats.putIfAbsent(e.getKey(), e.getValue()));
        java.util.function.BiFunction<String, String, UUID> cat = (kind, name) -> cats.computeIfAbsent(kind + ":" + name, key -> {
            ReferenceData.DefaultCategory def = ref.defaultCategories().stream().filter(c -> c.kind().equals(kind) && c.name().equals(name)).findFirst().orElseThrow();
            UUID id = UUID.randomUUID();
            db.sql("INSERT INTO categories (id, user_id, kind, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?, ?, TRUE)")
                    .params(id, me, kind, name, def.icon(), def.color()).update();
            return id;
        });

        List<ReferenceData.Institution> banks = ref.institutionsFor(country, "debit");
        ReferenceData.Institution main = banks.isEmpty() ? null : banks.getFirst();
        List<ReferenceData.Institution> all = new ArrayList<>(banks);
        all.addAll(ref.institutionsFor(country, null));
        Map<String, UUID> accounts = new HashMap<>();
        Demo d = new Demo(me, currency, country, k, rand, cat, accounts, all);

        LocalDate today = LocalDate.now(clock);
        String mainId = main == null ? null : main.id();
        d.account("main", "debit", "Everyday", mainId, main == null ? "#6366f1" : main.color(), "wallet", Math.round(1800 * k), null);
        d.account("credit", "credit", "Rewards card", mainId, "#0f172a", "wallet-cards", 0, (double) Math.round(3000 * k));
        d.account("savings", "savings", "Rainy day fund", mainId, "#10b981", "piggy-bank", Math.round(6500 * k), null);
        d.account("invest", "investment", "Index portfolio", "trading212", "#1B9CFC", "trending-up", Math.round(4200 * k), null);
        d.account("cash", "cash", "Wallet cash", null, "#84cc16", "banknote", Math.round(80 * k), null);

        YearMonth start = YearMonth.from(today).minusMonths(12);
        int i = 0;
        for (YearMonth m = start; !m.isAfter(YearMonth.from(today)); m = m.plusMonths(1), i++) {
            d.month(m, i, today);
        }
        for (Tx t : d.txs) {
            db.sql("INSERT INTO transactions (id, account_id, user_id, kind, amount, category_id, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                    .params(UUID.randomUUID(), t.account(), me, t.kind(), t.amount(), t.category(), t.date(), t.note()).update();
        }
        d.goal("PlayStation 5", 550, null, "gamepad-2", "#3b82f6", new int[] {120, 100, 90}, today);
        d.goal("New car", 18000, today.plusDays(540), "car", "#ef4444", new int[] {3000, 400, 450, 500, 400, 500}, today);
        d.goal("Japan trip", 4000, today.plusDays(300), "plane", "#ec4899", new int[] {500, 250, 250}, today);
        return Map.of("ok", true, "transactions", d.txs.size());
    }

    /** One run of the generator; mirrors the original script step by step. */
    private final class Demo {
        final UUID me;
        final String currency;
        final String country;
        final double k;
        final Rng rand;
        final java.util.function.BiFunction<String, String, UUID> cat;
        final Map<String, UUID> accounts;
        final List<ReferenceData.Institution> institutions;
        final List<Tx> txs = new ArrayList<>();
        final Map<YearMonth, Double> creditSpent = new HashMap<>();
        LocalDate today;

        Demo(UUID me, String currency, String country, double k, Rng rand, java.util.function.BiFunction<String, String, UUID> cat,
                Map<String, UUID> accounts, List<ReferenceData.Institution> institutions) {
            this.me = me;
            this.currency = currency;
            this.country = country;
            this.k = k;
            this.rand = rand;
            this.cat = cat;
            this.accounts = accounts;
            this.institutions = institutions;
        }

        double between(double a, double b) {
            return Math.round((a + rand.next() * (b - a)) * k * 100) / 100.0;
        }

        void account(String key, String type, String name, String instId, String color, String icon, double initial, Double creditLimit) {
            UUID id = UUID.randomUUID();
            String instName = instId == null ? null : institutions.stream().filter(b -> b.id().equals(instId)).map(ReferenceData.Institution::name).findFirst().orElse(null);
            db.sql("""
                    INSERT INTO accounts (id, owner_id, type, name, institution_id, institution_name, country, currency, color, icon, initial_balance, credit_limit)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                    .params(id, me, type, name, instId, instName, country, currency, color, icon, BigDecimal.valueOf(initial),
                            creditLimit == null ? null : BigDecimal.valueOf(creditLimit))
                    .update();
            accounts.put(key, id);
        }

        void add(String acct, String kind, double amount, String category, LocalDate date, String note) {
            if (date.isAfter(today)) return;
            if (acct.equals("credit")) creditSpent.merge(YearMonth.from(date), amount, Double::sum);
            txs.add(new Tx(accounts.get(acct), kind, BigDecimal.valueOf(amount), cat.apply(kind, category), date, note));
        }

        void transfer(String from, String to, double amount, LocalDate date, String note) {
            if (date.isAfter(today)) return;
            BigDecimal a = BigDecimal.valueOf(amount);
            db.sql("INSERT INTO transfers (id, user_id, from_account_id, to_account_id, amount, to_amount, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                    .params(UUID.randomUUID(), me, accounts.get(from), accounts.get(to), a, a, date, note).update();
        }

        void month(YearMonth m, int i, LocalDate today) {
            this.today = today;
            int dim = m.lengthOfMonth();
            java.util.function.IntFunction<LocalDate> d = day -> m.atDay(Math.min(day, dim));
            java.util.function.Supplier<LocalDate> anyDay = () -> d.apply(1 + (int) Math.floor(rand.next() * dim));
            int month = m.getMonthValue();
            boolean recent = i >= 10; // the last ~3 months drift a bit to give insights something to find

            add("main", "income", Math.round((i >= 7 ? 3450 : 3200) * k), "Salary", d.apply(10), "Monthly salary");
            if (month == 12 || month == 6) add("main", "income", Math.round(1500 * k), "Bonus", d.apply(20), "Performance bonus");
            if (rand.next() < 0.45) add("main", "income", between(250, 900), "Freelance", anyDay.get(), "Side project");
            add("savings", "income", between(12, 18), "Interest", d.apply(28), "Savings interest");
            if (rand.next() < 0.15) add("main", "income", between(20, 120), "Refunds", anyDay.get(), "Return");

            add("main", "expense", Math.round(900 * k), "Housing", d.apply(1), "Rent");
            boolean winter = month == 1 || month == 2 || month == 11 || month == 12;
            add("main", "expense", between(winter ? 140 : 70, winter ? 190 : 100), "Utilities", d.apply(18), "Electricity & gas");
            add("main", "expense", Math.round(35 * k), "Internet & Phone", d.apply(15), "Internet & mobile");
            add("credit", "expense", Math.round(13.99 * k * 100) / 100.0, "Subscriptions", d.apply(5), "Netflix");
            add("credit", "expense", Math.round(10.99 * k * 100) / 100.0, "Subscriptions", d.apply(12), "Spotify");
            add("main", "expense", Math.round(40 * k), "Sports & Fitness", d.apply(3), "Gym membership");
            add("main", "expense", Math.round(55 * k), "Insurance", d.apply(25), "Health insurance");

            for (int n = 0; n < 6 + (int) Math.floor(rand.next() * 4); n++) add(rand.next() < 0.7 ? "main" : "credit", "expense", between(25, 110), "Groceries", anyDay.get(), null);
            for (int n = 0; n < (recent ? 9 : 5) + (int) Math.floor(rand.next() * 4); n++) add("credit", "expense", between(14, recent ? 70 : 50), "Dining Out", anyDay.get(), null);
            for (int n = 0; n < 8 + (int) Math.floor(rand.next() * 8); n++) add("cash", "expense", between(2.5, 6), "Coffee & Snacks", anyDay.get(), null);
            for (int n = 0; n < 6; n++) add("main", "expense", between(2, 14), "Transport", anyDay.get(), null);
            for (int n = 0; n < 2 + (int) Math.floor(rand.next() * 2); n++) add("credit", "expense", between(50, 75), "Fuel", anyDay.get(), null);
            for (int n = 0; n < 2 + (int) Math.floor(rand.next() * 3); n++) add("credit", "expense", between(20, 160), "Shopping", anyDay.get(), null);
            for (int n = 0; n < 1 + (int) Math.floor(rand.next() * 3); n++) add("credit", "expense", between(12, 60), "Entertainment", anyDay.get(), null);
            if (rand.next() < 0.4) add("main", "expense", between(20, 140), "Health", anyDay.get(), "Pharmacy");
            if (rand.next() < 0.5) add("main", "expense", between(15, 45), "Personal Care", anyDay.get(), "Haircut");
            if (month == 7 || month == 8) add("credit", "expense", between(700, 1400), "Travel", d.apply(5), "Summer holiday");
            if (month == 12) for (int n = 0; n < 4; n++) add("credit", "expense", between(30, 150), "Gifts & Donations", d.apply(10 + n * 3), "Christmas gifts");
            if (rand.next() < 0.2) add("main", "expense", between(80, 250), "Taxes & Fees", anyDay.get(), null);

            // Note: loop bounds above draw a new random number on every pass, exactly like the
            // original generator, so the demo data is identical.
            // Money moved between accounts: pay off last month's card, top up savings, invest, withdraw cash.
            Double prevSpent = creditSpent.get(m.minusMonths(1));
            if (prevSpent != null && prevSpent != 0) transfer("main", "credit", Math.round(prevSpent * 100) / 100.0, d.apply(3), "Card repayment");
            transfer("main", "savings", Math.round(400 * k), d.apply(11), "Monthly saving");
            transfer("main", "invest", Math.round(300 * k), d.apply(11), "Monthly investment");
            transfer("main", "cash", Math.round(100 * k), d.apply(2), "ATM withdrawal");
        }

        void goal(String name, double target, LocalDate deadline, String icon, String color, int[] contributions, LocalDate today) {
            UUID id = UUID.randomUUID();
            db.sql("INSERT INTO goals (id, user_id, name, target_amount, currency, deadline, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                    .params(id, me, name, BigDecimal.valueOf(Math.round(target * k)), currency, deadline, icon, color).update();
            for (int idx = 0; idx < contributions.length; idx++) {
                db.sql("INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, NULL)")
                        .params(UUID.randomUUID(), id, me, BigDecimal.valueOf(Math.round(contributions[idx] * k)), today.minusDays(30L * (contributions.length - idx)))
                        .update();
            }
        }
    }
}
