import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, ImagePlus, Search, Trash2, Wand2 } from 'lucide-react';
import {
  ACCOUNT_ICONS, ACCOUNT_TYPES, COUNTRIES, CURRENCIES, PERSONAL_COLORS, countryByCode, institutionsFor,
  type Account, type AccountType, type Institution,
} from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { Icon } from '../lib/icons';
import { resizeImage } from '../lib/format';
import { keys, useApiMutation, useHousehold } from '../lib/queries';
import { AccountCard, InstitutionLogo } from './AccountCard';
import { Button, ColorPicker, Field, IconPicker, Input, Select, clsx } from './ui';

const DEFAULT_ICON: Record<AccountType, string> = {
  debit: 'credit-card', credit: 'wallet-cards', savings: 'piggy-bank', loan: 'landmark', investment: 'trending-up', crypto: 'bitcoin', cash: 'banknote',
};

/** Suggests a friendly, personal name: "Robert's BT Savings", "Main card", … */
function suggestName(userName: string, type: AccountType, inst: Institution | null, custom: string): string {
  const first = userName.split(' ')[0];
  const short = (inst?.name ?? custom).split(/[ -]/)[0];
  const t = { debit: 'Everyday', credit: 'Card', savings: 'Savings', loan: 'Loan', investment: 'Portfolio', crypto: 'Crypto', cash: 'Wallet' }[type];
  if (type === 'cash') return `${first}'s wallet`;
  return short ? `${first}'s ${short} ${t}` : `${first}'s ${t}`;
}

type Draft = {
  type: AccountType;
  country: string;
  institution: Institution | null;
  customInstitution: string;
  name: string;
  color: string;
  icon: string;
  image: string | null;
  currency: string;
  initialBalance: string;
  creditLimit: string;
  shared: boolean;
};

