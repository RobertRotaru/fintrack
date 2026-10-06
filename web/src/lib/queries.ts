import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountFlows, normalize, setRates, type FxSnapshot, type Account, type Category, type Goal, type Household, type InvestmentState, type Transaction, type Transfer } from '@ft/core';
import { api } from './api';
import { useUser } from './auth';

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

/** Live exchange rates from the API; installs them into @ft/core's convert(). */
export const useFx = () =>
  useQuery({
    queryKey: keys.fx,
    queryFn: async () => {
      const fx = await api<FxResponse>('/fx');
      setRates(fx.rates);
      return fx;
    },
    staleTime: 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
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
    queryFn: () => api<InvestmentState>('/ai/investment'),
    // While the coach works in the background, check back every few seconds.
    refetchInterval: (q) => (q.state.data?.job?.status === 'running' ? 3000 : false),
  });

/** All visible transactions converted to the user's base currency, for analytics. */
export function useTxs() {
  const user = useUser();
  const q = useTransactions();
  const fx = useFx();
  // fx.dataUpdatedAt is a dependency so totals recompute when new rates arrive.
  const txs = useMemo(() => normalize(q.data ?? [], user.baseCurrency), [q.data, user.baseCurrency, fx.dataUpdatedAt]);
  return { ...q, txs };
}

/**
 * Balance movements per account (transactions and transfers), for net-worth
 * history and trends. Transfers are optional: if they fail to load, history
 * is drawn from transactions alone rather than blocking the page.
 */
export function useFlows() {
  const tx = useTransactions();
  const tr = useTransfers();
  return useMemo(() => accountFlows(tx.data ?? [], tr.data ?? []), [tx.data, tr.data]);
}

/** Mutation that invalidates the given query keys on success. */
export function useApiMutation<TBody = unknown, TResult = unknown>(
  fn: (body: TBody) => Promise<TResult>,
  invalidate: readonly (readonly string[])[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Refetch in the background so the UI is free again as soon as the write lands.
    onSuccess: () => {
      for (const k of invalidate) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

const MONEY = [keys.transactions, keys.accounts] as const;

export const useCreateTransaction = () =>
  useApiMutation(
    (body: { accountId: string; kind: string; amount: number; categoryId: string; date?: string; note?: string }) =>
      api<Transaction>('/transactions', { body }),
    MONEY,
  );
export const useUpdateTransaction = () =>
  useApiMutation(({ id, ...body }: { id: string } & Record<string, unknown>) => api<Transaction>(`/transactions/${id}`, { method: 'PATCH', body }), MONEY);
export const useDeleteTransaction = () => useApiMutation((id: string) => api(`/transactions/${id}`, { method: 'DELETE' }), MONEY);

export const useCreateTransfer = () =>
  useApiMutation((body: Record<string, unknown>) => api<Transfer>('/transfers', { body }), [keys.transfers, keys.accounts]);
export const useDeleteTransfer = () =>
  useApiMutation((id: string) => api(`/transfers/${id}`, { method: 'DELETE' }), [keys.transfers, keys.accounts]);
