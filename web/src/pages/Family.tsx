import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { ChevronRight, Copy, Crown, LogOut, Plus, RefreshCw, Share2, UserMinus } from 'lucide-react';
import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveContainer } from '../components/ResponsiveChart';
import { balanceChange, categoryTotals, goalPlan, inMonth, monthKey, monthLabel, netWorthSeries, normalize, toISODate, totalOf, type Household } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { useMoney } from '../lib/format';
import { Icon } from '../lib/icons';
import { keys, useAccounts, useApiMutation, useFlows, useGoals, useHousehold, useTransactions } from '../lib/queries';
import { AccountCard } from '../components/AccountCard';
import { CategoryDonut, ChartTooltip, SERIES, Sparkline, axisProps } from '../components/charts';
import { TogetherScene } from '../components/illustrations';
import { TransactionList } from '../components/Transactions';
import { Avatar, Button, Card, CardHeader, Empty, Field, IconButton, Input, Modal, PageHeader, ProgressBar, Segmented, Trend, clsx } from '../components/ui';
import { loadGate } from '../components/states';

/** Who you're inviting — only shapes the invite message; everyone joins as a member. */
export type InviteRole = 'partner' | 'family' | 'child';
const ROLE_LABEL: Record<InviteRole, string> = { partner: 'Partner', family: 'Family member', child: 'Child' };

export function inviteMessage(role: InviteRole, household: string, code: string, from: string): string {
  const who = role === 'partner' ? 'my partner' : role === 'child' ? 'part of the family' : 'part of our family budget';
  return `${from} invited you to join “${household}” on Fintrack as ${who}. Open Fintrack → Family → Join a family, and enter the code ${code}.`;
}

/** The hero shared by both family states. */
function FamilyHero({ action }: { action?: React.ReactNode }) {
  return (
    <section className="relative mb-12 overflow-hidden rounded-[32px] border border-line bg-surface shadow-[var(--shadow)]">
      <TogetherScene className="absolute inset-y-0 right-0 h-full w-full sm:w-[55%] [mask-image:linear-gradient(to_right,transparent,black_35%)]" />
      <div className="relative max-w-lg p-8 sm:p-12">
        <h2 className="text-5xl leading-[1.02] tracking-[-0.025em]">Shared finances, stronger together.</h2>
        <p className="mt-4 text-[17px] text-ink-2">Invite your partner or family members to manage your finances together. You choose what to share — everything else stays private.</p>
        {action && <div className="mt-7">{action}</div>}
      </div>
    </section>
  );
}

const ALL = [keys.household, keys.accounts, keys.transactions, keys.goals, keys.transfers];

export function Family() {
  const householdQ = useHousehold();
  const household = householdQ.data;
  const gate = loadGate([householdQ], 'cards');
  if (gate) return gate;
  return household ? <FamilyHome household={household} /> : <NoFamily />;
}

