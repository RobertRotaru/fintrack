import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, Plus, Search, Trash2 } from 'lucide-react';
import { addMonths, convert, formatMoney, monthKey, monthLabel, toISODate, type Transaction } from '@ft/core';
import { useUser } from '../lib/auth';
import { formatDay, parseAmount, useMoney } from '../lib/format';
import { useAccounts, useCreateTransfer, useDeleteTransfer, useTransactions, useTransfers } from '../lib/queries';
import { TransactionForm, TransactionList } from '../components/Transactions';
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Select } from '../components/ui';
import { loadGate } from '../components/states';

type Tab = 'transactions' | 'transfers';
type KindFilter = 'all' | 'expense' | 'income';

export function Activity() {
  const user = useUser();
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const txQ = useTransactions();
  const accountsQ = useAccounts();
  const transactions = txQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const [tab, setTab] = useState<Tab>('transactions');
  const [kind, setKind] = useState<KindFilter>('all');
  // Other pages can deep-link a search and a month, e.g. a category on Spending.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [month, setMonth] = useState<string>(() => {
    const m = params.get('month');
    return m && /^\d{4}-\d{2}$/.test(m) ? m : 'all';
  });
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const accountId = params.get('account') ?? 'all';

  const months = useMemo(() => {
    const out: string[] = [];
    for (let m = monthKey(new Date()), i = 0; i < 24; i++, m = addMonths(m, -1)) out.push(m);
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (kind === 'all' || t.kind === kind) &&
        (accountId === 'all' || t.accountId === accountId) &&
        (month === 'all' || t.date.startsWith(month)) &&
        (!q || t.categoryName.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q) || String(t.amount).includes(q)),
    );
  }, [transactions, kind, accountId, month, query]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      const v = convert(t.amount, t.currency, user.baseCurrency);
      if (t.kind === 'income') income += v;
      else expense += v;
    }
    return { income, expense };
  }, [filtered, user.baseCurrency]);

  const gate = loadGate([txQ, accountsQ], 'list');
  if (gate) return gate;

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle="Every transaction and transfer."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setTransferring(true)}>
              <ArrowRight className="size-4" /> Transfer
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
        }
      />
      <Segmented<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'transactions', label: 'Transactions' },
          { value: 'transfers', label: 'Transfers' },
        ]}
      />

      {tab === 'transfers' ? (
        <Transfers />
      ) : (
        <>
          <Card className="mb-4 !p-3">
            <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, categories, amounts" className="pl-9" />
              </div>
              <Select value={accountId} onChange={(e) => setParams(e.target.value === 'all' ? {} : { account: e.target.value })} aria-label="Account">
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
                <option value="all">All time</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m, 'long')}
                  </option>
                ))}
              </Select>
              <Segmented<KindFilter>
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'expense', label: 'Out' },
                  { value: 'income', label: 'In' },
                ]}
              />
            </div>
          </Card>

          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm">
            <span className="text-muted">
              {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
            </span>
            <span>
              In <b className="text-good num">{money(totals.income)}</b>
            </span>
            <span>
              Out <b className="num">{money(totals.expense)}</b>
            </span>
            <span>
              Net <b className="num">{money(totals.income - totals.expense, { sign: true })}</b>
            </span>
          </div>

          <Card className="!p-3">
            {filtered.length ? (
              <TransactionList txs={filtered.slice(0, 300)} onSelect={setEditing} />
            ) : transactions.length ? (
              <Empty icon="search" title="No matches">
                Nothing matches these filters. Try another month, account or search.
              </Empty>
            ) : (
              <Empty icon="receipt" title="No transactions yet" action={<Button onClick={() => setAdding(true)}>Add your first one</Button>}>
                Everything you spend and earn shows up here. Tip: press N anywhere for Quick add.
              </Empty>
            )}
            {filtered.length > 300 && <p className="py-3 text-center text-xs text-muted">Showing the latest 300 — narrow the filters to see more.</p>}
          </Card>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add transaction">
        <TransactionForm onDone={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Transaction">
        {editing && <TransactionForm tx={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={transferring} onClose={() => setTransferring(false)} title="Move money">
        <TransferForm onDone={() => setTransferring(false)} />
      </Modal>
    </div>
  );
}

function Transfers() {
  const user = useUser();
  const { data: transfers = [] } = useTransfers();
  const { data: accounts = [] } = useAccounts();
  const del = useDeleteTransfer();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  if (!transfers.length) {
    return (
      <Card>
        <Empty icon="repeat" title="No transfers yet">
          Paying off a card or moving money to savings? Record it as a transfer — it changes balances without counting as spending.
        </Empty>
      </Card>
    );
  }
  return (
    <Card className="!p-3">
      <ul className="divide-y divide-line">
        {transfers.map((x) => {
          const from = byId.get(x.fromAccountId);
          const to = byId.get(x.toAccountId);
          return (
            <li key={x.id} className="group flex items-center gap-3 px-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: from?.color }} />
                  {from?.name ?? 'Hidden account'}
                  <ArrowRight className="size-3.5 text-muted" />
                  <span className="size-2.5 rounded-full" style={{ background: to?.color }} />
                  {to?.name ?? 'Hidden account'}
                </p>
                <p className="text-xs text-muted">
                  {formatDay(x.date)}
                  {x.note && ` · ${x.note}`}
                </p>
              </div>
              <span className="text-sm font-bold num">{formatMoney(x.amount, from?.currency ?? user.baseCurrency)}</span>
              {x.userId === user.id && (
                <button aria-label="Delete transfer" onClick={() => del.mutate(x.id)} className="text-muted opacity-0 transition hover:text-bad group-hover:opacity-100 cursor-pointer">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TransferForm({ onDone }: { onDone: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const active = accounts.filter((a) => !a.archived);
  const create = useCreateTransfer();
  const [f, setF] = useState({
    fromAccountId: active.find((a) => a.type === 'debit')?.id ?? active[0]?.id ?? '',
    toAccountId: active.find((a) => a.type === 'savings')?.id ?? active[1]?.id ?? '',
    amount: '',
    toAmount: '',
    date: toISODate(new Date()),
    note: '',
  });
  const from = active.find((a) => a.id === f.fromAccountId);
  const to = active.find((a) => a.id === f.toAccountId);
  const crossCurrency = from && to && from.currency !== to.currency;

  async function submit() {
    try {
      const amount = parseAmount(f.amount);
      const toAmount = parseAmount(f.toAmount);
      if (!amount || Number.isNaN(amount)) return void toast.error('Enter an amount, like 250');
      if (Number.isNaN(toAmount)) return void toast.error('The received amount must be a number');
      if (f.fromAccountId === f.toAccountId) return void toast.error('Pick two different accounts');
      await create.mutateAsync({ ...f, amount, toAmount: toAmount ?? undefined });
      toast.success('Transfer recorded');
      onDone();
    } catch {
      // The global mutation error handler already showed a toast.
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <Select value={f.fromAccountId} onChange={(e) => setF({ ...f, fromAccountId: e.target.value })}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To">
          <Select value={f.toAccountId} onChange={(e) => setF({ ...f, toAccountId: e.target.value })}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Amount${from ? ` (${from.currency})` : ''}`}>
          <Input autoFocus inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        {crossCurrency ? (
          <Field label={`Received (${to!.currency})`} hint="Leave empty to use the reference rate">
            <Input inputMode="decimal" value={f.toAmount} onChange={(e) => setF({ ...f, toAmount: e.target.value })} />
          </Field>
        ) : (
          <Field label="Date">
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        )}
      </div>
      <Field label="Note">
        <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Card repayment" />
      </Field>
      <Button size="lg" className="w-full" onClick={submit} loading={create.isPending}>
        Record transfer
      </Button>
    </div>
  );
}
