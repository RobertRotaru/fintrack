package com.fintrack.analytics;

import com.fintrack.money.Money;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 * A compact, anonymised summary of a user's money habits — the only data sent
 * to the AI coach (no names, notes or institutions).
 *
 * <p>A line-for-line port of habitSummary() and detectRecurring() in @ft/core,
 * checked against a golden fixture generated from the TypeScript: same
 * iteration and summation order, same fdlibm logarithm, same rounding.
 */
public final class HabitSummary {
    private HabitSummary() {}

    /** Converts between currencies (amount, from, to). */
    @FunctionalInterface
    public interface Converter {
        double convert(double amount, String from, String to);
    }

    /** A transaction already converted to the base currency. */
    public record Tx(String date, String kind, double amount, String category, String note) {
        String month() {
            return date.substring(0, 7);
        }
    }

    public record AccountIn(String type, String currency, double balance, boolean archived) {}

    public record GoalIn(String name, double targetAmount, double saved, String currency, String deadline, boolean completed) {}

    public record TopCategory(String name, double share, double monthly) {}

    public record Balances(double liquid, double savings, double investments, double crypto, double creditCardDebt, double loans) {}

    public record MonthNet(String month, double net) {}

    public record GoalOut(String name, double target, double saved, String deadline) {}

    public record Summary(String currency, int monthsAnalyzed, double avgMonthlyIncome, double avgMonthlyExpense, double avgMonthlySurplus,
            double savingsRate, double incomeVariability, double discretionaryShare, List<TopCategory> topExpenseCategories,
            double recurringMonthlyCosts, Balances balances, double emergencyFundMonths, List<MonthNet> monthlyNet, List<GoalOut> goals) {}

    record MonthTotals(String month, double income, double expense) {
        double net() {
            return income - expense;
        }
    }

    record CategoryTotal(String name, double total) {}

    record Recurring(String kind, double amount) {}

    public static Summary compute(List<Tx> txs, List<AccountIn> accounts, List<GoalIn> goals, String currency, LocalDate today,
            Predicate<String> discretionary, Converter fx) {
        String end = YearMonth.from(today).minusMonths(1).toString();
        String start = YearMonth.parse(end).minusMonths(11).toString();
        List<Tx> window = txs.stream().filter(t -> t.month().compareTo(start) >= 0 && t.month().compareTo(end) <= 0).toList();
        String first = end;
        for (Tx t : window) if (t.month().compareTo(first) < 0) first = t.month();
        List<MonthTotals> months = monthlyTotals(window, first, end).stream().filter(m -> m.income() != 0 || m.expense() != 0).toList();
        double income = mean(months.stream().map(MonthTotals::income).toList());
        double expense = mean(months.stream().map(MonthTotals::expense).toList());
        double totalExpense = sum(window.stream().filter(t -> t.kind().equals("expense")).map(Tx::amount).toList());
        double disc = sum(window.stream().filter(t -> t.kind().equals("expense") && discretionary.test(t.category())).map(Tx::amount).toList());

        double liquid = 0, savings = 0, investments = 0, crypto = 0, card = 0, loans = 0;
        for (AccountIn a : accounts) {
            if (a.archived()) continue;
            double v = fx.convert(a.balance(), a.currency(), currency);
            switch (a.type()) {
                case "debit", "cash" -> liquid += v;
                case "savings" -> savings += v;
                case "investment" -> investments += v;
                case "crypto" -> crypto += v;
                case "credit" -> card += Math.max(0, -v);
                case "loan" -> loans += Math.abs(v);
                default -> {}
            }
        }

        int n = months.size();
        List<CategoryTotal> cats = categoryTotals(window, "expense");
        double catSum = sum(cats.stream().map(CategoryTotal::total).toList());
        List<TopCategory> top = cats.stream().limit(8)
                .map(c -> new TopCategory(c.name(), r(catSum != 0 ? c.total() / catSum : 0), r(c.total() / Math.max(n, 1))))
                .toList();
        double recurring = sum(detectRecurring(txs, today).stream().filter(x -> x.kind().equals("expense")).map(Recurring::amount).toList());
        double stdevIncome = stdev(months.stream().map(MonthTotals::income).toList());
        final double liquidF = liquid, savingsF = savings;

        return new Summary(
                currency,
                n,
                r(income),
                r(expense),
                r(income - expense),
                income != 0 ? r((income - expense) / income) : 0,
                income != 0 ? r(stdevIncome / income) : 0,
                totalExpense != 0 ? r(disc / totalExpense) : 0,
                top,
                r(recurring),
                new Balances(r(liquid), r(savings), r(investments), r(crypto), r(card), r(loans)),
                expense != 0 ? r((liquidF + savingsF) / expense) : 0,
                months.stream().map(m -> new MonthNet(m.month(), r(m.net()))).toList(),
                goals.stream().filter(g -> !g.completed())
                        .map(g -> new GoalOut(g.name(), r(fx.convert(g.targetAmount(), g.currency(), currency)), r(fx.convert(g.saved(), g.currency(), currency)), g.deadline()))
                        .toList());
    }

