-- An AI analysis in progress (or the last one that failed), one per user and kind. Analyses run in the
-- background so no request waits on the AI (hosts like Heroku end requests after 30 seconds); the app polls
-- GET /api/ai/investment. A finished analysis goes to ai_reports and its row here is deleted.
CREATE TABLE ai_jobs (
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  run_id     UUID NOT NULL,                -- which run owns the row: a stale run can't overwrite a newer one
  status     TEXT NOT NULL CHECK (status IN ('running', 'failed')),
  error      TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, kind)
);
