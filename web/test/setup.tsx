import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { User } from '@ft/core';

export const USER: User = { id: 'u1', email: 'test@fintrack.test', name: 'Test User', baseCurrency: 'RON', country: 'RO', createdAt: '2026-01-01' };

type Handler = (init?: RequestInit) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }> | 'network-error' | 'never';

/** Routes `/api/...` fetches to handlers; anything unrouted is a 404. */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^\/api/, '').split('?')[0];
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key] ?? routes[url];
    if (!handler) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    const out = await handler(init);
    if (out === 'network-error') throw new TypeError('Failed to fetch');
    if (out === 'never') return new Promise<Response>(() => {});
    return new Response(out.body === undefined ? null : typeof out.body === 'string' ? out.body : JSON.stringify(out.body), {
      status: out.status,
      headers: typeof out.body === 'string' ? {} : { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function Providers({ children, path = '/' }: { children: ReactNode; path?: string }) {
  // No retries and no caching between tests, so each state is reached immediately.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}