function NoFamily() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const create = useApiMutation((n: string) => api('/household', { body: { name: n } }), ALL);
  const join = useApiMutation((c: string) => api('/household/join', { body: { code: c } }), ALL);
  const run = async (p: Promise<unknown>, msg: string) => {
    try {
      await p;
      toast.success(msg);
    } catch {
      // The global mutation error handler already showed a toast.
    }
  };
  return (
    <div>
      <PageHeader title="Family" subtitle="Budget together — share accounts and goals with your partner or family." />
      <FamilyHero />
      <div className="stagger grid gap-6 md:grid-cols-2">
        <Card>
          <Empty icon="users" title="Start a family">
            Create a shared space, then invite your partner with a code. You choose which accounts and goals to share — everything else stays private.
          </Empty>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Popescus" />
            <Button onClick={() => run(create.mutateAsync(name), 'Family created')} loading={create.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </Card>
        <Card>
          <Empty icon="heart" title="Join a family">
            Got an invite code from your partner? Enter it here to join their family space.
          </Empty>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-1234" className="font-mono tracking-widest uppercase" maxLength={9} />
            <Button onClick={() => run(join.mutateAsync(code), 'Welcome to the family!')} loading={join.isPending} disabled={code.replace(/[^A-Z0-9]/g, '').length < 8}>
              Join
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FamilyHome({ household }: { household: Household }) {
  const user = useUser();
  const money = useMoney();
  const accountsQ = useAccounts();
  const txQ = useTransactions();
  const accounts = accountsQ.data ?? [];
  const transactions = txQ.data ?? [];
  const me = household.members.find((m) => m.userId === user.id);
  const isOwner = me?.role === 'owner';
  const [name, setName] = useState(household.name);
  const [inviting, setInviting] = useState(false);
  const flows = useFlows();
  const { data: goals = [] } = useGoals();

  const rename = useApiMutation((n: string) => api('/household', { method: 'PATCH', body: { name: n } }), [keys.household]);
  const newCode = useApiMutation(() => api('/household/invite-code', { method: 'POST' }), [keys.household]);
  const leave = useApiMutation(() => api('/household/leave', { method: 'POST' }), ALL);
  const removeMember = useApiMutation((id: string) => api(`/household/members/${id}`, { method: 'DELETE' }), ALL);
  const share = useApiMutation(({ id, shared }: { id: string; shared: boolean }) => api(`/accounts/${id}`, { method: 'PATCH', body: { shared } }), ALL);

  const shared = accounts.filter((a) => a.householdId === household.id && !a.archived);
  const myUnshared = accounts.filter((a) => a.ownerId === user.id && !a.householdId && !a.archived);
  const sharedIds = new Set(shared.map((a) => a.id));
  const sharedTx = transactions.filter((t) => sharedIds.has(t.accountId));
  const month = monthKey(new Date());

  const stats = useMemo(() => {
    const txs = inMonth(normalize(sharedTx, user.baseCurrency), month);
    const perMember = household.members.map((m) => ({
      name: m.userId === user.id ? 'You' : m.name.split(' ')[0],
      spent: totalOf(txs.filter((t) => t.userId === m.userId), 'expense'),
      earned: totalOf(txs.filter((t) => t.userId === m.userId), 'income'),
    }));
    return { income: totalOf(txs, 'income'), expense: totalOf(txs, 'expense'), categories: categoryTotals(txs, 'expense'), perMember };
  }, [sharedTx, user.baseCurrency, month, household.members, user.id]);

  // Shared activity needs both lists; show their real state rather than an empty budget.
  const gate = loadGate([accountsQ, txQ], 'cards');
  if (gate) return gate;

  const ownerName = (ownerId: string) => (ownerId === user.id ? 'Yours' : household.members.find((m) => m.userId === ownerId)?.name.split(' ')[0]);
  const lastMonthEnd = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 0));
  const overview = balanceChange(shared, flows, lastMonthEnd, user.baseCurrency);
  const overviewSeries = netWorthSeries(shared, flows, user.baseCurrency, '3M').map((p) => p.value);
  const sharedGoals = goals.filter((g) => g.householdId === household.id);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Family"
        subtitle={`${household.name} · ${household.members.length} member${household.members.length > 1 ? 's' : ''} · ${shared.length} shared account${shared.length === 1 ? '' : 's'}`}
      />
      <FamilyHero
        action={
          <Button size="lg" onClick={() => setInviting(true)}>
            <Plus className="size-4" /> Invite family member
          </Button>
        }
      />

      <section aria-label="Members" className="flex flex-wrap items-start gap-6 sm:gap-8">
        {household.members.map((m) => (
          <div key={m.userId} className="group relative flex w-20 flex-col items-center text-center" data-testid="member">
            <Avatar name={m.name} size={64} ring />
            <p className="mt-2 w-full truncate text-sm font-semibold">{m.userId === user.id ? 'You' : m.name.split(' ')[0]}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              {m.role === 'owner' ? (
                <>
                  <Crown className="size-3 text-warn" aria-hidden="true" /> Admin
                </>
              ) : (
                'Member'
              )}
            </p>
            {isOwner && m.userId !== user.id && (
              <button
                aria-label={`Remove ${m.name}`}
                title={`Remove ${m.name}`}
                onClick={() => confirm(`Remove ${m.name} from the family? Their accounts will stop being shared.`) && removeMember.mutate(m.userId)}
                className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border border-line bg-surface text-muted opacity-0 shadow-[var(--shadow)] transition hover:text-bad group-hover:opacity-100 focus:opacity-100 cursor-pointer"
              >
                <UserMinus className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setInviting(true)} className="group flex w-20 flex-col items-center text-center cursor-pointer">
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-muted transition group-hover:border-brand group-hover:text-brand-fg">
            <Plus className="size-6" />
          </span>
          <span className="mt-2 text-sm font-semibold">Add</span>
          <span className="text-xs text-muted">Invite</span>
        </button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="!p-7">
          <p className="eyebrow">Family overview</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Total balance of shared accounts</p>
              <p className="figure mt-1 text-5xl leading-none" data-testid="family-total">{money(overview.now)}</p>
              <div className="mt-2">
                <Trend value={overview.pct} suffix="this month" />
              </div>
            </div>
            <Sparkline values={overviewSeries} width={200} height={64} />
          </div>
        </Card>
        <Card className="!p-7">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Shared goals</p>
            <Link to="/goals" className="inline-flex items-center gap-1 text-sm font-medium text-brand-fg">
              {sharedGoals.length} active <ChevronRight className="size-4" />
            </Link>
          </div>
          {sharedGoals.length ? (
            <ul className="mt-4 space-y-4">
              {sharedGoals.slice(0, 3).map((g) => {
                const plan = goalPlan(g, 0);
                return (
                  <li key={g.id}>
                    <div className="mb-1.5 flex items-center gap-2 text-sm">
                      <Icon name={g.icon} className="size-4" style={{ color: g.color }} />
                      <span className="flex-1 truncate font-medium">{g.name}</span>
                      <span className="text-xs text-muted num">{Math.round(plan.progress * 100)}%</span>
                    </div>
                    <ProgressBar value={plan.progress} color={g.color} label={`${g.name} progress`} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">No shared goals yet. When you create a goal, tick “Family goal” so everyone can contribute.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader title="Family settings" />
          <div className="rounded-2xl bg-brand-soft p-4">
            <p className="text-xs font-semibold text-brand-fg">Invite code</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 text-2xl font-bold tracking-[0.2em] text-ink">{household.inviteCode}</code>
              <IconButton
                label="Copy code"
                onClick={() => {
                  navigator.clipboard?.writeText(household.inviteCode);
                  toast.success('Invite code copied');
                }}
              >
                <Copy className="size-4" />
              </IconButton>
              {isOwner && (
                <IconButton label="New code" onClick={() => newCode.mutate(undefined)}>
                  <RefreshCw className={clsx('size-4', newCode.isPending && 'animate-spin')} />
                </IconButton>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">Share it with your partner — they enter it on their Family page.</p>
          </div>
          <div className="mt-5 space-y-3 border-t border-line pt-5">
            {isOwner && (
              <Field label="Family name">
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                  <Button variant="secondary" disabled={name === household.name || !name.trim()} onClick={() => rename.mutate(name)}>
                    Save
                  </Button>
                </div>
              </Field>
            )}
            <Button
              variant="ghost"
              className="text-bad"
              onClick={async () => {
                if (!confirm('Leave this family? Your accounts and goals will stop being shared.')) return;
                await leave.mutateAsync(undefined).then(() => toast.success('You left the family'), () => {});
              }}
            >
              <LogOut className="size-4" /> Leave family
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title={`Family budget · ${monthLabel(month, 'long')}`} subtitle="Activity on shared accounts" />
          {shared.length ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Came in', v: stats.income },
                  { l: 'Went out', v: stats.expense },
                  { l: 'Left over', v: stats.income - stats.expense },
                ].map((x) => (
                  <div key={x.l} className="rounded-2xl bg-surface-2 p-3">
                    <p className="text-xs text-muted">{x.l}</p>
                    <p className="text-lg font-bold num truncate">{money(x.v, { compact: Math.abs(x.v) >= 100000 })}</p>
                  </div>
                ))}
              </div>
              <p className="mb-2 mt-5 text-sm font-semibold">Who spent what</p>
              <div style={{ height: Math.max(80, stats.perMember.length * 44) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.perMember} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" {...axisProps} width={64} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip format={(n) => money(n)} />} />
                    <Bar dataKey="spent" name="Spent" fill={SERIES.expense} radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: 'right', fill: 'var(--ink-2)', fontSize: 11, formatter: (v: unknown) => money(Number(v), { compact: true }) }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Share an account below to start budgeting together.</p>
          )}
        </Card>
      </div>

      {shared.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Shared accounts</h2>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((a) => (
              <AccountCard key={a.id} account={a} compact sharedBy={ownerName(a.ownerId)} />
            ))}
          </div>
        </section>
      )}

      {myUnshared.length > 0 && (
        <Card>
          <CardHeader title="Share your accounts" subtitle="Family members will see balances and can add transactions." />
          <ul className="divide-y divide-line">
            {myUnshared.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="size-3 rounded-full" style={{ background: a.color }} />
                <span className="flex-1 text-sm font-medium">{a.name}</span>
                <span className="text-sm text-muted num">{money(a.balance, { currency: a.currency })}</span>
                <Button size="sm" variant="secondary" onClick={() => share.mutate({ id: a.id, shared: true })}>
                  Share
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {stats.categories.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Shared spending by category" />
            <CategoryDonut data={stats.categories} total={stats.expense} label="Spent" max={6} />
          </Card>
          <Card>
            <CardHeader title="Recent shared activity" />
            <TransactionList txs={sharedTx} limit={8} />
          </Card>
        </div>
      )}

      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite to the family">
        <InviteDialog household={household} from={user.name.split(' ')[0]} canRegenerate={isOwner} onRegenerate={() => newCode.mutate(undefined)} regenerating={newCode.isPending} />
      </Modal>
    </div>
  );
}

function InviteDialog({ household, from, canRegenerate, onRegenerate, regenerating }: { household: Household; from: string; canRegenerate: boolean; onRegenerate: () => void; regenerating: boolean }) {
  const [role, setRole] = useState<InviteRole>('partner');
  const message = inviteMessage(role, household.name, household.inviteCode, from);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Couldn’t copy — select the text and copy it instead');
    }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink-2">Who are you inviting?</p>
        <Segmented<InviteRole> value={role} onChange={setRole} options={(Object.keys(ROLE_LABEL) as InviteRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} className="w-full" />
      </div>
      <div className="rounded-2xl bg-brand-soft p-5 text-center">
        <p className="text-xs font-semibold text-brand-fg">Invite code</p>
        <code className="mt-1 block text-3xl font-bold tracking-[0.22em] text-ink" data-testid="invite-code">{household.inviteCode}</code>
        <div className="mt-3 flex justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => copy(household.inviteCode, 'Invite code')}>
            <Copy className="size-3.5" /> Copy code
          </Button>
          {canRegenerate && (
            <Button size="sm" variant="ghost" onClick={onRegenerate} loading={regenerating}>
              <RefreshCw className="size-3.5" /> New code
            </Button>
          )}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-ink-2">Message</p>
        <p className="rounded-2xl border border-line bg-surface-2 p-4 text-sm leading-relaxed text-ink-2" data-testid="invite-message">{message}</p>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => copy(message, 'Invite message')}>
          <Copy className="size-4" /> Copy message
        </Button>
        {canShare && (
          <Button variant="secondary" onClick={() => navigator.share({ title: 'Join my family on Fintrack', text: message }).catch(() => {})}>
            <Share2 className="size-4" /> Share
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted">Everyone joins as a member and sees only the accounts and goals you share.</p>
    </div>
  );
}
