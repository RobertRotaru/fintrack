import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { Archive, ArchiveRestore, Check, ChevronRight, Monitor, Moon, Plus, Sun } from 'lucide-react';
import { COUNTRIES, CURRENCIES, PERSONAL_COLORS, convert, type Category, type TxKind, type User } from '@ft/core';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { CATEGORY_ICON_CHOICES } from '../lib/icons';
import { useTheme, type ThemePref } from '../lib/theme';
import { keys, useAccounts, useApiMutation, useCategories, useFx } from '../lib/queries';
import {
  Button,
  Card,
  CardHeader,
  ColorPicker,
  Field,
  IconBadge,
  IconPicker,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  clsx,
} from '../components/ui';
import { ErrorState, Skeleton } from '../components/states';

export function Settings() {
  const user = useUser();
  const { setUser } = useAuth();
  const [profile, setProfile] = useState({ country: user.country, baseCurrency: user.baseCurrency });
  const save = useApiMutation((body: typeof profile) => api<User>('/auth/me', { method: 'PATCH', body }), [keys.transactions]);
  const dirty = profile.country !== user.country || profile.baseCurrency !== user.baseCurrency;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="How Fintrack works for you."
        action={
          <Link to="/profile" className="group inline-flex items-center gap-1 text-sm font-medium text-brand-fg hover:underline underline-offset-4">
            Edit your profile <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
        }
      />
      <Card>
        <CardHeader title="Preferences" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" hint="Default for new accounts and bank lists">
            <Select value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Main currency" hint="Reports convert everything into this">
            <Select value={profile.baseCurrency} onChange={(e) => setProfile({ ...profile, baseCurrency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!dirty}
            loading={save.isPending}
            onClick={async () => {
              try {
                setUser(await save.mutateAsync(profile));
                toast.success('Preferences saved');
              } catch {
                // The global mutation error handler already showed a toast.
              }
            }}
          >
            Save
          </Button>
        </div>
      </Card>
      <Appearance />
      <Categories />
      <ExchangeRates />
    </div>
  );
}

function Categories() {
  const categoriesQ = useCategories();
  const categories = categoriesQ.data ?? [];
  const [kind, setKind] = useState<TxKind>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const archive = useApiMutation(
    ({ id, archived }: { id: string; archived: boolean }) => api(`/categories/${id}`, { method: 'PATCH', body: { archived } }),
    [keys.categories],
  );
  const list = categories.filter((c) => c.kind === kind);

  return (
    <Card>
      <CardHeader
        title="Categories"
        subtitle="Rename, recolour or add your own. Archived categories keep their history."
        action={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New
          </Button>
        }
      />
      <Segmented<TxKind>
        className="mb-4"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Expenses' },
          { value: 'income', label: 'Income' },
        ]}
      />
      {categoriesQ.isError && !categoriesQ.data ? (
        <ErrorState compact error={categoriesQ.error} retrying={categoriesQ.isFetching} onRetry={() => void categoriesQ.refetch()} />
      ) : !categoriesQ.data ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-[54px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <div
              key={c.id}
              className={clsx('group flex items-center gap-3 rounded-xl border border-line p-2.5', c.archived && 'opacity-50')}
            >
              <button onClick={() => setEditing(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer">
                <IconBadge icon={c.icon} color={c.color} size="sm" />
                <span className="truncate text-sm font-medium">{c.name}</span>
                {!c.isDefault && <span className="rounded bg-brand-soft px-1.5 text-[10px] font-semibold text-brand-fg">custom</span>}
              </button>
              <button
                aria-label={c.archived ? 'Restore' : 'Archive'}
                title={c.archived ? 'Restore' : 'Archive'}
                onClick={() => archive.mutate({ id: c.id, archived: !c.archived })}
                className="text-muted opacity-0 transition hover:text-ink group-hover:opacity-100 cursor-pointer"
              >
                {c.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New category' : 'Edit category'}>
        {editing && <CategoryForm category={editing === 'new' ? undefined : editing} kind={kind} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function CategoryForm({ category, kind, onDone }: { category?: Category; kind: TxKind; onDone: () => void }) {
  const [f, setF] = useState({ name: category?.name ?? '', icon: category?.icon ?? 'tag', color: category?.color ?? PERSONAL_COLORS[0] });
  const save = useApiMutation(
    (body: typeof f) =>
      category ? api(`/categories/${category.id}`, { method: 'PATCH', body }) : api('/categories', { body: { ...body, kind } }),
    [keys.categories, keys.transactions],
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={f.icon} color={f.color} size="lg" />
        <Field label="Name">
          <Input
            autoFocus
            value={f.name}
            maxLength={40}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="e.g. Car wash"
          />
        </Field>
      </div>
      <Field label="Colour">
        <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} colors={PERSONAL_COLORS.slice(0, 16)} />
      </Field>
      <Field label="Icon">
        <div className="max-h-56 overflow-y-auto">
          <IconPicker value={f.icon} onChange={(icon) => setF({ ...f, icon })} icons={CATEGORY_ICON_CHOICES} color={f.color} />
        </div>
      </Field>
      <Button
        size="lg"
        className="w-full"
        loading={save.isPending}
        onClick={async () => {
          if (!f.name.trim()) return toast.error('Name it');
          try {
            await save.mutateAsync(f);
            toast.success(category ? 'Category updated' : 'Category added');
            onDone();
          } catch {
            // The global mutation error handler already showed a toast.
          }
        }}
      >
        {category ? 'Save' : `Add ${kind} category`}
      </Button>
    </div>
  );
}

const rateLabel = (r: number) =>
  r >= 100 ? r.toLocaleString(undefined, { maximumFractionDigits: 0 }) : r >= 1 ? r.toFixed(4) : r.toPrecision(4);

function ExchangeRates() {
  const user = useUser();
  const { data: fx, refetch, isFetching } = useFx();
  const { data: accounts = [] } = useAccounts();
  if (!fx) return null;
  // Currencies the user actually holds come first.
  const held = [...new Set(accounts.map((a) => a.currency))];
  const list = [...held, ...CURRENCIES.filter((c) => !held.includes(c))].filter((c) => c !== user.baseCurrency);
  const status =
    fx.source === 'live'
      ? `Live · updated ${new Date(fx.updatedAt!).toLocaleString()}`
      : fx.source === 'cached'
        ? `Last known rates from ${new Date(fx.updatedAt!).toLocaleString()} (rate service unreachable)`
        : 'Offline fallback rates — the rate service could not be reached';
  return (
    <Card>
      <CardHeader
        title="Exchange rates"
        subtitle={status}
        action={
          <Button size="sm" variant="secondary" loading={isFetching} onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((c) => (
          <div key={c} className="flex items-baseline justify-between border-b border-line py-1.5 text-sm">
            <span className={clsx('font-semibold', held.includes(c) ? 'text-ink' : 'text-muted')}>1 {c}</span>
            <span className="num text-ink-2">
              {rateLabel(convert(1, c, user.baseCurrency))} {user.baseCurrency}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        Fiat rates update daily ·{' '}
        <a href={fx.attribution.url} target="_blank" rel="noreferrer" className="underline hover:text-ink">
          {fx.attribution.label}
        </a>{' '}
        · crypto via Coinbase. Reports convert every account into {user.baseCurrency} with these rates.
      </p>
    </Card>
  );
}

const THEMES: { value: ThemePref; label: string; icon: typeof Sun; hint: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, hint: 'Warm ivory' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'Deep night' },
  { value: 'system', label: 'System', icon: Monitor, hint: 'Follows your device' },
];

/** A miniature of the app in a given theme, drawn with that theme's own colours. */
function ThemePreview({ dark }: { dark: boolean }) {
  const c = dark
    ? { bg: '#0a101c', side: '#0d1523', card: '#111a2a', line: '#1e2a40', ink: '#edf3f0', brand: '#4fd88f', chart: '#5cf0b0' }
    : { bg: '#f6f2ea', side: '#f1ece2', card: '#fcfaf5', line: '#e6dfd1', ink: '#143021', brand: '#1d5c3d', chart: '#2e9a68' };
  return (
    <svg viewBox="0 0 120 72" className="w-full rounded-xl" aria-hidden="true">
      <rect width="120" height="72" fill={c.bg} />
      <rect width="28" height="72" fill={c.side} />
      <rect x="6" y="8" width="14" height="4" rx="2" fill={c.ink} opacity={0.8} />
      {[18, 25, 32].map((y) => (
        <rect key={y} x="6" y={y} width="16" height="3" rx="1.5" fill={c.ink} opacity={0.25} />
      ))}
      <rect x="36" y="9" width="44" height="6" rx="3" fill={c.ink} opacity={0.85} />
      <rect x="36" y="22" width="76" height="42" rx="6" fill={c.card} stroke={c.line} />
      <path d="M42 54 C 56 50 62 40 74 42 S 96 30 106 30" fill="none" stroke={c.chart} strokeWidth="2" strokeLinecap="round" />
      <rect x="42" y="28" width="22" height="5" rx="2.5" fill={c.brand} />
    </svg>
  );
}

function Appearance() {
  const { pref, theme, setPref } = useTheme();
  return (
    <Card>
      <CardHeader title="Appearance" subtitle="The same Fintrack, in the light that suits you." />
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => {
          const selected = pref === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPref(t.value)}
              className={clsx(
                'group rounded-2xl border p-3 text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20',
                selected ? 'border-brand bg-brand-soft/60' : 'border-line hover:border-line-strong',
              )}
            >
              <ThemePreview dark={t.value === 'system' ? theme === 'dark' : t.value === 'dark'} />
              <span className="mt-3 flex items-center gap-2 text-sm font-semibold">
                <t.icon className="size-4 text-muted" /> {t.label}
                {selected && <Check className="ml-auto size-4 text-brand-fg" />}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t.hint}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
