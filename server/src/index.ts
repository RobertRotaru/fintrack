import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { HttpError, requireAuth } from './http';
import { auth } from './routes/auth';
import { accounts } from './routes/accounts';
import { categories } from './routes/categories';
import { transactions } from './routes/transactions';
import { goals } from './routes/goals';
import { transfers } from './routes/transfers';
import { household } from './routes/household';
import { ai } from './routes/ai';
import { demo } from './routes/demo';
import { FX_ATTRIBUTION, currentRates, startRateUpdates } from './fx';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.get('/api/fx', (_req, res) => {
  res.json({ ...currentRates(), attribution: FX_ATTRIBUTION });
});
app.use('/api/auth', auth);
app.use('/api/accounts', requireAuth, accounts);
app.use('/api/categories', requireAuth, categories);
app.use('/api/transactions', requireAuth, transactions);
app.use('/api/transfers', requireAuth, transfers);
app.use('/api/goals', requireAuth, goals);
app.use('/api/household', requireAuth, household);
app.use('/api/ai', requireAuth, ai);
app.use('/api/demo', requireAuth, demo);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = Number(process.env.PORT ?? 4000);
startRateUpdates();
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
