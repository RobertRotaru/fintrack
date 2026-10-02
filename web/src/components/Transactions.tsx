import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { formatMoney, toISODate, type Account, type Transaction, type TxKind } from '@ft/core';
import { useUser } from '../lib/auth';
import { formatDay, parseAmount } from '../lib/format';
import { useAccounts, useCategories, useCreateTransaction, useDeleteTransaction, useHousehold, useUpdateTransaction } from '../lib/queries';
import { Button, Field, IconBadge, Input, Segmented, Select, clsx } from './ui';
import { Icon } from '../lib/icons';

export function TransactionRow({ tx, account, onClick, by }: { tx: Transaction; account?: Account; onClick?: () => void; by?: string | null }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2 cursor-pointer">
      <IconBadge icon={tx.categoryIcon} color={tx.categoryColor} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{tx.note || tx.categoryName}</p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted">
          {tx.note && <span>{tx.categoryName} ·</span>}
          {account && (
            <>
              <span className="size-2 rounded-full shrink-0" style={{ background: account.color }} />
              {account.name}
            </>
          )}
          {by && <span>· by {by}</span>}
        </p>
      </div>
      <span className={clsx('text-sm font-bold num whitespace-nowrap', tx.kind === 'income' ? 'text-good' : 'text-ink')}>
        {formatMoney(tx.kind === 'income' ? tx.amount : -tx.amount, tx.currency, { sign: tx.kind === 'income' })}
      </span>
    </button>
  );
}

/** Groups transactions by day with a daily net subtotal. */
export function TransactionList({ txs, onSelect, limit }: { txs: Transaction[]; onSelect?: (t: Transaction) => void; limit?: number }) {
  const user = useUser();
  const { data: accounts = [] } = useAccounts();
  const { data: household } = useHousehold();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const memberName = (id: string) => (id === user.id ? null : (household?.members.find((m) => m.userId === id)?.name.split(' ')[0] ?? null));
  const shown = limit ? txs.slice(0, limit) : txs;
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of shown) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.date}>
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{formatDay(g.date)}</p>
          {g.items.map((t) => (
            <TransactionRow key={t.id} tx={t} account={byId.get(t.accountId)} by={memberName(t.userId)} onClick={onSelect ? () => onSelect(t) : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Full form for editing a transaction (or adding one with every field visible). */
export function TransactionForm({ tx, onDone }: { tx?: Transaction; onDone: () => void }) {
  const user = useUser();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const update = useUpdateTransaction();
  const create = useCreateTransaction();
  const remove = useDeleteTransaction();
  const mine = !tx || tx.userId === user.id;

  const [kind, setKind] = useState<TxKind>(tx?.kind ?? 'expense');
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [accountId, setAccountId] = useState(tx?.accountId ?? accounts.find((a) => !a.archived)?.id ?? '');
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '');
  const [date, setDate] = useState(tx?.date ?? toISODate(new Date()));
  const [note, setNote] = useState(tx?.note ?? '');
  const cats = categories.filter((c) => c.kind === kind && (!c.archived || c.id === tx?.categoryId));

  async function submit() {
    const value = parseAmount(amount);
    if (!value || Number.isNaN(value)) return toast.error('Enter an amount, like 12.50');
    if (!date) return toast.error('Pick a date');
    const body = { kind, amount: value, accountId, categoryId, date, note };
    if (!categoryId || !cats.some((c) => c.id === categoryId)) return toast.error('Pick a category');
    try {
      if (tx) await update.mutateAsync({ id: tx.id, ...body });
      else await create.mutateAsync(body);
      toast.success(tx ? 'Transaction updated' : 'Transaction added');
      onDone();
    } catch {
      // The global mutation error handler already showed a toast.
    }
  }

  if (!mine) {
    return <p className="text-sm text-muted">This transaction was added by a family member — only they can change it.</p>;
  }

  return (
    <div className="space-y-4">
      <Segmented
        className="w-full"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId('');
        }}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Account">
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts
            .filter((a) => !a.archived || a.id === tx?.accountId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Category">
        <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={clsx('flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition cursor-pointer', categoryId === c.id ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-2 hover:bg-surface-2')}
            >
              <Icon name={c.icon} className="size-4" style={{ color: c.color }} />
              <span className="line-clamp-1">{c.name}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Note">
        <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      <div className="flex gap-2 pt-1">
        {tx && (
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={async () => {
              const ok = await remove.mutateAsync(tx.id).then(() => true, () => false);
              if (!ok) return;
              toast.success('Transaction deleted');
              onDone();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button className="flex-1" size="lg" onClick={submit} loading={update.isPending || create.isPending}>
          {tx ? 'Save' : 'Add'}
        </Button>
      </div>
    </div>
  );
}
