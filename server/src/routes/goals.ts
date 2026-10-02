import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { CURRENCIES, decimalsFor, roundFor, toISODate } from '@ft/core';
import { get, run, tx } from '../db';
import { bad, forbidden, hexColor, iconName, image, isoDate, notFound, num, oneOf, str, uid } from '../http';
import { householdIdOf, visibleGoals } from '../repo';

export const goals = Router();

const find = (userId: string, id: string) => {
  const g = visibleGoals(userId).find((x) => x.id === id);
  if (!g) throw notFound('Goal not found');
  return g;
};

const savedOf = (goalId: string, currency: string) =>
  roundFor(get<{ s: number }>('SELECT COALESCE(SUM(amount), 0) AS s FROM goal_contributions WHERE goal_id = ?', goalId)!.s, currency);

/**
 * After savings or the target change: reaching the target completes the goal,
 * dropping back below it reopens it. A manual "mark as done" stands until the
 * next change to savings or target.
 */
function syncCompletion(goalId: string) {
  const g = get<{ target_amount: number; completed_at: string | null; currency: string }>('SELECT target_amount, completed_at, currency FROM goals WHERE id = ?', goalId)!;
  const reached = savedOf(goalId, g.currency) >= g.target_amount;
  if (reached && !g.completed_at) run('UPDATE goals SET completed_at = ? WHERE id = ?', new Date().toISOString(), goalId);
  if (!reached && g.completed_at) run('UPDATE goals SET completed_at = NULL WHERE id = ?', goalId);
}

goals.get('/', (req, res) => {
  res.json(visibleGoals(uid(req)));
});

goals.post('/', (req, res) => {
  const me = uid(req);
  const b = req.body;
  // Validate everything before writing anything.
  const name = str(b.name, 'Name', { max: 60 });
  const currency = oneOf(b.currency, 'Currency', CURRENCIES);
  const target = num(b.targetAmount, 'Target', { min: 10 ** -decimalsFor(currency), decimals: decimalsFor(currency) });
  const deadline = b.deadline ? isoDate(b.deadline, 'Deadline') : null;
  const icon = iconName(b.icon ?? 'target');
  const color = hexColor(b.color ?? '#6366f1');
  const img = image(b.image);
  const initial = num(b.initialSaved ?? 0, 'Already saved', { min: 0, decimals: decimalsFor(currency) });
  let householdId: string | null = null;
  if (b.shared) {
    householdId = householdIdOf(me);
    if (!householdId) throw forbidden('Join or create a family first to share goals');
  }

  const id = randomUUID();
  tx(() => {
    run(
      `INSERT INTO goals (id, user_id, household_id, name, target_amount, currency, deadline, icon, color, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, me, householdId, name, target, currency, deadline, icon, color, img,
    );
    if (initial > 0) {
      run(
        'INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)',
        randomUUID(), id, me, initial, toISODate(new Date()), 'Starting amount',
      );
    }
    syncCompletion(id);
  });
  res.status(201).json(find(me, id));
});

goals.patch('/:id', (req, res) => {
  const me = uid(req);
  const g = find(me, req.params.id);
  if (g.userId !== me) throw forbidden('Only the creator can edit this goal');
  const b = req.body;
  tx(() => {
    if (b.name !== undefined) run('UPDATE goals SET name = ? WHERE id = ?', str(b.name, 'Name', { max: 60 }), g.id);
    if (b.deadline !== undefined) run('UPDATE goals SET deadline = ? WHERE id = ?', b.deadline ? isoDate(b.deadline, 'Deadline') : null, g.id);
    if (b.icon !== undefined) run('UPDATE goals SET icon = ? WHERE id = ?', iconName(b.icon), g.id);
    if (b.color !== undefined) run('UPDATE goals SET color = ? WHERE id = ?', hexColor(b.color), g.id);
    if (b.image !== undefined) run('UPDATE goals SET image = ? WHERE id = ?', image(b.image), g.id);
    if (b.completed !== undefined) run('UPDATE goals SET completed_at = ? WHERE id = ?', b.completed ? new Date().toISOString() : null, g.id);
    if (b.targetAmount !== undefined) {
      run('UPDATE goals SET target_amount = ? WHERE id = ?', num(b.targetAmount, 'Target', { min: 10 ** -decimalsFor(g.currency), decimals: decimalsFor(g.currency) }), g.id);
      syncCompletion(g.id);
    }
  });
  res.json(find(me, g.id));
});

goals.delete('/:id', (req, res) => {
  const me = uid(req);
  const g = find(me, req.params.id);
  if (g.userId !== me) throw forbidden('Only the creator can delete this goal');
  run('DELETE FROM goals WHERE id = ?', g.id);
  res.status(204).end();
});

goals.post('/:id/contributions', (req, res) => {
  const me = uid(req);
  const g = find(me, req.params.id);
  const amount = num(req.body.amount, 'Amount', { decimals: decimalsFor(g.currency) });
  if (amount === 0) throw bad('Amount cannot be zero');
  if (roundFor(g.saved + amount, g.currency) < 0) throw bad(`You can withdraw at most ${g.saved} ${g.currency} from this goal`);
  const date = req.body.date ? isoDate(req.body.date, 'Date') : toISODate(new Date());
  const note = str(req.body.note, 'Note', { max: 120, optional: true }) || null;
  tx(() => {
    run('INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)', randomUUID(), g.id, me, amount, date, note);
    syncCompletion(g.id);
  });
  res.status(201).json(find(me, g.id));
});

goals.delete('/:id/contributions/:cid', (req, res) => {
  const me = uid(req);
  const g = find(me, req.params.id);
  const c = g.contributions.find((x) => x.id === req.params.cid);
  if (!c) throw notFound('Contribution not found');
  if (c.userId !== me) throw forbidden('Only the person who added this can remove it');
  // Removing a deposit that later withdrawals relied on would leave the goal negative.
  if (g.saved - c.amount < 0) throw bad('Remove the later withdrawals first — this would make the saved amount negative');
  tx(() => {
    run('DELETE FROM goal_contributions WHERE id = ?', c.id);
    syncCompletion(g.id);
  });
  res.json(find(me, g.id));
});
