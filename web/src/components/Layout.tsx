import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  ArrowLeftRight, BarChart3, Goal, Home, Lightbulb, LogOut, Menu, Moon, PieChart, Plus, Settings, Sparkles, Sun, TrendingUp, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { QuickAdd } from './QuickAdd';
import { ErrorBoundary, PageSkeleton, type SkeletonVariant } from './states';
import { Avatar, IconButton, Modal, clsx } from './ui';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/spending', label: 'Spending', icon: PieChart },
  { to: '/goals', label: 'Goals', icon: Goal },
  { to: '/family', label: 'Family', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
];
/** Deeper tools — still one click away, but out of the main story. */
const MORE: NavItem[] = [
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/projections', label: 'Projections', icon: TrendingUp },
  { to: '/invest', label: 'Invest', icon: Sparkles },
];
const SETTINGS: NavItem = { to: '/settings', label: 'Settings', icon: Settings };
const MOBILE_NAV = [NAV[0], NAV[1], NAV[3], NAV[5]];

/** The brand mark: a rising line inside a soft leaf-green tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center justify-center rounded-[11px] bg-brand text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]', className)}>
      <svg viewBox="0 0 32 32" className="size-[62%]" aria-hidden="true">
        <path d="M7 21l5.5-5.5 4 4L25 11" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function SideLink({ to, label, icon: I, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
          isActive ? 'bg-surface text-ink shadow-[var(--shadow)]' : 'text-ink-2 hover:bg-surface/60 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={clsx('absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
          <I className={clsx('size-[18px] transition', isActive ? 'text-brand-fg' : 'text-muted group-hover:text-ink-2')} strokeWidth={isActive ? 2.2 : 1.8} />
          {label}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // "N" anywhere (outside inputs) opens quick add.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't stack Quick Add on top of another open dialog.
      if (document.querySelector('[role=dialog]')) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setQuickOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [location.pathname]);

  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  return (
    <div className="min-h-screen lg:pl-[264px]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col border-r border-line bg-sidebar/80 backdrop-blur-xl px-4 py-7">
        <div className="mb-9 flex items-center gap-2.5 px-3">
          <BrandMark className="size-8" />
          <span className="font-display text-[26px] leading-none tracking-[-0.02em]">Fintrack</span>
        </div>
        <button
          onClick={() => setQuickOpen(true)}
          className="group mx-1 mb-7 flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_6px_16px_-6px_var(--brand-glow)] transition hover:-translate-y-px hover:brightness-[1.06] cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25"
        >
          <Plus className="size-4" strokeWidth={2.5} /> Add transaction
          <kbd className="ml-auto rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">N</kbd>
        </button>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <SideLink key={n.to} {...n} />
          ))}
        </nav>
        <p className="eyebrow mb-2 mt-7 px-3">More</p>
        <nav aria-label="More" className="flex flex-col gap-0.5">
          {MORE.map((n) => (
            <SideLink key={n.to} {...n} />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <SideLink {...SETTINGS} />
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface/70 p-2">
            <NavLink to="/settings" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 hover:bg-surface-2">
              <Avatar name={user?.name ?? '?'} size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </NavLink>
            <IconButton label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggle}>
              <ThemeIcon className="size-4" />
            </IconButton>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 backdrop-blur px-4 h-14">
        <div className="flex items-center gap-2">
          <BrandMark className="size-7" />
          <span className="font-display text-xl tracking-[-0.02em]">Fintrack</span>
        </div>
        <div className="flex items-center">
          <IconButton label="Toggle theme" onClick={toggle}>
            <ThemeIcon className="size-4" />
          </IconButton>
          <IconButton label="Menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 sm:px-8 lg:px-12 xl:px-16 py-7 lg:py-12 pb-28 lg:pb-16">
        {/* Keyed by route: replays the entrance motion and resets the crash boundary. */}
        <div key={location.pathname} className="page-enter" data-testid="page">
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton variant={skeletonFor(location.pathname)} />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav with central add button */}
      <nav aria-label="Mobile" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {MOBILE_NAV.slice(0, 2).map((n) => (
            <MobileLink key={n.to} {...n} />
          ))}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setQuickOpen(true)}
              aria-label="Add transaction"
              className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-ink shadow-[0_10px_24px_-8px_var(--brand-glow)] active:scale-95 transition cursor-pointer"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </button>
          </div>
          {MOBILE_NAV.slice(2).map((n) => (
            <MobileLink key={n.to} {...n} />
          ))}
        </div>
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="grid grid-cols-3 gap-2">
          {[...NAV, ...MORE, SETTINGS].map(({ to, label, icon: I, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium', isActive ? 'border-brand bg-brand-soft text-brand-fg' : 'border-line text-ink-2')
              }
            >
              <I className="size-5" /> {label}
            </NavLink>
          ))}
        </div>
        <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-medium text-bad cursor-pointer">
          <LogOut className="size-4" /> Sign out
        </button>
      </Modal>

      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Quick add">
        <QuickAdd onDone={() => setQuickOpen(false)} />
      </Modal>
    </div>
  );
}

function skeletonFor(path: string): SkeletonVariant {
  if (path === '/') return 'dashboard';
  if (path === '/transactions') return 'list';
  if (path === '/goals' || path === '/accounts' || path === '/family') return 'cards';
  return 'charts';
}

function MobileLink({ to, label, icon: I, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => clsx('flex flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-brand-fg' : 'text-muted')}
    >
      <I className="size-5" /> {label}
    </NavLink>
  );
}
