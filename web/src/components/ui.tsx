import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Check, ChevronRight, Loader2, X } from 'lucide-react';
import { Link } from 'react-router';
import { Icon } from '../lib/icons';
import { onColor } from '../lib/format';

export { clsx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.01em] transition duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        // Tactile primary: a soft top highlight, a grounded shadow, a gentle lift on hover.
        variant === 'primary' &&
          'bg-brand text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.12),0_6px_16px_-6px_var(--brand-glow)] hover:-translate-y-px hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_2px_4px_rgb(0_0_0/0.12),0_12px_24px_-8px_var(--brand-glow)]',
        variant === 'secondary' && 'bg-surface text-ink border border-line shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-line-strong hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-bad-soft text-bad hover:brightness-95',
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={clsx('inline-flex size-9 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink transition cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20', className)}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx('card p-5', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full h-11 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted outline-none hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/15 transition';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx(inputCls, 'appearance-none pr-8 bg-[length:16px] bg-[right_10px_center] bg-no-repeat', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238a8b9e' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx('inline-flex rounded-full bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition duration-200 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
            value === o.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_2px_8px_-2px_rgb(0_0_0/0.08)]' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0b1a12]/35 backdrop-blur-[3px] p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={clsx('animate-pop w-full max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-surface border border-line shadow-[var(--shadow-lg)]', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/95 backdrop-blur px-6 pt-6 pb-3">
          <h2 className="text-2xl">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="mb-5 flex size-16 items-center justify-center rounded-[20px] bg-brand-soft text-brand-fg ring-8 ring-brand-soft/40">
        <Icon name={icon} className="size-7" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function IconBadge({ icon, color, size = 'md', image }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg'; image?: string | null }) {
  const cls = size === 'sm' ? 'size-8 rounded-lg' : size === 'md' ? 'size-10 rounded-xl' : 'size-14 rounded-2xl';
  const iconCls = size === 'sm' ? 'size-4' : size === 'md' ? 'size-5' : 'size-7';
  if (image) return <img src={image} alt="" className={clsx(cls, 'object-cover shrink-0')} />;
  return (
    <span className={clsx(cls, 'inline-flex shrink-0 items-center justify-center')} style={{ background: `${color}22`, color }}>
      <Icon name={icon} className={iconCls} />
    </span>
  );
}

export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          onClick={() => onChange(c)}
          className="size-8 rounded-full ring-offset-2 ring-offset-surface transition hover:scale-110 cursor-pointer flex items-center justify-center"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}
        >
          {value === c && <Check className="size-4" style={{ color: onColor(c) }} />}
        </button>
      ))}
      <label className="size-8 rounded-full border-2 border-dashed border-line flex items-center justify-center cursor-pointer text-muted hover:text-ink" title="Custom colour">
        <span className="text-lg leading-none">+</span>
        <input type="color" className="sr-only" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function IconPicker({ value, onChange, icons, color }: { value: string; onChange: (i: string) => void; icons: string[]; color: string }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {icons.map((name) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          onClick={() => onChange(name)}
          className={clsx('aspect-square rounded-xl flex items-center justify-center transition cursor-pointer', value === name ? '' : 'text-muted hover:bg-surface-2 hover:text-ink')}
          style={value === name ? { background: `${color}22`, color } : undefined}
        >
          <Icon name={name} className="size-5" />
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, color, size = 'md', label }: { value: number; color: string; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={clsx('w-full overflow-hidden rounded-full bg-surface-3', size === 'sm' ? 'h-1.5' : size === 'md' ? 'h-2' : 'h-3')}
    >
      <div className="grow-x h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${color} 75%, var(--surface)), ${color})` }} />
    </div>
  );
}

export function ProgressRing({ value, color, size = 64, stroke = 7, children }: { value: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Delta({ value, inverse, className }: { value: number | null; inverse?: boolean; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={clsx('text-xs text-muted', className)}>new</span>;
  const good = inverse ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.5;
  const Arrow = value > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={clsx('inline-flex items-baseline gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold num', flat ? 'bg-surface-2 text-muted' : good ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad', className)}>
      {!flat && <Arrow className="size-3 shrink-0 self-center" strokeWidth={2.5} aria-label={value > 0 ? 'up' : 'down'} />}
      {Math.abs(Math.round(value))}%
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-20 text-muted">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-4xl sm:text-[44px] leading-[1.05]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A plain-language change: arrow, percentage and an optional "this month".
 * Colour follows meaning (spending down is good), and the arrow carries it too.
 */
export function Trend({ value, inverse, suffix, className }: { value: number | null; inverse?: boolean; suffix?: string; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={clsx('text-sm text-muted', className)}>{suffix ? `— ${suffix}` : '—'}</span>;
  const flat = Math.abs(value) < 0.05;
  const good = inverse ? value < 0 : value > 0;
  const Arrow = value >= 0 ? ArrowUp : ArrowDown;
  const digits = Math.abs(value) < 10 ? 1 : 0;
  return (
    // Baseline-aligned so the figure sits on the same line as neighbouring text of any size;
    // the arrow is centred on its own and stays out of the baseline calculation.
    <span className={clsx('inline-flex items-baseline gap-1 text-sm font-medium num', flat ? 'text-muted' : good ? 'text-good' : 'text-bad', className)}>
      {!flat && <Arrow className="size-[1em] shrink-0 self-center" strokeWidth={2.5} aria-label={value > 0 ? 'up' : 'down'} />}
      {Math.abs(value).toFixed(digits)}%{suffix && <span className="font-normal text-muted"> {suffix}</span>}
    </span>
  );
}

/** An editorial section heading with an optional "see all" link. */
export function SectionTitle({ title, subtitle, to, linkLabel = 'See all', action, className }: { title: ReactNode; subtitle?: ReactNode; to?: string; linkLabel?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[28px] leading-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
      {to && (
        <Link to={to} className="group inline-flex items-center gap-1 text-sm font-medium text-brand-fg hover:underline underline-offset-4">
          {linkLabel} <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

const AVATAR_TONES = ['var(--emerald)', 'var(--peach)', 'var(--cobalt)', 'var(--violet)', 'var(--sky)', 'var(--sun)'];

/** Initials on a warm tone picked from the name, so the same person always gets the same colour. */
export function Avatar({ name, size = 40, ring, src }: { name: string; size?: number; ring?: boolean; src?: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={clsx('inline-block shrink-0 rounded-full object-cover bg-surface-2', ring && 'ring-4 ring-surface')}
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  const tone = AVATAR_TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length];
  return (
    <span
      aria-hidden="true"
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', ring && 'ring-4 ring-surface')}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `color-mix(in oklab, ${tone} 22%, var(--surface))`, color: `color-mix(in oklab, ${tone} 75%, var(--ink))` }}
    >
      {initials}
    </span>
  );
}
