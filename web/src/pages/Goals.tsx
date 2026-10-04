import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Check, ChevronRight, ImagePlus, Minus, PartyPopper, Plus, Trash2, Users } from 'lucide-react';
import { CURRENCIES, GOAL_ICONS, PERSONAL_COLORS, convert, etaFor, goalPlan, parseDate, project, type Frequency, type Goal } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { formatDay, parseAmount, resizeImage, useMoney, percent } from '../lib/format';
import { Icon } from '../lib/icons';
import { keys, useApiMutation, useGoals, useHousehold, useTransactions, useTxs } from '../lib/queries';
import { Button, Card, ColorPicker, Empty, Field, IconPicker, Input, Modal, ProgressBar, ProgressRing, Segmented, Select, clsx } from '../components/ui';
import { PathScene } from '../components/illustrations';
import { loadGate } from '../components/states';

const fmtDate = (iso: string | null) => (iso ? parseDate(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—');
const monthsUntil = (iso: string | null) => (iso ? Math.max(0, Math.round((parseDate(iso).getTime() - Date.now()) / (30.44 * 86_400_000))) : null);

/** "2 years left", "8 months left", "this month" — friendly time to a date. */
export function timeLeft(iso: string, now = new Date()): string {
  const months = Math.round((parseDate(iso).getTime() - now.getTime()) / (30.44 * 86_400_000));
  if (months <= 0) return 'this month';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} left`;
  // Half-year precision under three years ("1.5 years"), whole years after that.
  const years = months < 36 ? Math.round(months / 6) / 2 : Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} left`;
}

/** Average monthly surplus in the goal's currency, from the user's real history. */
function useSurplus(currency: string) {
  const user = useUser();
  const { txs } = useTxs();
  return useMemo(() => convert(project(txs, 1).avgMonthlyNet, user.baseCurrency, currency), [txs, user.baseCurrency, currency]);
}

export function Goals() {
  const goalsQ = useGoals();
  // Saving plans are computed from transaction history.
  const txQ = useTransactions();
  const goals = goalsQ.data ?? [];
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = goals.find((g) => g.id === openId) ?? null;
  const active = goals.filter((g) => !g.completedAt);
  const done = goals.filter((g) => g.completedAt);

  const gate = loadGate([goalsQ, txQ], 'cards');
  if (gate) return gate;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl sm:text-[44px] leading-[1.05]">Goals</h1>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New goal
        </Button>
      </div>

      <section className="relative mb-14 overflow-hidden rounded-[32px] border border-line bg-surface shadow-[var(--shadow)]">
        <PathScene className="absolute inset-y-0 right-0 h-full w-full sm:w-[62%] [mask-image:linear-gradient(to_right,transparent,black_30%)]" />
        <div className="relative max-w-md p-8 sm:p-12">
          <h2 className="text-5xl leading-[1.02] tracking-[-0.025em] sm:text-[56px]">
            Big dreams.
            <br />
            Real plans.
          </h2>
          <p className="mt-4 text-[17px] text-ink-2">Set a goal and turn your plans into progress. We’ll plan the route and tell you when you’ll get there.</p>
          <Button size="lg" className="mt-7" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add goal
          </Button>
        </div>
      </section>

      {!goals.length ? (
        <Card>
          <Empty icon="target" title="What are you saving for?" action={<Button onClick={() => setCreating(true)}>Create a goal</Button>}>
            A car, a home, a holiday, a PS5 — set a target and get saving plans with a finish date.
          </Empty>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h2 className="mb-5 text-[28px] leading-tight">Your goals</h2>
              <ul className="space-y-4">
                {active.map((g) => (
                  <li key={g.id}>
                    <GoalCard goal={g} onClick={() => setOpenId(g.id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {done.length > 0 && (
            <>
              <h2 className="mb-5 mt-14 flex items-center gap-2 text-[28px] leading-tight">
                <PartyPopper className="size-6 text-brand-fg" /> Reached
              </h2>
              <ul className="space-y-4">
                {done.map((g) => (
                  <li key={g.id}>
                    <GoalCard goal={g} onClick={() => setOpenId(g.id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="New goal">
        <GoalForm onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''} wide>
        {open && <GoalDetail goal={open} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}

function GoalCard({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const money = useMoney();
  const surplus = useSurplus(goal.currency);
  const plan = goalPlan(goal, surplus);
  const eta = plan.actualPace?.eta ?? plan.plans.find((p) => p.id === 'balanced')?.eta ?? null;
  const pct = Math.round(plan.progress * 100);
  const when = goal.completedAt
    ? `Reached ${formatDay(goal.completedAt.slice(0, 10))}`
    : plan.overdue
      ? 'Deadline passed'
      : goal.deadline
        ? timeLeft(goal.deadline)
        : eta
          ? timeLeft(eta) === 'this month'
            ? 'Almost there at your pace'
            : `About ${timeLeft(eta).replace(' left', '')} at your pace`
          : 'Add savings to get an ETA';
  return (
    <button type="button" onClick={onClick} className="row-hover group flex w-full items-center gap-5 rounded-[24px] border border-line bg-surface/70 p-5 text-left sm:p-6 cursor-pointer" data-testid="goal-row">
      {goal.image ? (
        <img src={goal.image} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${goal.color} 16%, var(--surface))`, color: goal.color }}>
          {goal.completedAt ? <Check className="size-7" /> : <Icon name={goal.icon} className="size-7" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="flex items-center gap-2 truncate text-lg font-semibold tracking-[-0.01em]">
            {goal.name}
            {goal.householdId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-fg">
                <Users className="size-3" /> Family
              </span>
            )}
          </p>
          <p className="text-sm text-muted num">
            <b className="font-semibold text-ink">{money(goal.saved, { currency: goal.currency })}</b> of {money(goal.targetAmount, { currency: goal.currency })}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex-1">
            <ProgressBar value={plan.progress} color={goal.color} size="lg" label={`${goal.name} progress`} />
          </div>
          <span className="figure w-12 text-right text-lg">{pct}%</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock className="size-3.5" />
          <span className={clsx(plan.overdue && !goal.completedAt && 'font-medium text-bad')}>{when}</span>
          {goal.deadline && !goal.completedAt && !plan.overdue && <span>· due {fmtDate(goal.deadline)}</span>}
          {!goal.completedAt && !plan.done && plan.required && <span className="hidden sm:inline">· needs {money(plan.required.monthly, { currency: goal.currency })}/mo</span>}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  );
}

function GoalDetail({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const user = useUser();
  const money = useMoney();
  const m = (n: number) => money(n, { currency: goal.currency });
  const surplus = useSurplus(goal.currency);
  const plan = goalPlan(goal, surplus);
  const [amount, setAmount] = useState('');
  const [custom, setCustom] = useState('');
  const [freq, setFreq] = useState<Frequency>('monthly');
  const [editing, setEditing] = useState(false);

  const contribute = useApiMutation((body: { amount: number }) => api(`/goals/${goal.id}/contributions`, { body }), [keys.goals]);
  const removeContribution = useApiMutation((cid: string) => api(`/goals/${goal.id}/contributions/${cid}`, { method: 'DELETE' }), [keys.goals]);
  const del = useApiMutation(() => api(`/goals/${goal.id}`, { method: 'DELETE' }), [keys.goals]);
  const complete = useApiMutation((completed: boolean) => api(`/goals/${goal.id}`, { method: 'PATCH', body: { completed } }), [keys.goals]);

  const customAmount = parseAmount(custom) ?? 0;
  const customEta = customAmount > 0 ? etaFor(plan.remaining, customAmount, freq) : null;
  const deadlineMonths = monthsUntil(goal.deadline);

  async function add(sign: 1 | -1) {
    const v = parseAmount(amount);
    if (!v || Number.isNaN(v)) return toast.error('Enter an amount, like 250');
    if (sign < 0 && v > goal.saved) return toast.error(`You can withdraw at most ${m(goal.saved)}`);
    try {
      await contribute.mutateAsync({ amount: sign * v });
      setAmount('');
      const reached = sign > 0 && goal.saved + v >= goal.targetAmount;
      toast.success(reached ? `🎉 You reached "${goal.name}"!` : sign > 0 ? `Added ${m(v)}` : `Withdrew ${m(v)}`);
    } catch {
      // The global mutation error handler already showed a toast.
    }
  }

  if (editing) return <GoalForm goal={goal} onDone={() => setEditing(false)} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <ProgressRing value={plan.progress} color={goal.color} size={120} stroke={10}>
          <div className="text-center">
            <p className="text-2xl font-extrabold num">{Math.round(plan.progress * 100)}%</p>
            <p className="text-[10px] text-muted">saved</p>
          </div>
        </ProgressRing>
        <div className="flex-1 text-center sm:text-left">
          <p className="figure text-3xl  tracking-tight num">{m(goal.saved)}</p>
          <p className="text-muted">
            of {m(goal.targetAmount)} · <b className="text-ink">{m(plan.remaining)}</b> to go
          </p>
          {plan.overdue && (
            <p className="mt-1 text-sm font-medium text-bad">
              The deadline ({fmtDate(goal.deadline)}) has passed with {m(plan.remaining)} still to go — edit the goal to set a new date.
            </p>
          )}
          {goal.deadline && !plan.overdue && (
            <p className="mt-1 text-sm text-muted">
              Deadline {fmtDate(goal.deadline)}
              {plan.required && !plan.done && (
                <>
                  {' '}— needs <b className="text-ink">{m(plan.required.monthly)}/mo</b> ({m(plan.required.weekly)}/wk)
                </>
              )}
            </p>
          )}
          {plan.actualPace && !plan.done && (
            <p className="mt-1 text-sm text-muted">
              At your recent pace ({m(plan.actualPace.monthly)}/mo) you'll get there around <b className="text-ink">{fmtDate(plan.actualPace.eta)}</b>.
            </p>
          )}
        </div>
      </div>

      {!goal.completedAt && (
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder={`Amount (${goal.currency})`} value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(1)} />
          <Button onClick={() => add(1)} loading={contribute.isPending}>
            <Plus className="size-4" /> Add
          </Button>
          <Button variant="secondary" onClick={() => add(-1)} title="Withdraw from goal">
            <Minus className="size-4" />
          </Button>
        </div>
      )}

      {!plan.done && (
        <div>
          <h3 className="mb-1 font-semibold">Saving plans</h3>
          <p className="mb-3 text-sm text-muted">
            {surplus > 0
              ? `You usually have about ${m(surplus)} left at the end of a month. Plans are based on that.`
              : 'We don’t see a monthly surplus yet, so these plans spread the remaining amount over time.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.plans.map((p) => (
              <div key={p.id} className={clsx('rounded-2xl border p-4', p.id === 'balanced' ? 'border-brand bg-brand-soft' : 'border-line')}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{p.label}</p>
                  {p.meetsDeadline !== null && (
                    <span className={clsx('rounded-md px-1.5 py-0.5 text-[10px] font-bold', p.meetsDeadline ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
                      {p.meetsDeadline ? '✓ on time' : '✕ misses deadline'}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">{p.description}</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold num">
                      {m(p.monthly)}
                      <span className="text-xs font-medium text-muted">/mo</span>
                    </p>
                    <p className="text-xs text-muted num">or {m(p.weekly)}/week</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Done by</p>
                    <p className="font-semibold">{fmtDate(p.eta)}</p>
                    <p className="text-[11px] text-muted">
                      {p.months} month{p.months === 1 ? '' : 's'}
                      {p.surplusShare !== null && ` · ${percent(p.surplusShare)} of surplus`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-line p-4">
            <p className="text-sm font-semibold">Your own plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">I can save</span>
              <Input className="!h-9 !w-28" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="amount" />
              <Segmented<Frequency>
                value={freq}
                onChange={setFreq}
                options={[
                  { value: 'weekly', label: 'per week' },
                  { value: 'monthly', label: 'per month' },
                ]}
              />
            </div>
            {customEta && (
              <p className="mt-3 text-sm">
                You'll reach it around <b>{fmtDate(customEta)}</b>
                {deadlineMonths !== null && goal.deadline && (
                  <span className={clsx('ml-1 font-medium', parseDate(customEta) <= parseDate(goal.deadline) ? 'text-good' : 'text-bad')}>
                    ({parseDate(customEta) <= parseDate(goal.deadline) ? 'before' : 'after'} your deadline)
                  </span>
                )}
                .
              </p>
            )}
          </div>
        </div>
      )}

      {goal.contributions.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">History</h3>
          <ul className="max-h-56 divide-y divide-line overflow-y-auto">
            {goal.contributions.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 text-muted">
                  {formatDay(c.date)}
                  {c.note && ` · ${c.note}`}
                </span>
                <span className={clsx('font-semibold num', c.amount < 0 && 'text-bad')}>{money(c.amount, { currency: goal.currency, sign: true })}</span>
                {c.userId === user.id && (
                  <button aria-label="Remove" onClick={() => removeContribution.mutate(c.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-bad cursor-pointer">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {goal.userId === user.id && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit goal
          </Button>
          <Button variant="secondary" onClick={() => complete.mutate(!goal.completedAt)}>
            {goal.completedAt ? 'Reopen' : 'Mark as done'}
          </Button>
          <Button
            variant="danger"
            className="ml-auto"
            onClick={async () => {
              if (!confirm(`Delete "${goal.name}"?`)) return;
              const ok = await del.mutateAsync(undefined).then(() => true, () => false);
              if (ok) onClose();
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      )}
    </div>
  );
}

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const user = useUser();
  const { data: household } = useHousehold();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    name: goal?.name ?? '',
    targetAmount: goal ? String(goal.targetAmount) : '',
    currency: goal?.currency ?? user.baseCurrency,
    deadline: goal?.deadline ?? '',
    icon: goal?.icon ?? 'target',
    color: goal?.color ?? PERSONAL_COLORS[0],
    image: goal?.image ?? null,
    initialSaved: '',
    shared: !!goal?.householdId,
  });
  const save = useApiMutation(
    (body: Record<string, unknown>) => (goal ? api(`/goals/${goal.id}`, { method: 'PATCH', body }) : api('/goals', { body })),
    [keys.goals],
  );

  async function submit() {
    if (!f.name.trim()) return toast.error('Name your goal');
    const target = parseAmount(f.targetAmount);
    const initial = parseAmount(f.initialSaved);
    if (!target) return toast.error('Set a target amount, like 2500');
    if (Number.isNaN(initial)) return toast.error('“Already saved” must be a number');
    if (!goal && initial && initial > target) return toast.error('You’ve already saved more than the target — raise the target or mark it done');
    try {
      await save.mutateAsync({
        name: f.name,
        targetAmount: target,
        currency: f.currency,
        deadline: f.deadline || null,
        icon: f.icon,
        color: f.color,
        image: f.image,
        ...(goal ? {} : { initialSaved: initial ?? 0, shared: f.shared }),
      });
      toast.success(goal ? 'Goal updated' : 'Goal created — let’s get there!');
      onDone();
    } catch {
      // The global mutation error handler already showed a toast.
    }
  }

  return (
    <div className="space-y-4">
      <Field label="What are you saving for?">
        <Input autoFocus value={f.name} maxLength={60} placeholder="e.g. PlayStation 5, New car, House deposit" onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <Field label="Target amount">
          <Input inputMode="decimal" value={f.targetAmount} onChange={(e) => setF({ ...f, targetAmount: e.target.value })} />
        </Field>
        <Field label="Currency">
          <Select value={f.currency} disabled={!!goal} onChange={(e) => setF({ ...f, currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deadline" hint="Optional">
          <Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
        </Field>
        {!goal && (
          <Field label="Already saved" hint="Optional">
            <Input inputMode="decimal" value={f.initialSaved} placeholder="0" onChange={(e) => setF({ ...f, initialSaved: e.target.value })} />
          </Field>
        )}
      </div>
      <Field label="Icon">
        <IconPicker value={f.icon} onChange={(icon) => setF({ ...f, icon })} icons={GOAL_ICONS} color={f.color} />
      </Field>
      <Field label="Colour">
        <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} colors={PERSONAL_COLORS.slice(0, 14)} />
      </Field>
      <Field label="Picture" hint="Optional — a photo of the thing keeps you motivated.">
        <div className="flex items-center gap-3">
          {f.image && <img src={f.image} alt="" className="size-12 rounded-xl object-cover" />}
          <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" /> {f.image ? 'Change' : 'Upload'}
          </Button>
          {f.image && (
            <Button variant="ghost" type="button" onClick={() => setF({ ...f, image: null })}>
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setF({ ...f, image: await resizeImage(file, 640) });
              e.target.value = '';
            }}
          />
        </div>
      </Field>
      {household && !goal && (
        <label className="flex items-center gap-3 rounded-2xl border border-line p-3.5 cursor-pointer">
          <input type="checkbox" checked={f.shared} onChange={(e) => setF({ ...f, shared: e.target.checked })} className="size-4 accent-[var(--brand)]" />
          <span className="text-sm">
            <b>Family goal</b> — everyone in {household.name} can see it and contribute.
          </span>
        </label>
      )}
      <Button size="lg" className="w-full" onClick={submit} loading={save.isPending}>
        {goal ? 'Save' : 'Create goal'}
      </Button>
    </div>
  );
}
