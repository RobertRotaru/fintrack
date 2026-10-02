import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { habitSummary, normalize, type HabitSummary, type InvestmentAdvice } from '@ft/core';
import { get, run } from '../db';
import { HttpError, uid } from '../http';
import { toUser, visibleAccounts, visibleGoals, visibleTransactions } from '../repo';

export const ai = Router();

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';
const NOT_CONFIGURED = 'The AI coach is not configured. Set ANTHROPIC_API_KEY in server/.env and restart the server.';
const configured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const SYSTEM = `You are the investment-education coach inside a personal finance app.
You receive an anonymised summary of one user's real money habits (amounts are monthly averages in their base currency, computed from up to 12 months of tracked transactions and current account balances).

Your job: suggest how this person could start or improve investing, grounded in their actual habits. Be concrete and use their numbers.
- First judge readiness: high-interest debt (credit cards) should usually be paid down first, and an emergency fund of roughly 3-6 months of expenses should exist before taking market risk. Variable income argues for a bigger buffer.
- Infer a risk profile from savings rate, income stability, buffer size, and goal deadlines (short-deadline goals belong in low-risk places).
- monthlyInvestable: a realistic amount they could invest monthly without hurting their buffer or goals; 0 if they should not invest yet.
- allocation: a generic asset-class mix (e.g. global equity index funds, bonds, cash/high-yield savings, a small crypto slice only if appropriate). Percents must sum to 100. Never name individual stocks, coins, or specific fund tickers.
- recommendations: 3-6 actionable steps, ordered by priority, each tied to an observed habit (e.g. trimming a category that is a large share of spending to free up money).
- habitsObserved: 3-5 short factual observations from the data that drove your suggestions.
- Keep a warm, plain-language tone. Keep the summary to 2-3 sentences.
- disclaimer: one sentence stating this is educational, not personalised financial advice, and to consult a licensed adviser.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['riskProfile', 'summary', 'readiness', 'monthlyInvestable', 'allocation', 'recommendations', 'habitsObserved', 'disclaimer'],
  properties: {
    riskProfile: { type: 'string', enum: ['conservative', 'moderate', 'growth', 'aggressive'] },
    summary: { type: 'string' },
    readiness: {
      type: 'object',
      additionalProperties: false,
      required: ['emergencyFundMonths', 'status', 'explanation'],
      properties: {
        emergencyFundMonths: { type: 'number' },
        status: { type: 'string', enum: ['not-ready', 'build-buffer', 'ready'] },
        explanation: { type: 'string' },
      },
    },
    monthlyInvestable: { type: 'number' },
    allocation: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'percent', 'rationale'],
        properties: { label: { type: 'string' }, percent: { type: 'number' }, rationale: { type: 'string' } },
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'priority'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    habitsObserved: { type: 'array', items: { type: 'string' } },
    disclaimer: { type: 'string' },
  },
} as const;

function summaryFor(userId: string): HabitSummary {
  const user = toUser(get('SELECT * FROM users WHERE id = ?', userId)!);
  const txs = normalize(visibleTransactions(userId), user.baseCurrency);
  return habitSummary(txs, visibleAccounts(userId), visibleGoals(userId), user.baseCurrency);
}

ai.get('/investment', (req, res) => {
  const me = uid(req);
  const latest = get("SELECT payload FROM ai_reports WHERE user_id = ? AND kind = 'investment' ORDER BY created_at DESC LIMIT 1", me);
  res.json({
    configured: configured(),
    summary: summaryFor(me),
    advice: latest ? (JSON.parse(latest.payload as string) as InvestmentAdvice) : null,
  });
});

ai.post('/investment', async (req, res) => {
  const me = uid(req);
  const summary = summaryFor(me);
  if (summary.monthsAnalyzed < 1) {
    throw new HttpError(400, 'Track at least one full month of income and expenses first, so the analysis has real habits to work with.');
  }

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: `Here is my financial habit summary:\n\n${JSON.stringify(summary, null, 2)}` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new HttpError(503, NOT_CONFIGURED);
    }
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'The AI coach is busy — try again in a minute.');
    if (err instanceof Anthropic.APIConnectionError) throw new HttpError(503, 'Could not reach the AI service.');
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `AI request failed: ${err.message}`);
    // Non-API errors here are raised client-side, almost always missing credentials.
    console.error(err);
    throw new HttpError(503, NOT_CONFIGURED);
  }

  if (response.stop_reason === 'refusal') throw new HttpError(502, 'The AI declined to analyse this data. Try again later.');
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'The AI response was cut short. Try again.');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new HttpError(502, 'The AI returned no analysis.');

  const advice: InvestmentAdvice = { ...JSON.parse(text.text), generatedAt: new Date().toISOString() };
  run("INSERT INTO ai_reports (id, user_id, kind, payload) VALUES (?, ?, 'investment', ?)", randomUUID(), me, JSON.stringify(advice));
  res.json({ configured: true, summary, advice });
});
