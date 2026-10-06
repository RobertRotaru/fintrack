import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  accountFlows, normalize, setRates,
  type Account, type Category, type FxSnapshot, type Goal, type HabitSummary, type Household, type InvestmentAdvice, type Transaction, type Transfer,
} from '@ft/core';
import { api } from './api';
import { useUser } from './auth';

/** Same keys and endpoints as the web app (web/src/lib/queries.ts). */
export const keys = {
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  transactions: ['transactions'] as const,
  transfers: ['transfers'] as const,
  goals: ['goals'] as const,
  household: ['household'] as const,
  investment: ['ai', 'investment'] as const,
  fx: ['fx'] as const,
};

export type FxResponse = FxSnapshot & { attribution: { label: string; url: string } };

export const useFx = () =>
  useQuery({
    queryKey: keys.fx,
    queryFn: async () => {
      const fx = await api<FxResponse>('/fx');
      setRates(fx.rates);
      return fx;
    },
    staleTime: 60 * 60 * 1000,
  });

export const useAccounts = () => useQuery({ queryKey: keys.accounts, queryFn: () => api<Account[]>('/accounts') });
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: () => api<Category[]>('/categories') });
export const useTransactions = () => useQuery({ queryKey: keys.transactions, queryFn: () => api<Transaction[]>('/transactions') });
export const useTransfers = () => useQuery({ queryKey: keys.transfers, queryFn: () => api<Transfer[]>('/transfers') });
export const useGoals = () => useQuery({ queryKey: keys.goals, queryFn: () => api<Goal[]>('/goals') });
export const useHousehold = () => useQuery({ queryKey: keys.household, queryFn: () => api<Household | null>('/household') });
export const useInvestment = () =>
  useQuery({
    queryKey: keys.investment,
    queryFn: () => api<{ configured: boolean; summary: HabitSummary; advice: InvestmentAdvice | null }>('/ai/investment'),
  });

/** All visible transactions in the user's base currency, for analytics. */
export function useTxs() {
  const user = useUser();
  const q = useTransactions();
  const fx = useFx();
  const txs = useMemo(() => normalize(q.data ?? [], user.baseCurrency), [q.data, user.baseCurrency, fx.dataUpdatedAt]);
  return { ...q, txs };
}

/** Balance movements per account, for net-worth history and trends. */
export function useFlows() {
  const tx = useTransactions();
  const tr = useTransfers();
  return useMemo(() => accountFlows(tx.data ?? [], tr.data ?? []), [tx.data, tr.data]);
}

export function useApiMutation<TBody = unknown, TResult = unknown>(fn: (body: TBody) => Promise<TResult>, invalidate: readonly (readonly string[])[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of invalidate) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

const MONEY = [keys.transactions, keys.accounts] as const;

export type TxBody = { accountId: string; kind: string; amount: number; categoryId: string; date?: string; note?: string };

export const useCreateTransaction = () => useApiMutation((body: TxBody) => api<Transaction>('/transactions', { body }), MONEY);
export const useUpdateTransaction = () =>
  useApiMutation(({ id, ...body }: { id: string } & Partial<TxBody>) => api<Transaction>(`/transactions/${id}`, { method: 'PATCH', body }), MONEY);
export const useDeleteTransaction = () => useApiMutation((id: string) => api(`/transactions/${id}`, { method: 'DELETE' }), MONEY);

/** Everything the app shows, refetched together for pull-to-refresh. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.refetchQueries({ type: 'active' });
}
