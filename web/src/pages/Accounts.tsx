import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Archive, ArchiveRestore, Plus } from 'lucide-react';
import { ACCOUNT_TYPES, convert, type Account } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { useMoney } from '../lib/format';
import { keys, useAccounts, useApiMutation, useHousehold } from '../lib/queries';
import { AccountCard } from '../components/AccountCard';
import { AccountForm } from '../components/AccountForm';
import { Button, Card, Empty, Modal, PageHeader } from '../components/ui';
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
  const archive = useApiMutation(({ id, archived }: { id: string; archived: boolean }) => api(`/accounts/${id}`, { method: 'PATCH', body: { archived } }), [keys.accounts]);

  const gate = loadGate([accountsQ], 'cards');
  if (gate) return gate;

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const base = (a: Account) => convert(a.balance, a.currency, user.baseCurrency);
  const assets = active.filter((a) => !LIABILITY.has(a.type)).reduce((s, a) => s + base(a), 0);
  const debts = active.filter((a) => LIABILITY.has(a.type)).reduce((s, a) => s + base(a), 0);
  const ownerName = (a: Account) => (a.ownerId === user.id ? null : (household?.members.find((m) => m.userId === a.ownerId)?.name.split(' ')[0] ?? 'Family'));

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Every place your money lives."
        action={
          <Button onClick={() => setParams({ new: '1' })}>
            <Plus className="size-4" /> Add account
          </Button>
        }
      />

      {active.length > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          {[
            { l: 'Assets', v: assets },
            { l: 'Debts', v: debts },
            { l: 'Net worth', v: assets + debts },
          ].map((x) => (
            <Card key={x.l} className="!p-4">
              <p className="text-xs text-muted">{x.l}</p>
              <p className="mt-1 font-display text-lg sm:text-2xl font-bold num truncate">{money(x.v)}</p>
            </Card>
          ))}
        </div>
      )}

      {!active.length ? (
        <Card>
          <Empty icon="wallet" title="No accounts yet" action={<Button onClick={() => setParams({ new: '1' })}>Add your first account</Button>}>
            Bank accounts, credit cards, loans, investments, crypto or plain cash.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-8">
          {ACCOUNT_TYPES.map((t) => {
            const list = active.filter((a) => a.type === t.type);
            if (!list.length) return null;
            return (
              <section key={t.type}>
                <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-ink-2">
                  {t.label}
                  <span className="text-muted num">{money(list.reduce((s, a) => s + base(a), 0))}</span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => (
                    <AccountCard key={a.id} account={a} sharedBy={ownerName(a)} onClick={() => setEditing(a)} />
                  ))}
                </div>
              </section>
            );
          })}
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
