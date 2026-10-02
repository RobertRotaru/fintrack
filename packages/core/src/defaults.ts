import type { AccountType, TxKind } from './types';

export interface DefaultCategory {
  kind: TxKind;
  name: string;
  icon: string;
  color: string;
}

/**
 * Default categories. Built from the categories that recur across common budgeting
 * frameworks (50/30/20 needs/wants/savings, envelope budgeting, YNAB/Mint-style
 * category sets): fixed needs first, then variable needs, then wants, then obligations.
 * Users can rename, recolour, archive, or add their own.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Needs — fixed
  { kind: 'expense', name: 'Housing', icon: 'home', color: '#6366f1' },
  { kind: 'expense', name: 'Utilities', icon: 'zap', color: '#f59e0b' },
  { kind: 'expense', name: 'Internet & Phone', icon: 'wifi', color: '#0ea5e9' },
  { kind: 'expense', name: 'Insurance', icon: 'shield', color: '#64748b' },
  // Needs — variable
  { kind: 'expense', name: 'Groceries', icon: 'shopping-cart', color: '#22c55e' },
  { kind: 'expense', name: 'Transport', icon: 'bus', color: '#3b82f6' },
  { kind: 'expense', name: 'Fuel', icon: 'fuel', color: '#ef4444' },
  { kind: 'expense', name: 'Health', icon: 'heart-pulse', color: '#ec4899' },
  { kind: 'expense', name: 'Kids', icon: 'baby', color: '#f472b6' },
  { kind: 'expense', name: 'Pets', icon: 'paw-print', color: '#a16207' },
  { kind: 'expense', name: 'Education', icon: 'graduation-cap', color: '#8b5cf6' },
  // Wants
  { kind: 'expense', name: 'Dining Out', icon: 'utensils', color: '#f97316' },
  { kind: 'expense', name: 'Coffee & Snacks', icon: 'coffee', color: '#92400e' },
  { kind: 'expense', name: 'Shopping', icon: 'shopping-bag', color: '#d946ef' },
  { kind: 'expense', name: 'Entertainment', icon: 'clapperboard', color: '#a855f7' },
  { kind: 'expense', name: 'Subscriptions', icon: 'repeat', color: '#14b8a6' },
  { kind: 'expense', name: 'Travel', icon: 'plane', color: '#06b6d4' },
  { kind: 'expense', name: 'Personal Care', icon: 'sparkles', color: '#fb7185' },
  { kind: 'expense', name: 'Sports & Fitness', icon: 'dumbbell', color: '#84cc16' },
  { kind: 'expense', name: 'Gifts & Donations', icon: 'gift', color: '#e11d48' },
  // Obligations
  { kind: 'expense', name: 'Debt Payments', icon: 'landmark', color: '#475569' },
  { kind: 'expense', name: 'Taxes & Fees', icon: 'receipt', color: '#78716c' },
  { kind: 'expense', name: 'Other', icon: 'circle-dashed', color: '#94a3b8' },

  { kind: 'income', name: 'Salary', icon: 'briefcase', color: '#10b981' },
  { kind: 'income', name: 'Bonus', icon: 'award', color: '#22c55e' },
  { kind: 'income', name: 'Freelance', icon: 'laptop', color: '#06b6d4' },
  { kind: 'income', name: 'Business', icon: 'store', color: '#0ea5e9' },
  { kind: 'income', name: 'Investments', icon: 'trending-up', color: '#6366f1' },
  { kind: 'income', name: 'Interest', icon: 'percent', color: '#8b5cf6' },
  { kind: 'income', name: 'Rental', icon: 'building', color: '#f59e0b' },
  { kind: 'income', name: 'Benefits', icon: 'hand-heart', color: '#ec4899' },
  { kind: 'income', name: 'Gifts', icon: 'gift', color: '#f43f5e' },
  { kind: 'income', name: 'Refunds', icon: 'undo-2', color: '#14b8a6' },
  { kind: 'income', name: 'Other', icon: 'circle-dashed', color: '#94a3b8' },
];

export const ACCOUNT_TYPES: { type: AccountType; label: string; icon: string; description: string }[] = [
  { type: 'debit', label: 'Debit / Current', icon: 'credit-card', description: 'Everyday bank account and debit card' },
  { type: 'credit', label: 'Credit card', icon: 'wallet-cards', description: 'Revolving credit with a limit' },
  { type: 'savings', label: 'Savings', icon: 'piggy-bank', description: 'Savings or deposit account' },
  { type: 'loan', label: 'Loan', icon: 'landmark', description: 'Mortgage, car or personal loan' },
  { type: 'investment', label: 'Investment', icon: 'trending-up', description: 'Brokerage, pension, funds' },
  { type: 'crypto', label: 'Crypto', icon: 'bitcoin', description: 'Exchange or self-custody wallet' },
  { type: 'cash', label: 'Cash', icon: 'banknote', description: 'Physical cash in your wallet' },
];

/** Palette offered when personalising accounts, goals and categories. */
export const PERSONAL_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b',
  '#0f172a', '#78716c',
];

export const ACCOUNT_ICONS = [
  'credit-card', 'wallet-cards', 'wallet', 'piggy-bank', 'landmark', 'trending-up', 'bitcoin',
  'banknote', 'coins', 'gem', 'home', 'car', 'plane', 'heart', 'star', 'sparkles', 'briefcase',
  'graduation-cap', 'baby', 'shield', 'rocket', 'crown', 'leaf', 'sun',
];

export const GOAL_ICONS = [
  'target', 'car', 'home', 'plane', 'gamepad-2', 'laptop', 'smartphone', 'camera', 'bike',
  'graduation-cap', 'heart', 'baby', 'party-popper', 'tree-palm', 'shield', 'gift', 'sofa', 'watch',
];