    /** Recurring bills: same payee (or similar amount in a rare category) in at least 3 of the last 6 complete months. */
    static List<Recurring> detectRecurring(List<Tx> txs, LocalDate today) {
        String end = YearMonth.from(today).minusMonths(1).toString();
        String start = YearMonth.parse(end).minusMonths(5).toString();
        List<Tx> window = txs.stream().filter(t -> t.month().compareTo(start) >= 0 && t.month().compareTo(end) <= 0).toList();
        Set<String> distinct = new LinkedHashSet<>();
        window.forEach(t -> distinct.add(t.month()));
        int windowMonths = distinct.isEmpty() ? 1 : distinct.size();
        Map<String, Integer> perCategory = new HashMap<>();
        for (Tx t : window) perCategory.merge(t.kind() + "|" + t.category(), 1, Integer::sum);
        Map<String, List<Tx>> groups = new LinkedHashMap<>();
        for (Tx t : window) {
            String note = t.note() == null ? "" : t.note().strip();
            // Without a note to identify the payee, only trust amount-matching in low-frequency categories.
            if (note.isEmpty() && (double) perCategory.getOrDefault(t.kind() + "|" + t.category(), 0) / windowMonths > 2) continue;
            // Bucket amounts to ~5% so "49.99" and "51.20" still group together.
            long bucket = Math.round(StrictMath.log(Math.max(t.amount(), 1)) / StrictMath.log(1.05));
            String id = note.toLowerCase(Locale.ROOT);
            String key = t.kind() + "|" + t.category() + "|" + (id.isEmpty() ? Long.toString(bucket) : id);
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
        }
        List<Recurring> out = new ArrayList<>();
        for (List<Tx> items : groups.values()) {
            Set<String> months = new LinkedHashSet<>();
            items.forEach(t -> months.add(t.month()));
            if (months.size() < 3) continue;
            // One hit per month — more than ~1.5 per month is a habit, not a bill.
            if (items.size() > months.size() * 1.5) continue;
            List<Double> amounts = items.stream().map(Tx::amount).toList();
            double m = mean(amounts);
            double max = amounts.stream().mapToDouble(Double::doubleValue).max().orElse(0);
            double min = amounts.stream().mapToDouble(Double::doubleValue).min().orElse(0);
            if (m != 0 && (max - min) / m > 0.25) continue;
            out.add(new Recurring(items.getFirst().kind(), median(amounts)));
        }
        out.sort(Comparator.comparingDouble(Recurring::amount).reversed());
        return out;
    }

    static List<MonthTotals> monthlyTotals(List<Tx> txs, String from, String to) {
        Map<String, double[]> map = new LinkedHashMap<>();
        for (YearMonth k = YearMonth.parse(from); k.compareTo(YearMonth.parse(to)) <= 0; k = k.plusMonths(1)) map.put(k.toString(), new double[2]);
        for (Tx t : txs) {
            double[] b = map.get(t.month());
            if (b != null) b[t.kind().equals("income") ? 0 : 1] += t.amount();
        }
        List<MonthTotals> out = new ArrayList<>();
        map.forEach((month, b) -> out.add(new MonthTotals(month, b[0], b[1])));
        return out;
    }

    static List<CategoryTotal> categoryTotals(List<Tx> txs, String kind) {
        Map<String, double[]> map = new LinkedHashMap<>();
        for (Tx t : txs) {
            if (!t.kind().equals(kind)) continue;
            map.computeIfAbsent(t.category(), k -> new double[1])[0] += t.amount();
        }
        List<CategoryTotal> all = new ArrayList<>();
        map.forEach((name, total) -> all.add(new CategoryTotal(name, total[0])));
        all.sort(Comparator.comparingDouble(CategoryTotal::total).reversed()); // stable, like Array.prototype.sort
        return all;
    }

    static double sum(List<Double> xs) {
        double s = 0;
        for (double x : xs) s += x;
        return s;
    }

    static double mean(List<Double> xs) {
        return xs.isEmpty() ? 0 : sum(xs) / xs.size();
    }

    static double median(List<Double> xs) {
        if (xs.isEmpty()) return 0;
        List<Double> s = new ArrayList<>(xs);
        s.sort(Double::compare);
        int mid = s.size() / 2;
        return s.size() % 2 == 1 ? s.get(mid) : (s.get(mid - 1) + s.get(mid)) / 2;
    }

    static double stdev(List<Double> xs) {
        if (xs.size() < 2) return 0;
        double m = mean(xs);
        return Math.sqrt(mean(xs.stream().map(x -> (x - m) * (x - m)).toList()));
    }

    private static double r(double n) {
        return Money.round2(n);
    }
}
