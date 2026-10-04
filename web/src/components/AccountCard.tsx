import { useState } from 'react';
import { Users } from 'lucide-react';
import { ACCOUNT_TYPES, findInstitution, formatMoney, type Account } from '@ft/core';
import { Icon } from '../lib/icons';
import { onColor } from '../lib/format';
import { clsx } from './ui';

export function InstitutionLogo({ institutionId, name, color, size = 28 }: { institutionId: string | null; name: string | null; color?: string; size?: number }) {
  const inst = findInstitution(institutionId);
  const [failed, setFailed] = useState(false);
  const label = (inst?.name ?? name ?? '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const bg = inst?.color ?? color ?? '#64748b';
  if (inst?.domain && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${inst.domain}&sz=64`}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="rounded-lg bg-white object-contain p-0.5"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-lg text-[10px] font-bold" style={{ width: size, height: size, background: bg, color: onColor(bg) }}>
      {label || '?'}
    </span>
  );
}

/** A personalised "card" for an account, drawn in the account's own colour. */
export function AccountCard({
  account,
  compact,
  onClick,
  sharedBy,
}: {
  account: Pick<Account, 'name' | 'type' | 'color' | 'icon' | 'image' | 'institutionId' | 'institutionName' | 'currency' | 'balance' | 'creditLimit' | 'householdId'>;
  compact?: boolean;
  onClick?: () => void;
  sharedBy?: string | null;
}) {
  const fg = onColor(account.color);
  const typeLabel = ACCOUNT_TYPES.find((t) => t.type === account.type)?.label ?? account.type;
  const used = account.type === 'credit' && account.creditLimit ? Math.min(1, Math.max(0, -account.balance) / account.creditLimit) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group relative w-full overflow-hidden rounded-3xl text-left transition hover:-translate-y-0.5 hover:shadow-xl cursor-pointer',
        compact ? 'aspect-[1.75] p-4' : 'aspect-[1.6] p-5',
      )}
      style={{
        color: fg,
        background: `radial-gradient(120% 140% at 100% 0%, ${account.color}cc 0%, ${account.color} 45%, color-mix(in oklab, ${account.color} 70%, black) 100%)`,
      }}
    >
      {account.image && <img src={account.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity" />}
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full border-[28px] opacity-10" style={{ borderColor: fg }} />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {account.institutionId || account.institutionName ? (
              <InstitutionLogo institutionId={account.institutionId} name={account.institutionName} color={account.color} size={compact ? 24 : 28} />
            ) : (
              <span className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: `${fg}22` }}>
                <Icon name={account.icon} className="size-4" />
              </span>
            )}
            <span className="truncate text-xs font-medium opacity-80">{account.institutionName ?? typeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {account.householdId && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${fg}22` }}>
                <Users className="size-3" /> {sharedBy ? sharedBy : 'Shared'}
              </span>
            )}
            <Icon name={account.icon} className="size-5 opacity-80" />
          </div>
        </div>
        <div className="mt-auto">
          <p className={clsx('font-semibold truncate', compact ? 'text-sm' : 'text-base')}>{account.name || 'Account name'}</p>
          <p className={clsx('figure num tracking-tight', compact ? 'text-xl' : 'text-2xl')}>{formatMoney(account.balance, account.currency)}</p>
          {used !== null && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: `${fg}33` }}>
                <div className="h-full rounded-full" style={{ width: `${used * 100}%`, background: fg }} />
              </div>
              <p className="mt-1 text-[10px] opacity-80">
                {Math.round(used * 100)}% of {formatMoney(account.creditLimit!, account.currency, { compact: true })} limit used
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