export function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const user = useUser();
  const { data: household } = useHousehold();
  const editing = !!account;
  const [step, setStep] = useState<0 | 1 | 2>(editing ? 2 : 0);
  const [query, setQuery] = useState('');
  const [nameTouched, setNameTouched] = useState(editing);
  const fileRef = useRef<HTMLInputElement>(null);
  const [d, setD] = useState<Draft>(() => ({
    type: account?.type ?? 'debit',
    country: account?.country ?? user.country,
    institution: null,
    customInstitution: account?.institutionName ?? '',
    name: account?.name ?? '',
    color: account?.color ?? PERSONAL_COLORS[0],
    icon: account?.icon ?? 'credit-card',
    image: account?.image ?? null,
    currency: account?.currency ?? user.baseCurrency,
    initialBalance: account ? String(account.initialBalance) : '',
    creditLimit: account?.creditLimit ? String(account.creditLimit) : '',
    shared: !!account?.householdId,
  }));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const options = useMemo(() => {
    const list = institutionsFor(d.country, d.type);
    const q = query.trim().toLowerCase();
    return q ? list.filter((i) => i.name.toLowerCase().includes(q)) : list;
  }, [d.country, d.type, query]);

  const save = useApiMutation(
    (body: Record<string, unknown>) =>
      editing ? api<Account>(`/accounts/${account!.id}`, { method: 'PATCH', body }) : api<Account>('/accounts', { body }),
    [keys.accounts],
  );
  const remove = useApiMutation(() => api(`/accounts/${account!.id}`, { method: 'DELETE' }), [keys.accounts, keys.transactions]);

  function pickInstitution(inst: Institution | null) {
    const country = countryByCode(d.country);
    set({
      institution: inst,
      color: inst?.color && inst.color !== '#000000' ? inst.color : d.color,
      icon: DEFAULT_ICON[d.type],
      currency: d.type === 'crypto' ? d.currency : (country?.currency ?? d.currency),
      name: nameTouched ? d.name : suggestName(user.name, d.type, inst, d.customInstitution),
    });
    setStep(2);
  }

  async function submit() {
    if (!d.name.trim()) {
      toast.error('Give your account a name');
      return;
    }
    const body: Record<string, unknown> = {
      name: d.name.trim(),
      color: d.color,
      icon: d.icon,
      image: d.image,
      initialBalance: Number(d.initialBalance.replace(',', '.') || 0),
      creditLimit: d.type === 'credit' && d.creditLimit ? Number(d.creditLimit) : null,
      shared: d.shared,
    };
    if (!editing) {
      Object.assign(body, {
        type: d.type,
        country: d.country,
        currency: d.currency,
        institutionId: d.institution?.id ?? null,
        institutionName: d.institution ? null : d.customInstitution.trim() || null,
      });
    }
    try {
      await save.mutateAsync(body);
      toast.success(editing ? 'Account updated' : `${d.name} is ready`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // ---- Step 1: type --------------------------------------------------------
  if (step === 0) {
    return (
      <div>
        <p className="mb-4 text-sm text-muted">What kind of account is it?</p>
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                set({ type: t.type, icon: DEFAULT_ICON[t.type], currency: t.type === 'crypto' ? 'BTC' : (countryByCode(d.country)?.currency ?? user.baseCurrency) });
                setStep(t.type === 'cash' ? 2 : 1);
                if (t.type === 'cash' && !nameTouched) set({ type: t.type, icon: 'banknote', name: suggestName(user.name, 'cash', null, ''), color: '#84cc16' });
              }}
              className="flex items-start gap-3 rounded-2xl border border-line p-3.5 text-left transition hover:border-brand hover:bg-brand-soft cursor-pointer"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
                <Icon name={t.icon} className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-xs text-muted">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- Step 2: country + institution --------------------------------------
  if (step === 1) {
    return (
      <div>
        <button type="button" onClick={() => setStep(0)} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-ink cursor-pointer">
          <ArrowLeft className="size-4" /> {ACCOUNT_TYPES.find((t) => t.type === d.type)?.label}
        </button>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Select value={d.country} onChange={(e) => set({ country: e.target.value })} aria-label="Country">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bank or provider" className="pl-9" />
          </div>
        </div>
        <div className="mt-3 max-h-80 overflow-y-auto -mx-1 px-1 space-y-1">
          {options.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onClick={() => pickInstitution(inst)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2 cursor-pointer"
            >
              <InstitutionLogo institutionId={inst.id} name={inst.name} size={32} />
              <span className="flex-1 text-sm font-medium">{inst.name}</span>
              <span className="size-3 rounded-full" style={{ background: inst.color }} />
            </button>
          ))}
          {!options.length && <p className="py-6 text-center text-sm text-muted">No match — add it as a custom institution below.</p>}
        </div>
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <Input value={d.customInstitution} onChange={(e) => set({ customInstitution: e.target.value })} placeholder="Not listed? Type its name" />
          <Button variant="secondary" onClick={() => pickInstitution(null)}>
            Use
          </Button>
        </div>
      </div>
    );
  }

  // ---- Step 3: personalise --------------------------------------------------
  const preview = {
    name: d.name,
    type: d.type,
    color: d.color,
    icon: d.icon,
    image: d.image,
    institutionId: d.institution?.id ?? account?.institutionId ?? null,
    institutionName: d.institution?.name ?? (d.customInstitution || null),
    currency: d.currency,
    balance: editing ? account!.balance : Number(d.initialBalance.replace(',', '.') || 0),
    creditLimit: d.creditLimit ? Number(d.creditLimit) : null,
    householdId: d.shared ? 'x' : null,
  };

  return (
    <div className="space-y-5">
      {!editing && (
        <button type="button" onClick={() => setStep(d.type === 'cash' ? 0 : 1)} className="flex items-center gap-1 text-sm text-muted hover:text-ink cursor-pointer">
          <ArrowLeft className="size-4" /> Back
        </button>
      )}
      <div className="mx-auto max-w-xs">
        <AccountCard account={preview} />
        <p className="mt-2 text-center text-xs text-muted">Make it yours — this is how it'll look everywhere.</p>
      </div>

      <Field label="Name">
        <div className="relative">
          <Input
            value={d.name}
            maxLength={60}
            onChange={(e) => {
              setNameTouched(true);
              set({ name: e.target.value });
            }}
          />
          <button
            type="button"
            title="Suggest a name"
            onClick={() => set({ name: suggestName(user.name, d.type, d.institution, d.customInstitution) })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-brand cursor-pointer"
          >
            <Wand2 className="size-4" />
          </button>
        </div>
      </Field>

      <Field label="Colour">
        <ColorPicker value={d.color} onChange={(color) => set({ color })} colors={d.institution ? [d.institution.color, ...PERSONAL_COLORS.filter((c) => c !== d.institution!.color)].slice(0, 16) : PERSONAL_COLORS.slice(0, 16)} />
      </Field>

      <Field label="Icon">
        <IconPicker value={d.icon} onChange={(icon) => set({ icon })} icons={ACCOUNT_ICONS} color={d.color} />
      </Field>

      <Field label="Card image" hint="Optional — a photo makes the card unmistakably yours.">
        <div className="flex items-center gap-2">
          <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" /> {d.image ? 'Change image' : 'Upload image'}
          </Button>
          {d.image && (
            <Button variant="ghost" type="button" onClick={() => set({ image: null })}>
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                set({ image: await resizeImage(f, 480) });
              } catch (err) {
                toast.error((err as Error).message);
              }
              e.target.value = '';
            }}
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <Select value={d.currency} disabled={editing} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label={d.type === 'loan' ? 'Amount owed (negative)' : d.type === 'credit' ? 'Current balance' : 'Opening balance'}>
          <Input inputMode="decimal" value={d.initialBalance} placeholder="0" onChange={(e) => set({ initialBalance: e.target.value })} />
        </Field>
      </div>
      {d.type === 'credit' && (
        <Field label="Credit limit">
          <Input inputMode="decimal" value={d.creditLimit} placeholder="e.g. 5000" onChange={(e) => set({ creditLimit: e.target.value })} />
        </Field>
      )}

      {(household || d.shared) && (
        <button
          type="button"
          onClick={() => set({ shared: !d.shared })}
          className={clsx('flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition cursor-pointer', d.shared ? 'border-brand bg-brand-soft' : 'border-line')}
        >
          <span className={clsx('flex size-5 items-center justify-center rounded-md border', d.shared ? 'border-brand bg-brand text-brand-ink' : 'border-line')}>
            {d.shared && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span>
            <span className="block text-sm font-semibold">Share with {household?.name ?? 'family'}</span>
            <span className="block text-xs text-muted">Family members can see it and add transactions to it.</span>
          </span>
        </button>
      )}

      <div className="flex gap-2 pt-2">
        {editing && (
          <Button
            variant="danger"
            type="button"
            loading={remove.isPending}
            onClick={async () => {
              if (!confirm(`Delete "${account!.name}" and all its transactions? This cannot be undone.`)) return;
              await remove.mutateAsync(undefined);
              toast.success('Account deleted');
              onDone();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button className="flex-1" size="lg" onClick={submit} loading={save.isPending}>
          {editing ? 'Save changes' : 'Create account'}
        </Button>
      </div>
    </div>
  );
}
