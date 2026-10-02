import { addDays, diffDays, parseDate, toISODate } from './dates';
import type { Goal } from './types';

export type Frequency = 'weekly' | 'monthly';

export interface SavingPlan {
  id: string;
  label: string;
  description: string;
  monthly: number;
  weekly: number;
  months: number;
  eta: string | null;
  /** Share of the user's average monthly surplus this plan would use. */
  surplusShare: number | null;
  meetsDeadline: boolean | null;
}

export interface GoalPlan {
  remaining: number;
  progress: number;
  done: boolean;
  required: { monthly: number; weekly: number; daysLeft: number } | null;
  /** ETA at the pace of the user's real contributions over the last 90 days. */
  actualPace: { monthly: number; eta: string | null } | null;
  plans: SavingPlan[];
}

const WEEKS_PER_MONTH = 52 / 12;

export function etaFor(remaining: number, amount: number, frequency: Frequency, from = new Date()): string | null {
  if (remaining <= 0) return toISODate(from);
  if (amount <= 0) return null;
  const periods = Math.ceil(remaining / amount);
  return toISODate(addDays(from, frequency === 'weekly' ? periods * 7 : Math.round(periods * 30.44)));
}

export function goalPlan(goal: Pick<Goal, 'targetAmount' | 'saved' | 'deadline' | 'contributions'>, avgMonthlySurplus: number, today = new Date()): GoalPlan {
  const remaining = Math.max(0, goal.targetAmount - goal.saved);
  const progress = goal.targetAmount > 0 ? Math.min(1, goal.saved / goal.targetAmount) : 0;
  const deadline = goal.deadline ? parseDate(goal.deadline) : null;
  const daysLeft = deadline ? Math.max(0, diffDays(deadline, today)) : null;

  let required: GoalPlan['required'] = null;
  if (deadline && daysLeft !== null) {
    const monthsLeft = Math.max(daysLeft / 30.44, 1 / 30.44);
    required = {
      monthly: remaining / monthsLeft,
      weekly: remaining / Math.max(daysLeft / 7, 1 / 7),
      daysLeft,
    };
  }

  const since = toISODate(addDays(today, -90));
  const recent = goal.contributions.filter((c) => c.date >= since);
  let actualPace: GoalPlan['actualPace'] = null;
  if (recent.length) {
    const firstDate = recent.reduce((min, c) => (c.date < min ? c.date : min), recent[0].date);
    const spanDays = Math.max(30, diffDays(today, parseDate(firstDate)));
    const monthly = (recent.reduce((s, c) => s + c.amount, 0) / spanDays) * 30.44;
    actualPace = { monthly, eta: etaFor(remaining, monthly, 'monthly', today) };
  }

  const surplus = avgMonthlySurplus > 0 ? avgMonthlySurplus : 0;
  const templates: { id: string; label: string; description: string; monthly: number }[] = surplus
    ? [
        { id: 'relaxed', label: 'Relaxed', description: 'A quarter of what you usually have left over each month.', monthly: surplus * 0.25 },
        { id: 'balanced', label: 'Balanced', description: 'Half of your typical monthly surplus.', monthly: surplus * 0.5 },
        { id: 'ambitious', label: 'Ambitious', description: 'Three quarters of your surplus — fastest without dipping into savings.', monthly: surplus * 0.75 },
      ]
    : [
        { id: 'relaxed', label: '24 months', description: 'Spread it over two years.', monthly: remaining / 24 },
        { id: 'balanced', label: '12 months', description: 'Get there in a year.', monthly: remaining / 12 },
        { id: 'ambitious', label: '6 months', description: 'Sprint to it in half a year.', monthly: remaining / 6 },
      ];
  if (required && required.monthly > 0) {
    templates.push({ id: 'deadline', label: 'Hit the deadline', description: 'Exactly what you need to save to reach it on time.', monthly: required.monthly });
  }

  const plans = templates
    .filter((t) => t.monthly > 0)
    .map((t) => {
      // The deadline plan is sized to land exactly on the deadline; don't let
      // whole-month rounding push it a month past.
      const eta = t.id === 'deadline' && goal.deadline ? goal.deadline : etaFor(remaining, t.monthly, 'monthly', today);
      return {
        ...t,
        weekly: t.monthly / WEEKS_PER_MONTH,
        months: t.id === 'deadline' && required ? Math.max(1, Math.ceil(required.daysLeft / 30.44)) : Math.ceil(remaining / t.monthly),
        eta,
        surplusShare: surplus ? t.monthly / surplus : null,
        meetsDeadline: deadline && eta ? parseDate(eta) <= deadline : null,
      };
    });

  return { remaining, progress, done: remaining <= 0, required, actualPace, plans };
}
