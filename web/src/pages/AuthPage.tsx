import { useState, type FormEvent } from 'react';
import { BarChart3, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import { COUNTRIES, CURRENCIES } from '@ft/core';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Select } from '../components/ui';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', country: 'RO', baseCurrency: 'RON' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-[radial-gradient(120%_80%_at_0%_0%,#818cf8_0%,#6366f1_40%,#312e81_100%)] p-12 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <TrendingUp className="size-5" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-display font-extrabold tracking-tight">Fintrack</span>
        </div>
        <div>
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">Know where every coin goes.</h1>
          <p className="mt-4 max-w-md text-lg text-white/75">Accounts, budgets, goals and family money — with insights that actually tell you something.</p>
          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            {[
              { i: BarChart3, t: 'Beautiful reports' },
              { i: Sparkles, t: 'AI investing coach' },
              { i: Target, t: 'Goals with ETAs' },
              { i: Users, t: 'Shared family budget' },
            ].map(({ i: I, t }) => (
              <div key={t} className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                <I className="size-4" /> <span className="text-sm font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/50">Add an expense in two taps.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="mt-1 text-muted">{mode === 'login' ? 'Sign in to continue.' : 'It takes less than a minute.'}</p>
          </div>
          {mode === 'register' && (
            <Field label="Your name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="given-name" />
            </Field>
          )}
          <Field label="Email">
            <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
            <Input
              required
              type="password"
              minLength={mode === 'register' ? 8 : undefined}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Country">
                <Select
                  value={form.country}
                  onChange={(e) => {
                    const c = COUNTRIES.find((x) => x.code === e.target.value)!;
                    setForm({ ...form, country: c.code, baseCurrency: c.currency });
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Main currency">
                <Select value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}>
                  {CURRENCIES.filter((c) => !['BTC', 'ETH', 'USDT'].includes(c)).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-muted">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-semibold text-brand cursor-pointer"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
