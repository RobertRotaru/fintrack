import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Crown, LogOut, RefreshCw, UserMinus, Users } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { categoryTotals, inMonth, monthKey, monthLabel, normalize, totalOf, type Household } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { useMoney } from '../lib/format';
import { keys, useAccounts, useApiMutation, useHousehold, useTransactions } from '../lib/queries';
import { AccountCard } from '../components/AccountCard';
import { CategoryDonut, ChartTooltip, SERIES, axisProps } from '../components/charts';
import { TransactionList } from '../components/Transactions';
import { Button, Card, CardHeader, Empty, Field, IconButton, Input, PageHeader, Spinner, clsx } from '../components/ui';

const ALL = [keys.household, keys.accounts, keys.transactions, keys.goals, keys.transfers];

export function Family() {
  const { data: household, isLoading } = useHousehold();
  if (isLoading) return <Spinner />;
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
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div>
      <PageHeader title="Family" subtitle="Budget together — share accounts and goals with your partner or family." />
      <div className="grid gap-6 md:grid-cols-2">
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
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const me = household.members.find((m) => m.userId === user.id);
  const isOwner = me?.role === 'owner';
  const [name, setName] = useState(household.name);

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

  const ownerName = (ownerId: string) => (ownerId === user.id ? 'Yours' : household.members.find((m) => m.userId === ownerId)?.name.split(' ')[0]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Users className="size-7 text-brand" /> {household.name}
          </span>
        }
        subtitle={`${household.members.length} member${household.members.length > 1 ? 's' : ''} · ${shared.length} shared account${shared.length === 1 ? '' : 's'}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader title="Members" />
          <ul className="space-y-2">
            {household.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-fuchsia-500 font-bold text-white">{m.name[0]?.toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    {m.name}
                    {m.userId === user.id && <span className="text-muted font-normal">(you)</span>}
                    {m.role === 'owner' && <Crown className="size-3.5 text-warn" aria-label="Owner" />}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                {isOwner && m.userId !== user.id && (
                  <IconButton
                    label={`Remove ${m.name}`}
                    onClick={() => confirm(`Remove ${m.name} from the family? Their accounts will stop being shared.`) && removeMember.mutate(m.userId)}
                  >
                    <UserMinus className="size-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl bg-brand-soft p-4">
            <p className="text-xs font-semibold text-brand">Invite code</p>
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
                await leave.mutateAsync(undefined);
                toast.success('You left the family');
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
