import { formatMoney } from './currency';
import {
  DISCRETIONARY,
  categoryTotals,
  inMonth,
  mean,
  monthlyTotals,
  pctChange,
  stdev,
  sum,
  totalOf,
  weekdaySpending,
  type Tx,
} from './analytics';
import { addDays, addMonths, daysInMonth, monthKey, monthLabel, parseDate, toISODate } from './dates';
import { detectRecurring } from './projections';

export type InsightTone = 'good' | 'bad' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  icon: string;
  title: string;
  detail: string;
  /** Short headline number, e.g. "+23%". */
  metric?: string;
  /** Higher = shown first. */
  weight: number;
  group: 'spending' | 'income' | 'saving' | 'habits';
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`;

export function generateInsights(txs: Tx[], currency: string, today = new Date()): Insight[] {
  const money = (n: number) => formatMoney(n, currency);
  const out: Insight[] = [];
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);
  const prevMonth = addMonths(thisMonth, -2);
  const dayOfMonth = today.getDate();

  const cur = inMonth(txs, thisMonth);
  const last = inMonth(txs, lastMonth);
  const prev = inMonth(txs, prevMonth);
  if (!txs.length) return out;

  // 1. Spending pace: this month to date vs last month at the same day.
  const curToDate = totalOf(cur, 'expense');
  const lastToDate = sum(
    last.filter((t) => t.kind === 'expense' && Number(t.date.slice(8, 10)) <= dayOfMonth).map((t) => t.amount),
  );
  const pace = pctChange(curToDate, lastToDate);
  if (pace !== null && lastToDate > 0 && Math.abs(pace) >= 5) {
    out.push({
      id: 'pace',
      group: 'spending',
      tone: pace > 0 ? 'bad' : 'good',
      icon: pace > 0 ? 'trending-up' : 'trending-down',
      metric: pct(pace),
      title: pace > 0 ? 'Spending faster than last month' : 'Spending slower than last month',
      detail: `By day ${dayOfMonth} you've spent ${money(curToDate)}, versus ${money(lastToDate)} at the same point in ${monthLabel(lastMonth, 'long')}.`,
      weight: 90 + Math.min(Math.abs(pace), 50) / 5,
    });
  }

  // 2. Category movers: last full month vs the month before.
  const lastCats = categoryTotals(last, 'expense');
  const prevCats = new Map(categoryTotals(prev, 'expense').map((c) => [c.name, c.total]));
  const lastExpense = totalOf(last, 'expense');
  const movers = lastCats
    .map((c) => ({ ...c, prev: prevCats.get(c.name) ?? 0, change: pctChange(c.total, prevCats.get(c.name) ?? 0) }))
    .filter((c) => c.prev > 0 && c.change !== null && Math.abs(c.total - c.prev) > lastExpense * 0.02);
  const ups = movers.filter((c) => c.change! >= 20).sort((a, b) => b.total - b.prev - (a.total - a.prev)).slice(0, 3);
  const downs = movers.filter((c) => c.change! <= -20).sort((a, b) => a.total - a.prev - (b.total - b.prev)).slice(0, 2);
  for (const c of ups) {
    out.push({
      id: `cat-up-${c.name}`,
      group: 'spending',
      tone: 'bad',
      icon: c.icon,
      metric: pct(c.change!),
      title: `More spent on ${c.name}`,
      detail: `${money(c.total)} in ${monthLabel(lastMonth, 'long')} vs ${money(c.prev)} the month before — ${money(c.total - c.prev)} more.`,
      weight: 70 + Math.min(c.change!, 100) / 10,
    });
  }
  for (const c of downs) {
    out.push({
      id: `cat-down-${c.name}`,
      group: 'spending',
      tone: 'good',
      icon: c.icon,
      metric: pct(c.change!),
      title: `Less spent on ${c.name}`,
      detail: `You cut ${c.name} by ${money(c.prev - c.total)} in ${monthLabel(lastMonth, 'long')}. Nice.`,
      weight: 60,
    });
  }
  for (const c of lastCats) {
    if (!prevCats.has(c.name) && c.total > lastExpense * 0.05) {
      out.push({
        id: `cat-new-${c.name}`,
        group: 'spending',
        tone: 'neutral',
        icon: c.icon,
        title: `New spending on ${c.name}`,
        detail: `${money(c.total)} on ${c.name} in ${monthLabel(lastMonth, 'long')}, which didn't appear the month before.`,
        weight: 45,
      });
    }
  }

  // 3. Income change.
  const lastIncome = totalOf(last, 'income');
  const prevIncome = totalOf(prev, 'income');
  const incomeChange = pctChange(lastIncome, prevIncome);
  if (incomeChange !== null && prevIncome > 0 && Math.abs(incomeChange) >= 5) {
    out.push({
      id: 'income',
      group: 'income',
      tone: incomeChange > 0 ? 'good' : 'bad',
      icon: incomeChange > 0 ? 'arrow-up-right' : 'arrow-down-right',
      metric: pct(incomeChange),
      title: incomeChange > 0 ? 'Bigger income' : 'Lower income',
      detail: `${money(lastIncome)} came in during ${monthLabel(lastMonth, 'long')}, vs ${money(prevIncome)} in ${monthLabel(prevMonth, 'long')}.`,
      weight: 80,
    });
  }

  // 4. Savings rate change.
  const [l] = monthlyTotals(last, lastMonth, lastMonth);
  const [p] = monthlyTotals(prev, prevMonth, prevMonth);
  if (l.income > 0 && p.income > 0) {
    const diff = (l.savingsRate - p.savingsRate) * 100;
    if (Math.abs(diff) >= 3) {
      out.push({
        id: 'savings-rate',
        group: 'saving',
        tone: diff > 0 ? 'good' : 'bad',
        icon: 'piggy-bank',
        metric: `${Math.round(l.savingsRate * 100)}%`,
        title: diff > 0 ? 'You saved more' : 'You saved less',
        detail: `Your savings rate was ${Math.round(l.savingsRate * 100)}% in ${monthLabel(lastMonth, 'long')}, ${diff > 0 ? 'up' : 'down'} ${Math.abs(Math.round(diff))} points from ${Math.round(p.savingsRate * 100)}%.`,
        weight: 85,
      });
    }
  }

  // 5. Positive-net streak.
  let streak = 0;
  for (let k = lastMonth; ; k = addMonths(k, -1)) {
    const [m] = monthlyTotals(inMonth(txs, k), k, k);
    if (m.income === 0 && m.expense === 0) break;
    if (m.net <= 0) break;
    streak++;
    if (streak > 36) break;
  }
  if (streak >= 2) {
    out.push({
      id: 'streak',
      group: 'saving',
      tone: 'good',
      icon: 'flame',
      metric: `${streak} mo`,
      title: `${streak} months in the green`,
      detail: `You've earned more than you've spent for ${streak} months in a row.`,
      weight: 55 + streak,
    });
  }

  // 6. Biggest share of spending.
  const top = lastCats[0];
  if (top && top.share > 0.25) {
    out.push({
      id: 'top-share',
      group: 'spending',
      tone: 'neutral',
      icon: top.icon,
      metric: `${Math.round(top.share * 100)}%`,
      title: `${top.name} dominates your budget`,
      detail: `${top.name} took ${Math.round(top.share * 100)}% of everything you spent in ${monthLabel(lastMonth, 'long')}.`,
      weight: 40,
    });
  }

  // 7. Weekend vs weekday.
  const recent = txs.filter((t) => t.date >= toISODate(addDays(today, -90)));
  const wd = weekdaySpending(recent);
  const weekdayAvg = mean(wd.slice(0, 5).map((d) => d.avg));
  const weekendAvg = mean(wd.slice(5).map((d) => d.avg));
  if (weekdayAvg > 0 && weekendAvg > weekdayAvg * 1.3) {
    out.push({
      id: 'weekend',
      group: 'habits',
      tone: 'neutral',
      icon: 'calendar-days',
      metric: `${(weekendAvg / weekdayAvg).toFixed(1)}×`,
      title: 'Weekends cost more',
      detail: `On spending days, weekends average ${money(weekendAvg)} vs ${money(weekdayAvg)} on weekdays (last 90 days).`,
      weight: 35,
    });
  }
  const peak = [...wd].sort((a, b) => b.total - a.total)[0];
  if (peak && peak.total > 0) {
    out.push({
      id: 'peak-day',
      group: 'habits',
      tone: 'neutral',
      icon: 'calendar',
      title: `${peak.day} is your big spending day`,
      detail: `Over the last 90 days you spent the most on ${peak.day}s: ${money(peak.total)} in total.`,
      weight: 20,
    });
  }

  // 8. Subscriptions & recurring bills.
  const recurring = detectRecurring(txs, today).filter((r) => r.kind === 'expense');
  const subs = recurring.filter((r) => r.category === 'Subscriptions');
  if (recurring.length) {
    const monthly = sum(recurring.map((r) => r.amount));
    out.push({
      id: 'recurring',
      group: 'habits',
      tone: 'neutral',
      icon: 'repeat',
      metric: money(monthly),
      title: `${recurring.length} recurring payments`,
      detail: `About ${money(monthly)} leaves every month on autopilot${subs.length ? `, including ${subs.length} subscription${subs.length > 1 ? 's' : ''} (${money(sum(subs.map((s) => s.amount)))})` : ''}. Worth a yearly review.`,
      weight: 50,
    });
  }

  // 9. Unusual transactions in the last 30 days.
  const since = toISODate(addDays(today, -30));
  const byCat = new Map<string, number[]>();
  for (const t of txs) if (t.kind === 'expense' && t.date < since) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t.amount]);
  const unusual = txs
    .filter((t) => t.kind === 'expense' && t.date >= since)
    .filter((t) => {
      const hist = byCat.get(t.category) ?? [];
      return hist.length >= 5 && t.amount > mean(hist) + 3 * stdev(hist) && t.amount > mean(hist) * 2;
    })
    .sort((a, b) => b.amount - a.amount)[0];
  if (unusual) {
    out.push({
      id: `unusual-${unusual.id}`,
      group: 'spending',
      tone: 'bad',
      icon: 'alert-triangle',
      metric: money(unusual.amount),
      title: `Unusually large ${unusual.category} expense`,
      detail: `${money(unusual.amount)} on ${parseDate(unusual.date).toLocaleDateString()}${unusual.note ? ` (${unusual.note})` : ''} is well above your usual ${unusual.category} spend.`,
      weight: 75,
    });
  }

  // 10. No-spend days this month.
  const spendDays = new Set(cur.filter((t) => t.kind === 'expense').map((t) => t.date));
  const noSpend = dayOfMonth - spendDays.size;
  if (dayOfMonth >= 7 && noSpend >= 3) {
    out.push({
      id: 'no-spend',
      group: 'habits',
      tone: 'good',
      icon: 'leaf',
      metric: `${noSpend} days`,
      title: 'No-spend days',
      detail: `${noSpend} of the ${dayOfMonth} days so far this month had zero spending.`,
      weight: 30,
    });
  }

  // 11. Discretionary ("wants") share.
  const wants = sum(last.filter((t) => t.kind === 'expense' && DISCRETIONARY.has(t.category)).map((t) => t.amount));
  if (lastExpense > 0) {
    const share = wants / lastExpense;
    out.push({
      id: 'wants',
      group: 'spending',
      tone: share > 0.4 ? 'bad' : share < 0.25 ? 'good' : 'neutral',
      icon: 'shopping-bag',
      metric: `${Math.round(share * 100)}%`,
      title: 'Wants vs needs',
      detail: `${Math.round(share * 100)}% of last month's spending (${money(wants)}) went on wants like dining out, shopping and entertainment. The 50/30/20 rule suggests about 30%.`,
      weight: 38,
    });
  }

  // 12. Small purchases add up.
  const smalls = last.filter((t) => t.kind === 'expense' && t.amount < Math.max(10, lastExpense * 0.005));
  if (smalls.length >= 10) {
    const total = sum(smalls.map((t) => t.amount));
    out.push({
      id: 'small-purchases',
      group: 'habits',
      tone: 'neutral',
      icon: 'coins',
      metric: `${smalls.length}×`,
      title: 'Small purchases add up',
      detail: `${smalls.length} small purchases added up to ${money(total)} last month — that's ${money(total * 12)} a year.`,
      weight: 33,
    });
  }

  // 13. End-of-month forecast for the current month.
  if (dayOfMonth >= 5 && dayOfMonth < daysInMonth(thisMonth) - 1) {
    const dailyRate = curToDate / dayOfMonth;
    const forecast = dailyRate * daysInMonth(thisMonth);
    const lastTotal = lastExpense;
    if (lastTotal > 0) {
      const change = pctChange(forecast, lastTotal)!;
      out.push({
        id: 'forecast',
        group: 'spending',
        tone: change > 10 ? 'bad' : change < -10 ? 'good' : 'neutral',
        icon: 'gauge',
        metric: money(forecast),
        title: 'On track for this month',
        detail: `At your current pace you'll spend about ${money(forecast)} this month (${pct(change)} vs ${monthLabel(lastMonth, 'long')}).`,
        weight: 65,
      });
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}
