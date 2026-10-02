import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './lib/auth';
import { useFx } from './lib/queries';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import { Home } from './pages/Home';
import { Accounts } from './pages/Accounts';
import { Activity } from './pages/Activity';
import { Reports } from './pages/Reports';
import { Insights } from './pages/Insights';
import { Projections } from './pages/Projections';
import { Goals } from './pages/Goals';
import { Invest } from './pages/Invest';
import { Family } from './pages/Family';
import { Settings } from './pages/Settings';
import './index.css';

const queryClient = new QueryClient({
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
