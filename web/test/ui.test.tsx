// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { Link, Route, Routes } from 'react-router';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, Providers, mockApi } from './setup';

vi.mock('../src/lib/auth', () => ({
  useUser: () => USER,
  useAuth: () => ({ user: USER, loading: false, offline: false, logout: vi.fn(), setUser: vi.fn() }),
}));

const { ApiError, OFFLINE, api } = await import('../src/lib/api');
const { ErrorBoundary, ErrorState, NotFound, PageSkeleton, loadGate } = await import('../src/components/states');
const { moneyParts, parseAmount } = await import('../src/lib/format');

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
describe('api error classification', () => {
  it('turns a network failure into an offline error', async () => {
    mockApi({ '/accounts': () => 'network-error' });
    await expect(api('/accounts')).rejects.toMatchObject({ status: 0, message: OFFLINE });
  });
  it('treats a bare gateway error as offline, but keeps our own JSON errors', async () => {
    mockApi({ '/a': () => ({ status: 502, body: '<html>Bad gateway</html>' }), '/b': () => ({ status: 503, body: { error: 'The AI coach is not configured.' } }) });
    await expect(api('/a')).rejects.toMatchObject({ status: 0 });
    await expect(api('/b')).rejects.toMatchObject({ status: 503, message: 'The AI coach is not configured.' });
  });
  it('passes through validation errors', async () => {
    mockApi({ 'POST /x': () => ({ status: 400, body: { error: 'Name is required' } }) });
    await expect(api('/x', { body: {} })).rejects.toMatchObject({ status: 400, message: 'Name is required' });
  });
});

// ---------------------------------------------------------------------------
const q = (over: Partial<UseQueryResult<unknown>>) =>
  ({ data: undefined, error: null, isError: false, isFetching: false, refetch: vi.fn(), ...over }) as unknown as UseQueryResult<unknown>;

