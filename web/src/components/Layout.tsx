import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  ArrowLeftRight, BarChart3, Goal, Home, Lightbulb, LogOut, Menu, Moon, Plus, Settings, Sparkles, Sun, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { QuickAdd } from './QuickAdd';
import { clsx, IconButton, Modal } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/projections', label: 'Projections', icon: TrendingUp },
  { to: '/goals', label: 'Goals', icon: Goal },
  { to: '/invest', label: 'Invest', icon: Sparkles },
  { to: '/family', label: 'Family', icon: Users },
];
const MOBILE_NAV = [NAV[0], NAV[2], NAV[3], NAV[6]];

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };
  return { theme, toggle };
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

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-surface px-4 py-6">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-ink">
            <TrendingUp className="size-5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-display font-extrabold tracking-tight">Fintrack</span>
        </div>
        <button
          onClick={() => setQuickOpen(true)}
          className="mb-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-brand-ink shadow-lg shadow-brand/25 hover:brightness-110 transition cursor-pointer"
        >
          <Plus className="size-4" strokeWidth={2.5} /> Add transaction
          <kbd className="ml-1 rounded bg-white/20 px-1.5 text-[10px] font-bold">N</kbd>
        </button>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: I, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')
              }
            >
              <I className="size-[18px]" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 rounded-2xl border border-line p-2">
          <NavLink to="/settings" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 hover:bg-surface-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-fuchsia-500 text-sm font-bold text-white">
              {user?.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </NavLink>
          <IconButton label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggle}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 backdrop-blur px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-ink">
            <TrendingUp className="size-4" strokeWidth={2.5} />
          </div>
          <span className="font-display font-extrabold tracking-tight">Fintrack</span>
        </div>
        <div className="flex items-center">
          <IconButton label="Toggle theme" onClick={toggle}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
          <IconButton label="Menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-28 lg:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav with central add button */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {MOBILE_NAV.slice(0, 2).map((n) => (
            <MobileLink key={n.to} {...n} />
          ))}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setQuickOpen(true)}
              aria-label="Add transaction"
              className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-ink shadow-xl shadow-brand/30 active:scale-95 transition cursor-pointer"
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
          {[...NAV, { to: '/settings', label: 'Settings', icon: Settings, end: false }].map(({ to, label, icon: I, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium', isActive ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-2')
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

function MobileLink({ to, label, icon: I, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => clsx('flex flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-brand' : 'text-muted')}
    >
      <I className="size-5" /> {label}
    </NavLink>
  );
}
