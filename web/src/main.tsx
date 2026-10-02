import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { AuthProvider, useAuth } from './lib/auth';
import { useFx } from './lib/queries';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import './index.css';

// Pages load on demand so sign-in doesn't download every chart library.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const Home = page(() => import('./pages/Home'), 'Home');
const Accounts = page(() => import('./pages/Accounts'), 'Accounts');
const Activity = page(() => import('./pages/Activity'), 'Activity');
const Reports = page(() => import('./pages/Reports'), 'Reports');
const Insights = page(() => import('./pages/Insights'), 'Insights');
const Projections = page(() => import('./pages/Projections'), 'Projections');
const Goals = page(() => import('./pages/Goals'), 'Goals');
const Invest = page(() => import('./pages/Invest'), 'Invest');
const Family = page(() => import('./pages/Family'), 'Family');
const Settings = page(() => import('./pages/Settings'), 'Settings');

const queryClient = new QueryClient({
  // Every failed write surfaces its server message, including fire-and-forget ones.
  mutationCache: new MutationCache({ onError: (e) => void toast.error(e.message) }),
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

function App() {
  const { user, loading } = useAuth();
  // Wait for live rates (or their failure — the fallback table then applies) so
  // the first render already uses them.
  const fx = useFx();
  if (loading || fx.isLoading) return <Spinner />;
  if (!user) return <AuthPage />;
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="transactions" element={<Activity />} />
          <Route path="reports" element={<Reports />} />
          <Route path="insights" element={<Insights />} />
          <Route path="projections" element={<Projections />} />
          <Route path="goals" element={<Goals />} />
          <Route path="invest" element={<Invest />} />
          <Route path="family" element={<Family />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-center" richColors closeButton toastOptions={{ className: '!rounded-2xl' }} />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
