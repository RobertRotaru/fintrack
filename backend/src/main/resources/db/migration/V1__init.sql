-- Fintrack schema.
--
-- Money is NUMERIC(24, 8): exact decimal arithmetic, 8 decimals for crypto
-- (satoshis) and room for the API's 1e12 limit. Row timestamps use
-- clock_timestamp() so rows inserted in one transaction still sort in order.

CREATE TABLE users (
  id            UUID PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  country       TEXT NOT NULL DEFAULT 'RO',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE households (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by  UUID NOT NULL REFERENCES users (id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE household_members (
  household_id UUID NOT NULL REFERENCES households (id) ON DELETE CASCADE,
  user_id      UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE accounts (
  id               UUID PRIMARY KEY,
  owner_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  household_id     UUID REFERENCES households (id) ON DELETE SET NULL,
  type             TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'savings', 'loan', 'investment', 'crypto', 'cash')),
  name             TEXT NOT NULL,
  institution_id   TEXT,
  institution_name TEXT,
  country          TEXT NOT NULL,
  currency         TEXT NOT NULL,
  color            TEXT NOT NULL,
  icon             TEXT NOT NULL,
  image            TEXT,
  initial_balance  NUMERIC(24, 8) NOT NULL DEFAULT 0,
  credit_limit     NUMERIC(24, 8) CHECK (credit_limit >= 0),
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX accounts_owner ON accounts (owner_id);
CREATE INDEX accounts_household ON accounts (household_id) WHERE household_id IS NOT NULL;

CREATE TABLE categories (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL,
  color      TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  archived   BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX categories_user ON categories (user_id);

CREATE TABLE transactions (
  id          UUID PRIMARY KEY,
  account_id  UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  amount      NUMERIC(24, 8) NOT NULL CHECK (amount > 0),
  category_id UUID NOT NULL REFERENCES categories (id),
  date        DATE NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX transactions_account_date ON transactions (account_id, date);
CREATE INDEX transactions_user ON transactions (user_id);
CREATE INDEX transactions_category ON transactions (category_id);

CREATE TABLE transfers (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  to_account_id   UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  amount          NUMERIC(24, 8) NOT NULL CHECK (amount > 0),
  to_amount       NUMERIC(24, 8) NOT NULL CHECK (to_amount > 0),
  date            DATE NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX transfers_from ON transfers (from_account_id);
CREATE INDEX transfers_to ON transfers (to_account_id);

CREATE TABLE goals (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  household_id  UUID REFERENCES households (id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  target_amount NUMERIC(24, 8) NOT NULL CHECK (target_amount > 0),
  currency      TEXT NOT NULL,
  deadline      DATE,
  icon          TEXT NOT NULL,
  color         TEXT NOT NULL,
  image         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX goals_user ON goals (user_id);
CREATE INDEX goals_household ON goals (household_id) WHERE household_id IS NOT NULL;

CREATE TABLE goal_contributions (
  id      UUID PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount  NUMERIC(24, 8) NOT NULL CHECK (amount <> 0),
  date    DATE NOT NULL,
  note    TEXT
);
CREATE INDEX goal_contributions_goal ON goal_contributions (goal_id);

CREATE TABLE ai_reports (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ai_reports_user_kind ON ai_reports (user_id, kind, created_at DESC);

-- The last good exchange-rate snapshot, so restarts work offline.
CREATE TABLE fx_cache (
  id         SMALLINT PRIMARY KEY CHECK (id = 1),
  rates      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