describe('loadGate', () => {
  it('shows a skeleton while any query has no data yet', () => {
    render(<>{loadGate([q({ data: [] }), q({})], 'list')}</>);
    expect(screen.getByTestId('page-skeleton')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
  it('shows an offline error with a working retry for every failed query', () => {
    const a = q({ isError: true, error: new ApiError(0, OFFLINE) });
    const b = q({ isError: true, error: new ApiError(0, OFFLINE) });
    render(<>{loadGate([a, b], 'charts')}</>);
    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach Fintrack");
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(a.refetch).toHaveBeenCalledOnce();
    expect(b.refetch).toHaveBeenCalledOnce();
  });
  it('distinguishes server errors', () => {
    render(<>{loadGate([q({ isError: true, error: new ApiError(500, 'boom') })], 'charts')}</>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on our side');
  });
  it('keeps showing data when only a background refetch failed', () => {
    expect(loadGate([q({ data: [1], isError: true, error: new ApiError(0, OFFLINE) })], 'list')).toBeNull();
  });
  it('treats null (e.g. "no family") as loaded data', () => {
    expect(loadGate([q({ data: null })], 'cards')).toBeNull();
  });
  it('renders every skeleton variant without crashing', () => {
    for (const v of ['dashboard', 'list', 'cards', 'charts'] as const) {
      const { unmount } = render(<PageSkeleton variant={v} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('ErrorState', () => {
  it('shows a spinner on the retry button while retrying', () => {
    render(<ErrorState error={new ApiError(0, OFFLINE)} onRetry={() => {}} retrying />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled();
  });
});

describe('ErrorBoundary', () => {
  function Bomb({ explode, message = 'kaboom' }: { explode: boolean; message?: string }) {
    if (explode) throw new Error(message);
    return <p>all good</p>;
  }
  it('catches a crash, and "Try again" recovers once the cause is gone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Harness() {
      const [explode, setExplode] = useState(true);
      return (
        <>
          <button onClick={() => setExplode(false)}>fix</button>
          <ErrorBoundary>
            <Bomb explode={explode} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId('crash-state')).toHaveTextContent('Something broke on this page');
    fireEvent.click(screen.getByText('fix'));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('all good')).toBeInTheDocument();
  });
  it('explains a failed page download and offers only a reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb explode message="Failed to fetch dynamically imported module: /src/pages/Goals.tsx" />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('crash-state')).toHaveTextContent('This page didn’t download');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});

describe('NotFound', () => {
  it('links back home', () => {
    render(
      <Providers>
        <NotFound />
      </Providers>,
    );
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});

// ---------------------------------------------------------------------------
describe('formatting helpers', () => {
  it('splits currency from the number for the hero figure', () => {
    const p = moneyParts(122955.19, 'RON');
    expect(p.currency).toBe('RON');
    expect(p.number.replace(/\D/g, '')).toBe('12295519');
    const neg = moneyParts(-5, 'EUR');
    expect(neg.number).toMatch(/-|−/);
  });
  it('parses amounts strictly', () => {
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNaN();
    expect(parseAmount('12k')).toBeNaN();
    expect(parseAmount('-3')).toBeNaN();
    expect(parseAmount('-3', true)).toBe(-3);
  });
});

// ---------------------------------------------------------------------------
// Real pages against a mocked API.

const { Accounts } = await import('../src/pages/Accounts');
const { Activity } = await import('../src/pages/Activity');
const { Invest } = await import('../src/pages/Invest');
const { Goals } = await import('../src/pages/Goals');

const tx = {
  id: 't1', accountId: 'a1', userId: 'u1', kind: 'expense', amount: 12, currency: 'RON', categoryId: 'c1', categoryName: 'Groceries',
  categoryColor: '#22c55e', categoryIcon: 'shopping-cart', date: '2026-10-01', note: 'Milk', createdAt: '2026-10-01',
};
const account = {
  id: 'a1', ownerId: 'u1', householdId: null, type: 'debit', name: 'Everyday', institutionId: null, institutionName: null, country: 'RO',
  currency: 'RON', color: '#1e3a6e', icon: 'wallet', image: null, initialBalance: 0, creditLimit: null, archived: false, createdAt: '', balance: 100,
};

describe('pages: loading, empty and error states', () => {
  it('shows a skeleton while data is loading', async () => {
    mockApi({ '/accounts': () => 'never', '/household': () => ({ status: 200, body: null }) });
    render(<Providers><Accounts /></Providers>);
    expect(await screen.findByTestId('page-skeleton')).toBeInTheDocument();
  });
  it('shows the empty state when there really are no accounts', async () => {
    mockApi({ '/accounts': () => ({ status: 200, body: [] }), '/household': () => ({ status: 200, body: null }) });
    render(<Providers><Accounts /></Providers>);
    expect(await screen.findByText('No accounts yet')).toBeInTheDocument();
  });
  it('shows an error — not "no accounts" — when the server fails, and recovers on retry', async () => {
    let fail = true;
    mockApi({
      '/accounts': () => (fail ? { status: 500, body: { error: 'db down' } } : { status: 200, body: [account] }),
      '/household': () => ({ status: 200, body: null }),
    });
    render(<Providers><Accounts /></Providers>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side');
    expect(screen.queryByText('No accounts yet')).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Everyday')).toBeInTheDocument();
  });
  it('shows the offline screen when the server is unreachable', async () => {
    mockApi({ '/transactions': () => 'network-error', '/accounts': () => ({ status: 200, body: [] }) });
    render(<Providers><Activity /></Providers>);
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach Fintrack");
  });
  it('tells "no transactions at all" apart from "no matches"', async () => {
    mockApi({ '/transactions': () => ({ status: 200, body: [] }), '/accounts': () => ({ status: 200, body: [account] }) });
    const first = render(<Providers><Activity /></Providers>);
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    first.unmount();

    mockApi({ '/transactions': () => ({ status: 200, body: [tx] }), '/accounts': () => ({ status: 200, body: [account] }), '/household': () => ({ status: 200, body: null }) });
    render(<Providers><Activity /></Providers>);
    expect(await screen.findByText('Milk')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzz-no-such-thing' } });
    expect(await screen.findByText('No matches')).toBeInTheDocument();
  });
  it('waits for history before showing the investing snapshot', async () => {
    const summary = {
      currency: 'RON', monthsAnalyzed: 0, avgMonthlyIncome: 0, avgMonthlyExpense: 0, avgMonthlySurplus: 0, savingsRate: 0, incomeVariability: 0,
      discretionaryShare: 0, topExpenseCategories: [], recurringMonthlyCosts: 0,
      balances: { liquid: 0, savings: 0, investments: 0, crypto: 0, creditCardDebt: 0, loans: 0 }, emergencyFundMonths: 0, monthlyNet: [], goals: [],
    };
    mockApi({ '/ai/investment': () => ({ status: 200, body: { configured: true, summary, advice: null } }) });
    render(<Providers><Invest /></Providers>);
    expect(await screen.findByText('Not enough history yet')).toBeInTheDocument();
    expect(screen.queryByText(/needs attention/)).toBeNull();
  });
  it('the goals page needs transaction history too, and says so when it fails', async () => {
    mockApi({ '/goals': () => ({ status: 200, body: [] }), '/transactions': () => ({ status: 500, body: { error: 'x' } }) });
    render(<Providers><Goals /></Providers>);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('What are you saving for?')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Page transitions.

const { Layout } = await import('../src/components/Layout');

describe('page transitions', () => {
  it('re-mounts the animated wrapper on every route change', async () => {
    mockApi({ '/accounts': () => ({ status: 200, body: [account] }), '/categories': () => ({ status: 200, body: [] }), '/transactions': () => ({ status: 200, body: [] }) });
    render(
      <Providers>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<p>home page</p>} />
            <Route path="reports" element={<p>reports page</p>} />
          </Route>
        </Routes>
        <Link to="/reports">go-reports</Link>
      </Providers>,
    );
    const first = screen.getByTestId('page');
    expect(first).toHaveClass('page-enter');
    act(() => fireEvent.click(screen.getByText('go-reports')));
    await waitFor(() => expect(screen.getByText('reports page')).toBeInTheDocument());
    const second = screen.getByTestId('page');
    expect(second).toHaveClass('page-enter');
    expect(second).not.toBe(first); // new element => the entrance animation plays again
  });
  it('shows a page crash inside the layout instead of blanking the app', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ '/accounts': () => ({ status: 200, body: [] }), '/categories': () => ({ status: 200, body: [] }), '/transactions': () => ({ status: 200, body: [] }) });
    function Broken(): never {
      throw new Error('render bug');
    }
    render(
      <Providers>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Broken />} />
          </Route>
        </Routes>
      </Providers>,
    );
    expect(screen.getByTestId('crash-state')).toBeInTheDocument();
    expect(screen.getAllByText('Fintrack').length).toBeGreaterThan(0); // shell still there
  });
});

describe('motion budget (static CSS checks)', () => {
  const css = readFileSync(resolve(__dirname, '../src/index.css'), 'utf8');
  const keyframes = (name: string) => css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  it('page transitions last 150–300ms', () => {
    const ms = Number(css.match(/--motion-page:\s*(\d+)ms/)?.[1]);
    expect(ms).toBeGreaterThanOrEqual(150);
    expect(ms).toBeLessThanOrEqual(300);
  });
  it('animations only touch compositor-friendly properties', () => {
    for (const name of ['page-in', 'fade-in', 'pulse-soft', 'pop']) {
      const props = [...keyframes(name).matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length, name).toBeGreaterThan(0);
      expect(props.every((p) => p === 'opacity' || p === 'transform'), `${name}: ${props}`).toBe(true);
    }
  });
  it('honours reduced-motion preferences', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    for (const cls of ['.page-enter', '.skeleton', '.skeleton-in', '.animate-pop']) expect(block).toContain(cls);
    expect(block).toContain('animation: none');
  });
});
