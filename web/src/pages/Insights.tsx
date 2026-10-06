import { useMemo, useState } from 'react';
import { CircleCheck, CircleMinus, TriangleAlert } from 'lucide-react';
import { generateInsights, type Insight } from '@ft/core';
import { useUser } from '../lib/auth';
import { Icon } from '../lib/icons';
import { useTxs } from '../lib/queries';
import { Card, Empty, PageHeader, Segmented, clsx } from '../components/ui';
import { loadGate } from '../components/states';

const TONE = {
  good: { cls: 'bg-good-soft text-good', label: 'Good news', Status: CircleCheck, accent: 'var(--emerald)' },
  bad: { cls: 'bg-bad-soft text-bad', label: 'Heads up', Status: TriangleAlert, accent: 'var(--peach)' },
  neutral: { cls: 'bg-surface-2 text-ink-2', label: 'Worth knowing', Status: CircleMinus, accent: 'var(--cobalt)' },
} as const;

export function InsightCard({ insight, compact }: { insight: Insight; compact?: boolean }) {
  const tone = TONE[insight.tone];
  return (
    <div className={clsx('flex gap-4 rounded-[20px] border border-line', compact ? 'p-3' : 'row-hover p-5 bg-surface/70')}>
      <span
        className={clsx('flex shrink-0 items-center justify-center rounded-2xl', compact ? 'size-9' : 'size-12')}
        style={{ background: `color-mix(in oklab, ${tone.accent} 15%, var(--surface))`, color: tone.accent }}
      >
        <Icon name={insight.icon} className={compact ? 'size-4' : 'size-5'} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={clsx('font-semibold tracking-[-0.01em]', compact ? 'text-sm' : 'text-[15px]')}>{insight.title}</p>
          {insight.metric && <span className={clsx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold num', tone.cls)}>{insight.metric}</span>}
        </div>
        <p className={clsx('mt-1 text-muted', compact ? 'text-xs line-clamp-2' : 'text-sm leading-relaxed')}>{insight.detail}</p>
        {!compact && (
          <p className={clsx('mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider', insight.tone === 'neutral' ? 'text-muted' : insight.tone === 'good' ? 'text-good' : 'text-bad')}>
            <tone.Status className="size-3.5" /> {tone.label}
          </p>
        )}
      </div>
    </div>
  );
}

type Group = 'all' | Insight['group'];

export function Insights() {
  const user = useUser();
  const txsQ = useTxs();
  const { txs } = txsQ;
  const [group, setGroup] = useState<Group>('all');
  const insights = useMemo(() => generateInsights(txs, user.baseCurrency), [txs, user.baseCurrency]);
  const shown = group === 'all' ? insights : insights.filter((i) => i.group === group);
  const good = insights.filter((i) => i.tone === 'good').length;
  const bad = insights.filter((i) => i.tone === 'bad').length;

  const gate = loadGate([txsQ], 'charts');
  if (gate) return gate;

  return (
    <div>
      <PageHeader title="Insights" subtitle="Patterns we spotted in how you earn, spend and save." />
      {insights.length ? (
        <>
          <section className="mb-10">
            <h2 className="text-[34px] leading-tight" data-testid="insights-headline">
              {insights.length} useful insight{insights.length === 1 ? '' : 's'}.
            </h2>
            <p className="mt-2 text-[15px] text-muted">
              Here are a few things we noticed in your finances —{' '}
              <span className="font-medium text-good">{good} good news</span>, <span className="font-medium text-bad">{bad} worth a look</span>.
            </p>
          </section>
          <div className="mb-6 overflow-x-auto">
            <Segmented<Group>
              value={group}
              onChange={setGroup}
              options={[
                { value: 'all', label: 'All' },
                { value: 'spending', label: 'Spending' },
                { value: 'income', label: 'Income' },
                { value: 'saving', label: 'Saving' },
                { value: 'habits', label: 'Habits' },
              ]}
            />
          </div>
          <div className="stagger grid gap-3 md:grid-cols-2">
            {shown.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
          {!shown.length && <p className="py-10 text-center text-sm text-muted">Nothing in this group right now.</p>}
        </>
      ) : (
        <Card>
          <Empty icon="lightbulb" title="No insights yet">
            Track your income and spending for a few weeks — insights compare months, so they get sharper with history.
          </Empty>
        </Card>
      )}
    </div>
  );
}
