export type AccountType = 'debit' | 'credit' | 'savings' | 'loan' | 'investment' | 'crypto' | 'cash';
export type TxKind = 'expense' | 'income';

export interface User {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  country: string;
  createdAt: string;
}

export interface Account {
  id: string;
  ownerId: string;
  householdId: string | null;
  type: AccountType;
  name: string;
  institutionId: string | null;
  institutionName: string | null;
  country: string;
  currency: string;
  color: string;
  icon: string;
  image: string | null;
  initialBalance: number;
  creditLimit: number | null;
  archived: boolean;
  createdAt: string;
  /** Computed by the server: initialBalance + incomes - expenses. */
  balance: number;
}

export interface Category {
  id: string;
  userId: string;
  kind: TxKind;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  archived: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  userId: string;
  kind: TxKind;
  amount: number;
  /** Currency of the account at the time it was recorded. */
  currency: string;
  categoryId: string;
  /** Denormalised so shared-account members see the creator's category. */
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  date: string; // yyyy-MM-dd
  note: string | null;
  createdAt: string;
}

/** Money moved between two of the user's accounts — not income or spending. */
export interface Transfer {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  /** Amount received, in the destination account's currency. */
  toAmount: number;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  householdId: string | null;
  name: string;
  targetAmount: number;
  currency: string;
  deadline: string | null;
  icon: string;
  color: string;
  image: string | null;
  createdAt: string;
  completedAt: string | null;
  saved: number;
  contributions: GoalContribution[];
}

export interface GoalContribution {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  date: string;
  note: string | null;
}

export interface HouseholdMember {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  members: HouseholdMember[];
}

export interface Institution {
  id: string;
  name: string;
  color: string;
  domain?: string;
  types: AccountType[];
}

export interface InvestmentAdvice {
  generatedAt: string;
  riskProfile: 'conservative' | 'moderate' | 'growth' | 'aggressive';
  summary: string;
  readiness: {
    emergencyFundMonths: number;
    status: 'not-ready' | 'build-buffer' | 'ready';
    explanation: string;
  };
  monthlyInvestable: number;
  allocation: { label: string; percent: number; rationale: string }[];
  recommendations: { title: string; detail: string; priority: 'high' | 'medium' | 'low' }[];
  habitsObserved: string[];
  disclaimer: string;
}
