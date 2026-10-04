import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { Button, clsx } from './ui';

// ---------------------------------------------------------------------------
// Loading

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-xl', className)} />;
}

export type SkeletonVariant = 'dashboard' | 'list' | 'cards' | 'charts';

/**
 * Placeholder shaped like the page that's loading. It fades in only after
 * 150ms, so fast loads never flash it.
 */
export function PageSkeleton({ variant = 'charts' }: { variant?: SkeletonVariant }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="skeleton-in" data-testid="page-skeleton">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      {variant === 'dashboard' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
          <div className="flex gap-3 lg:col-span-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-64 shrink-0 rounded-3xl" />
            ))}
          </div>
        </div>
      )}
      {variant === 'charts' && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-3xl" />
            <Skeleton className="h-80 rounded-3xl" />
          </div>
        </>
      )}
      {variant === 'cards' && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-3xl" />
          ))}
        </div>
      )}
      {variant === 'list' && (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-14" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** First paint while the session is checked: the brand mark, nothing else. */
export function AppSplash({ message }: { message?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-screen flex-col items-center justify-center gap-4 skeleton-in">
      <div className="skeleton flex size-14 items-center justify-center rounded-2xl !bg-brand text-brand-ink">
        <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
          <path d="M9 20l5-5 4 4 6-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-sm text-muted">{message ?? 'Loading Fintrack…'}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Errors

function describe(error: unknown): { title: string; detail: string; offline: boolean } {
  if (error instanceof ApiError && error.status === 0) {
    return { title: "Can't reach Fintrack", detail: 'The server is not responding. Check your connection — we’ll keep your place.', offline: true };
  }
  if (error instanceof ApiError && error.status >= 500) {
    return { title: 'Something went wrong on our side', detail: 'The server ran into a problem loading this page. Trying again usually helps.', offline: false };
  }
  return { title: 'This page couldn’t load', detail: (error as Error)?.message || 'An unexpected error occurred.', offline: false };
}

export function ErrorState({ error, onRetry, retrying, compact }: { error: unknown; onRetry?: () => void; retrying?: boolean; compact?: boolean }) {
  const { title, detail, offline } = describe(error);
  const Icon = offline ? CloudOff : TriangleAlert;
  return (
    <div role="alert" data-testid="error-state" className={clsx('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'card py-16 px-6')}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-bad-soft text-bad">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{detail}</p>
      {onRetry && (
        <Button className="mt-5" variant="secondary" onClick={onRetry} loading={retrying}>
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Loading/error gate for a page's queries. Returns what to render instead of
 * the page, or null when every query has data. Queries that already have data
 * keep showing it even if a background refetch fails.
 */
export function loadGate(queries: UseQueryResult<unknown>[], variant: SkeletonVariant): ReactNode | null {
  const failed = queries.filter((q) => q.isError && q.data === undefined);
  if (failed.length) {
    const retrying = failed.some((q) => q.isFetching);
    return <ErrorState error={failed[0].error} retrying={retrying} onRetry={() => failed.forEach((q) => void q.refetch())} />;
  }
  if (queries.some((q) => q.data === undefined)) return <PageSkeleton variant={variant} />;
  return null;
}

/** Catches render crashes (and failed page downloads) so one page can't blank the app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // A lazy page chunk that fails to download — usually offline or a new deploy.
    const chunk = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message);
    return (
      <div role="alert" data-testid="crash-state" className="card flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-bad-soft text-bad">
          <TriangleAlert className="size-7" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold">{chunk ? 'This page didn’t download' : 'Something broke on this page'}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          {chunk ? 'You may be offline, or Fintrack was just updated. Reloading usually fixes it.' : 'The rest of the app still works. Try again, or head back home.'}
        </p>
        <div className="mt-5 flex gap-2">
          {!chunk && (
            <Button variant="secondary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          )}
          <Button onClick={() => location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
}

export function NotFound() {
  return (
    <div data-testid="not-found" className="card flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="font-display text-5xl font-extrabold text-brand-fg">404</p>
      <h2 className="mt-2 text-lg font-semibold">This page doesn’t exist</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">The link may be old or mistyped.</p>
      <Link to="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink">
        Back to home
      </Link>
    </div>
  );
}
