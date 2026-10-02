import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { CalendarDays, ChevronDown, MessageSquareText } from 'lucide-react';
import { addDays, formatMoney, toISODate, type TxKind } from '@ft/core';
import { useAccounts, useCategories, useCreateTransaction, useDeleteTransaction, useTransactions } from '../lib/queries';
import { Icon } from '../lib/icons';
import { parseAmount } from '../lib/format';
import { clsx, Segmented } from './ui';

const LAST_ACCOUNT = 'ft.lastAccount';
const readLast = () => {
  try {
    return localStorage.getItem(LAST_ACCOUNT);
  } catch {
    return null;
  }
};

/**
 * The 2-step entry: type an amount, tap a category — saved. Account defaults to
 * the last one used, date to today; both are one tap away if they need changing.
 */
export function QuickAdd({ onDone, autoFocus = true }: { onDone?: () => void; autoFocus?: boolean }) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const create = useCreateTransaction();
  const remove = useDeleteTransaction();

  const [kind, setKind] = useState<TxKind>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string>('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [shake, setShake] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const active = accounts.filter((a) => !a.archived);
  useEffect(() => {
    if (accountId && active.some((a) => a.id === accountId)) return;
    const last = readLast();
    const pick = active.find((a) => a.id === last) ?? active.find((a) => a.type === 'debit') ?? active[0];
    if (pick) setAccountId(pick.id);
  }, [active, accountId]);

  // Most-used categories (last 90 days) first, so the usual taps are always in reach.
  const ranked = useMemo(() => {
    const since = toISODate(addDays(new Date(), -90));
    const usage = new Map<string, number>();
    for (const t of transactions) if (t.date >= since) usage.set(t.categoryId, (usage.get(t.categoryId) ?? 0) + 1);
    return categories
      .filter((c) => c.kind === kind && !c.archived)
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || Number(a.name === 'Other') - Number(b.name === 'Other'));
  }, [categories, transactions, kind]);
  const visible = showAll ? ranked : ranked.slice(0, 11);

  const account = active.find((a) => a.id === accountId);
  const value = parseAmount(amount) ?? 0;

  async function save(categoryId: string) {
    if (!account) {
      toast.error('Add an account first');
      return;
    }
    if (!value || Number.isNaN(value)) {
      if (amount.trim()) toast.error('Enter an amount like 12.50');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      amountRef.current?.focus();
      return;
    }
    const cat = categories.find((c) => c.id === categoryId)!;
    try {
      const tx = await create.mutateAsync({ accountId: account.id, kind, amount: value, categoryId, date, note: note.trim() || undefined });
      try {
        localStorage.setItem(LAST_ACCOUNT, account.id);
      } catch {
        /* ignore */
      }
      toast.success(`${kind === 'expense' ? 'Spent' : 'Received'} ${formatMoney(value, account.currency)} · ${cat.name}`, {
        description: account.name,
        action: { label: 'Undo', onClick: () => remove.mutate(tx.id) },
      });
      setAmount('');
      setNote('');
      setShowNote(false);
      setDate(toISODate(new Date()));
      onDone?.();
      amountRef.current?.focus();
    } catch {
      // The global mutation error handler already showed a toast.
    }
  }

  if (!active.length) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted">Create your first account to start tracking.</p>
        <Link to="/accounts?new=1" className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink">
          Add account
        </Link>
      </div>
    );
  }

  const today = toISODate(new Date());
  const yesterday = toISODate(addDays(new Date(), -1));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Segmented
          value={kind}
          onChange={(k) => setKind(k)}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
        <div className="relative">
          <select
            aria-label="Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="appearance-none h-9 max-w-44 truncate rounded-xl border border-line bg-surface-2 pl-8 pr-7 text-sm font-medium text-ink outline-none cursor-pointer"
          >
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {account && (
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 rounded-full" style={{ background: account.color }} />
          )}
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-4 text-muted" />
        </div>
      </div>

      <div className={clsx('mt-4 flex items-baseline gap-2 border-b-2 pb-2 transition-colors', shake ? 'border-bad' : 'border-line focus-within:border-brand')}>
        <span className={clsx('text-3xl font-bold', kind === 'expense' ? 'text-expense' : 'text-income')}>{kind === 'expense' ? '−' : '+'}</span>
        <input
          ref={amountRef}
          autoFocus={autoFocus}
          inputMode="decimal"
          aria-label="Amount"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && visible[0]) save(visible[0].id);
          }}
          className={clsx('w-full bg-transparent text-4xl font-bold num outline-none placeholder:text-surface-3', shake && 'animate-pulse')}
        />
        <span className="text-lg font-semibold text-muted">{account?.currency}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {[
          { v: today, l: 'Today' },
          { v: yesterday, l: 'Yesterday' },
        ].map((d) => (
          <button
            key={d.v}
            type="button"
            onClick={() => setDate(d.v)}
            className={clsx('rounded-lg px-2.5 py-1 font-medium cursor-pointer', date === d.v ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:text-ink')}
          >
            {d.l}
          </button>
        ))}
        <label className={clsx('relative flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium cursor-pointer', date !== today && date !== yesterday ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:text-ink')}>
          <CalendarDays className="size-3.5" />
          {date !== today && date !== yesterday ? new Date(`${date}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Pick date'}
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <button type="button" onClick={() => setShowNote((s) => !s)} className={clsx('flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium cursor-pointer', showNote || note ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:text-ink')}>
          <MessageSquareText className="size-3.5" /> Note
        </button>
      </div>
      {showNote && (
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was it for? (optional)"
          maxLength={200}
          className="mt-2 w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-brand"
        />
      )}

      <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wider text-muted">Tap a category to save</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {visible.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={create.isPending}
            onClick={() => save(c.id)}
            className="group flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-2.5 text-center transition hover:-translate-y-0.5 hover:shadow-md active:scale-95 cursor-pointer disabled:opacity-60"
            style={{ ['--c' as string]: c.color }}
          >
            <span className="flex size-9 items-center justify-center rounded-xl transition group-hover:scale-110" style={{ background: `${c.color}22`, color: c.color }}>
              <Icon name={c.icon} className="size-[18px]" />
            </span>
            <span className="text-[11px] font-medium leading-tight text-ink-2 line-clamp-2">{c.name}</span>
          </button>
        ))}
        {ranked.length > 11 && (
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line p-2.5 text-[11px] font-medium text-muted hover:text-ink cursor-pointer"
          >
            <ChevronDown className={clsx('size-5 transition', showAll && 'rotate-180')} />
            {showAll ? 'Less' : `${ranked.length - 11} more`}
          </button>
        )}
      </div>
    </div>
  );
}
