import { toast } from 'sonner';
import { Info, KeyRound, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { HabitSummary, InvestmentAdvice } from '@ft/core';
import { api } from '../lib/api';
import { useMoney, percent } from '../lib/format';
import { keys, useApiMutation, useInvestment } from '../lib/queries';
import { ChartTooltip } from '../components/charts';
import { Button, Card, CardHeader, PageHeader, Spinner, clsx } from '../components/ui';

/** Reference categorical slots, in fixed order (validated for CVD separation). */
const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

const RISK = {
  conservative: { label: 'Conservative', cls: 'bg-good-soft text-good' },
  moderate: { label: 'Moderate', cls: 'bg-brand-soft text-brand' },
  growth: { label: 'Growth', cls: 'bg-brand-soft text-brand' },
  aggressive: { label: 'Aggressive', cls: 'bg-bad-soft text-bad' },
};

const READINESS = {
  'not-ready': { label: 'Not ready yet', cls: 'border-bad/30 bg-bad-soft', text: 'text-bad' },
  'build-buffer': { label: 'Build your buffer first', cls: 'border-warn/30 bg-surface-2', text: 'text-warn' },
  ready: { label: 'Ready to invest', cls: 'border-good/30 bg-good-soft', text: 'text-good' },
};

export function Invest() {
  const { data, isLoading } = useInvestment();
  const analyze = useApiMutation(() => api<{ advice: InvestmentAdvice }>('/ai/investment', { method: 'POST' }), [keys.investment]);

  if (isLoading || !data) return <Spinner />;
  const { summary, advice, configured } = data;

  async function run() {
    try {
      await analyze.mutateAsync(undefined);
      toast.success('Your analysis is ready');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investing coach"
        subtitle="AI suggestions based on how you actually earn, spend and save."
        action={
          <Button onClick={run} loading={analyze.isPending} disabled={summary.monthsAnalyzed < 1}>
            {advice ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
            {advice ? 'Re-analyse' : 'Analyse my habits'}
          </Button>
        }
      />

      <div className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0 text-muted" />
        <p>
          Educational suggestions only — not personalised financial advice. Only an anonymised summary (averages, category shares and balance totals — no names, notes or
          bank details) is sent to the AI.
        </p>
      </div>

      {!configured && (
        <Card className="flex gap-3">
          <KeyRound className="size-5 shrink-0 text-warn" />
          <div className="text-sm">
            <p className="font-semibold">The AI coach needs an API key</p>
            <p className="mt-1 text-muted">
              Add <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY=…</code> to <code className="rounded bg-surface-2 px-1">server/.env</code> and restart the server.
              Your habit snapshot below works without it.
            </p>
          </div>
        </Card>
      )}

      <Snapshot s={summary} />

      {analyze.isPending && (
        <Card className="flex items-center gap-4">
          <Sparkles className="size-6 animate-pulse text-brand" />
          <div>
            <p className="font-semibold">Reviewing {summary.monthsAnalyzed} months of habits…</p>
            <p className="text-sm text-muted">This usually takes 20–40 seconds.</p>
          </div>
        </Card>
      )}

      {advice && !analyze.isPending && <Advice a={advice} currency={summary.currency} />}
    </div>
  );
}

function Snapshot({ s }: { s: HabitSummary }) {
  const money = useMoney();
  const stats = [
    { l: 'Avg. monthly surplus', v: money(s.avgMonthlySurplus, { sign: true }), ok: s.avgMonthlySurplus > 0 },
    { l: 'Savings rate', v: percent(s.savingsRate), ok: s.savingsRate >= 0.15 },
    { l: 'Emergency fund', v: `${s.emergencyFundMonths.toFixed(1)} months`, ok: s.emergencyFundMonths >= 3 },
    { l: 'Spent on wants', v: percent(s.discretionaryShare), ok: s.discretionaryShare <= 0.3 },
  ];
  const balances = [
    { l: 'Cash & current', v: s.balances.liquid },
    { l: 'Savings', v: s.balances.savings },
    { l: 'Investments', v: s.balances.investments },
    { l: 'Crypto', v: s.balances.crypto },
    { l: 'Card debt', v: -s.balances.creditCardDebt },
    { l: 'Loans', v: -s.balances.loans },
  ].filter((b) => b.v !== 0);
  const max = Math.max(...balances.map((b) => Math.abs(b.v)), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader title="Your habit snapshot" subtitle={`Last ${s.monthsAnalyzed} complete month${s.monthsAnalyzed === 1 ? '' : 's'}`} />
        <div className="grid grid-cols-2 gap-3">
          {stats.map((x) => (
            <div key={x.l} className="rounded-2xl bg-surface-2 p-3.5">
              <p className="text-xs text-muted">{x.l}</p>
              <p className="mt-1 text-lg font-bold num">{x.v}</p>
              <p className={clsx('mt-0.5 text-[11px] font-semibold', x.ok ? 'text-good' : 'text-bad')}>{x.ok ? '✓ healthy' : '! needs attention'}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Income varies by about {percent(s.incomeVariability)} month to month · {money(s.recurringMonthlyCosts)} in fixed monthly costs.
        </p>
      </Card>
      <Card>
        <CardHeader title="Where your money sits" />
        <ul className="space-y-3">
          {balances.map((b) => (
            <li key={b.l}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-ink-2">{b.l}</span>
                <span className={clsx('font-semibold num', b.v < 0 && 'text-bad')}>{money(b.v)}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-3">
                <div className="h-full rounded-full" style={{ width: `${(Math.abs(b.v) / max) * 100}%`, background: b.v < 0 ? 'var(--bad)' : 'var(--net)' }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Advice({ a, currency }: { a: InvestmentAdvice; currency: string }) {
  const money = useMoney();
  const ready = READINESS[a.readiness.status];
  const risk = RISK[a.riskProfile];
  const allocation = a.allocation.map((x, i) => ({ ...x, color: SLOTS[i % SLOTS.length] }));
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand/10 blur-3xl" />
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-5 text-brand" />
          <h2 className="text-lg font-bold">Your analysis</h2>
          <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', risk.cls)}>{risk.label} profile</span>
          <span className="ml-auto text-xs text-muted">{new Date(a.generatedAt).toLocaleString()}</span>
        </div>
        <p className="mt-3 text-ink-2 leading-relaxed">{a.summary}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className={clsx('rounded-2xl border p-4', ready.cls)}>
            <p className={clsx('flex items-center gap-1.5 text-sm font-bold', ready.text)}>
              <ShieldCheck className="size-4" /> {ready.label}
            </p>
            <p className="mt-1 text-sm text-ink-2">{a.readiness.explanation}</p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs text-muted">Suggested to invest monthly</p>
            <p className="mt-1 font-display text-3xl font-extrabold num">{money(a.monthlyInvestable, { currency })}</p>
            <p className="text-xs text-muted">without touching your buffer or goals</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Suggested mix" subtitle="Asset classes, not specific products" />
          <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
            <div className="mx-auto size-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} dataKey="percent" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2} cornerRadius={4} stroke="var(--surface)" strokeWidth={2}>
                    {allocation.map((x) => (
                      <Cell key={x.label} fill={x.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip format={(n) => `${n}%`} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-3">
              {allocation.map((x) => (
                <li key={x.label}>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-2.5 rounded-sm" style={{ background: x.color }} />
                    {x.label}
                    <span className="ml-auto num">{x.percent}%</span>
                  </p>
                  <p className="pl-4.5 text-xs text-muted">{x.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="What we noticed" />
          <ul className="space-y-2">
            {a.habitsObserved.map((h) => (
              <li key={h} className="flex gap-2 text-sm text-ink-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                {h}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Next steps" />
        <ol className="space-y-3">
          {a.recommendations.map((r, i) => (
            <li key={r.title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  {r.title}
                  <span
                    className={clsx(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      r.priority === 'high' ? 'bg-bad-soft text-bad' : r.priority === 'medium' ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {r.priority}
                  </span>
                </p>
                <p className="text-sm text-muted">{r.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">{a.disclaimer}</p>
      </Card>
    </div>
  );
}
