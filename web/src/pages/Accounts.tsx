import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Archive, ArchiveRestore, ChevronRight, Plus, Users } from 'lucide-react';
import { ACCOUNT_TYPES, balanceChange, convert, formatMoney, netWorthSeries, toISODate, type Account, type Flow } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { useMoney } from '../lib/format';
import { Icon } from '../lib/icons';
import { keys, useAccounts, useApiMutation, useFlows, useHousehold } from '../lib/queries';
import { AccountCard, InstitutionLogo } from '../components/AccountCard';
import { AccountForm } from '../components/AccountForm';
import { Sparkline } from '../components/charts';
import { Sprout } from '../components/illustrations';
import { Button, Card, Empty, Modal, PageHeader, Trend, clsx } from '../components/ui';
import { loadGate } from '../components/states';

const LIABILITY = new Set(['credit', 'loan']);

export function Accounts() {
  const user = useUser();
  const money = useMoney();
  const accountsQ = useAccounts();
  const accounts = accountsQ.data ?? [];
  const { data: household } = useHousehold();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const creating = params.get('new') === '1';
  const flows = useFlows();
  const archive = useApiMutation(({ id, archived }: { id: string; archived: boolean }) => api(`/accounts/${id}`, { method: 'PATCH', body: { archived } }), [keys.accounts]);

  const gate = loadGate([accountsQ], 'cards');
  if (gate) return gate;

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const base = (a: Account) => convert(a.balance, a.currency, user.baseCurrency);
  const assets = active.filter((a) => !LIABILITY.has(a.type)).reduce((s, a) => s + base(a), 0);
  const debts = active.filter((a) => LIABILITY.has(a.type)).reduce((s, a) => s + base(a), 0);
  const ownerName = (a: Account) => (a.ownerId === user.id ? null : (household?.members.find((m) => m.userId === a.ownerId)?.name.split(' ')[0] ?? 'Family'));
  const monthAgo = toISODate(new Date(Date.now() - 30 * 86_400_000));
  const total = balanceChange(active, flows, monthAgo, user.baseCurrency);

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Every place your money lives, in one calm view."
        action={
          <Button onClick={() => setParams({ new: '1' })}>
            <Plus className="size-4" /> Add account
          </Button>
        }
      />

      {active.length > 0 && (
        <section className="mb-14 flex flex-wrap items-end gap-x-16 gap-y-6" aria-label="Totals">
          <div>
            <p className="eyebrow">Total balance</p>
            <p className="figure mt-2 text-5xl sm:text-6xl leading-none" data-testid="accounts-total">
              {money(assets + debts)}
            </p>
            <div className="mt-3">
              <Trend value={total.pct} suffix="in the last 30 days" />
            </div>
          </div>
          <dl className="flex gap-10 pb-1">
            {[
              { l: 'Assets', v: assets },
              { l: 'Debts', v: debts },
            ].map((x) => (
              <div key={x.l}>
                <dt className="text-sm text-muted">{x.l}</dt>
                <dd className={clsx('figure mt-1 text-2xl', x.v < 0 && 'text-bad')}>{money(x.v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {!active.length ? (
        <Card>
          <Empty icon="wallet" title="No accounts yet" action={<Button onClick={() => setParams({ new: '1' })}>Add your first account</Button>}>
            Bank accounts, credit cards, loans, investments, crypto or plain cash.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-10">
          {ACCOUNT_TYPES.map((t) => {
            const list = active.filter((a) => a.type === t.type);
            if (!list.length) return null;
            return (
              <section key={t.type}>
                <h2 className="mb-3 flex items-baseline justify-between px-1">
                  <span className="text-2xl">{t.label}</span>
                  <span className="font-sans text-sm font-medium text-muted num">{money(list.reduce((s, a) => s + base(a), 0))}</span>
                </h2>
                <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow)]">
                  {list.map((a) => (
                    <li key={a.id}>
                      <AccountRow account={a} flows={flows} sharedBy={ownerName(a)} onClick={() => setEditing(a)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <button
            type="button"
            onClick={() => setParams({ new: '1' })}
            className="group flex w-full items-center gap-5 rounded-[22px] border border-dashed border-line-strong bg-surface/50 p-5 text-left transition hover:border-brand hover:bg-surface cursor-pointer"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft">
              <Sprout className="size-10" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <Plus className="size-4 text-brand-fg" /> Link another account
              </span>
              <span className="mt-0.5 block text-sm text-muted">Get a complete view of your finances — banks, cards, savings, brokers or crypto.</span>
            </span>
            <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </button>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-10">
          <button onClick={() => setShowArchived((s) => !s)} className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink cursor-pointer">
            <Archive className="size-4" /> {showArchived ? 'Hide' : 'Show'} {archived.length} archived
          </button>
          {showArchived && (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {archived.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="size-3 rounded-full" style={{ background: a.color }} />
                  <span className="flex-1 text-sm">{a.name}</span>
                  <span className="text-sm text-muted num">{money(a.balance, { currency: a.currency })}</span>
                  <Button size="sm" variant="ghost" onClick={() => archive.mutate({ id: a.id, archived: false })}>
                    <ArchiveRestore className="size-4" /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={creating} onClose={() => setParams({})} title="New account">
        <AccountForm onDone={() => setParams({})} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.ownerId === user.id ? 'Edit account' : editing?.name ?? ''}>
        {editing &&
          (editing.ownerId === user.id ? (
            <>
              <AccountForm account={editing} onDone={() => setEditing(null)} />
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => {
                  archive.mutate({ id: editing.id, archived: true });
                  setEditing(null);
                }}
              >
                <Archive className="size-4" /> Archive account
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <AccountCard account={editing} sharedBy={ownerName(editing)} />
              <p className="text-sm text-muted">This account is shared with you by {ownerName(editing)}. Only they can change its settings, but you can add transactions to it.</p>
            </div>
          ))}
      </Modal>
    </div>
  );
}

/** A refined horizontal account row: who holds it, what it is, how it's moving, what's in it. */
function AccountRow({ account: a, flows, sharedBy, onClick }: { account: Account; flows: Flow[]; sharedBy: string | null; onClick: () => void }) {
  const typeLabel = ACCOUNT_TYPES.find((t) => t.type === a.type)?.label ?? a.type;
  const series = useMemo(() => netWorthSeries([a], flows, a.currency, '1M').map((p) => p.value), [a, flows]);
  const start = series[0] ?? a.balance;
  // Debts are negative balances: report how much the debt itself grew or shrank,
  // where shrinking is the good direction. The sparkline rises as debt falls.
  const liability = LIABILITY.has(a.type) || a.balance < 0;
  const pct = Math.abs(start) > 0.005 ? ((liability ? Math.abs(a.balance) - Math.abs(start) : a.balance - start) / Math.abs(start)) * 100 : null;
  const used = a.type === 'credit' && a.creditLimit ? Math.min(1, Math.max(0, -a.balance) / a.creditLimit) : null;
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-surface-2/60 sm:px-5 cursor-pointer" data-testid="account-row">
      {a.institutionId || a.institutionName ? (
        <InstitutionLogo institutionId={a.institutionId} name={a.institutionName} color={a.color} size={44} />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${a.color} 18%, var(--surface))`, color: a.color }}>
          <Icon name={a.icon} className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold tracking-[-0.01em]">{a.name}</span>
          {a.householdId && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-fg">
              <Users className="size-3" /> {sharedBy ?? 'Shared'}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {[a.institutionName, typeLabel, a.currency].filter(Boolean).join(' · ')}
        </span>
        {used !== null && (
          <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <span className="h-1 w-24 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full" style={{ width: `${used * 100}%`, background: used > 0.7 ? 'var(--bad)' : 'var(--peach)' }} />
            </span>
            {Math.round(used * 100)}% of limit used
          </span>
        )}
      </span>
      <Sparkline values={series} width={88} height={30} className="hidden md:block" />
      <span className="w-28 shrink-0 text-right sm:w-36">
        <span className={clsx('block font-semibold num', a.balance < 0 && 'text-bad')}>{formatMoney(a.balance, a.currency)}</span>
        <Trend value={pct} inverse={liability} className="!text-xs" />
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  );
}
