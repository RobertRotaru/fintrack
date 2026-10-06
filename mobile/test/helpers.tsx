import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Account, Category, User } from '@ft/core';
import { ThemeProvider } from '../src/lib/theme';

export const USER: User = { id: 'u1', email: 'test@fintrack.test', name: 'Test User', baseCurrency: 'RON', country: 'RO', createdAt: '2026-01-01T00:00:00Z', bio: '', avatarUrl: null };

export const ACCOUNT: Account = {
  id: 'a1', ownerId: 'u1', householdId: null, type: 'debit', name: 'Everyday', institutionId: null, institutionName: 'Banca Transilvania',
  country: 'RO', currency: 'RON', color: '#0055b8', icon: 'wallet', image: null, initialBalance: 5000, creditLimit: null, archived: false,
  createdAt: '2026-01-01T00:00:00Z', balance: 5100,
};

export const CATEGORIES: Category[] = [
  { id: 'c1', userId: 'u1', kind: 'expense', name: 'Groceries', icon: 'shopping-cart', color: '#22c55e', isDefault: true, archived: false },
  { id: 'c2', userId: 'u1', kind: 'expense', name: 'Dining Out', icon: 'utensils', color: '#f97316', isDefault: true, archived: false },
  { id: 'c3', userId: 'u1', kind: 'income', name: 'Salary', icon: 'briefcase', color: '#10b981', isDefault: true, archived: false },
];

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

/** Every data client a test created, so they can be shut down afterwards (no stray timers). */
export const clients: QueryClient[] = [];

export function Providers({ children }: { children: ReactNode }) {
  // gcTime Infinity: no cleanup timers left running after a test (mutations default to 5 minutes).
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  clients.push(qc);
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

type Handler = (init?: RequestInit) => { status: number; body?: unknown };

/** Routes fetches to `/api/...` handlers by "METHOD /path" or "/path"; anything else is a 404. */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0]!;
    const handler = routes[`${init?.method ?? 'GET'} ${url}`] ?? routes[url];
    if (!handler) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    const out = handler(init);
    return new Response(out.body === undefined ? null : JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json' } });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export const ok = (body: unknown) => () => ({ status: 200, body });
