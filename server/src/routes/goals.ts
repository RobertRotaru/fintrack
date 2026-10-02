import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { CURRENCIES, toISODate } from '@ft/core';
import { run } from '../db';
import { bad, forbidden, image, isoDate, notFound, num, oneOf, str, uid } from '../http';
import { householdIdOf, visibleGoals } from '../repo';

export const goals = Router();

const find = (userId: string, id: string) => {
  const g = visibleGoals(userId).find((x) => x.id === id);
  if (!g) throw notFound('Goal not found');
  return g;
};

goals.get('/', (req, res) => {
  res.json(visibleGoals(uid(req)));
});

goals.post('/', (req, res) => {
  const me = uid(req);
  const b = req.body;
  let householdId: string | null = null;
  if (b.shared) {
    householdId = householdIdOf(me);
    if (!householdId) throw forbidden('Join or create a family first to share goals');
  }
  const id = randomUUID();
  run(
    `INSERT INTO goals (id, user_id, household_id, name, target_amount, currency, deadline, icon, color, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    me,
    householdId,
    str(b.name, 'Name', { max: 60 }),
    num(b.targetAmount, 'Target', { min: 1 }),
    oneOf(b.currency, 'Currency', CURRENCIES),
    b.deadline ? isoDate(b.deadline, 'Deadline') : null,
    str(b.icon ?? 'target', 'Icon', { max: 40 }),
    str(b.color ?? '#6366f1', 'Colour', { max: 20 }),
    image(b.image),
  );
  const initial = num(b.initialSaved ?? 0, 'Already saved', { min: 0 });
  if (initial > 0) {
    run('INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)', randomUUID(), id, me, initial, toISODate(new Date()), 'Starting amount');
  }
  res.status(201).json(find(me, id));
});

goals.patch('/:id', (req, res) => {
  const me = uid(req);
  const g = find(me, req.params.id);
  if (g.userId !== me) throw forbidden('Only the creator can edit this goal');
  const b = req.body;
  if (b.name !== undefined) run('UPDATE goals SET name = ? WHERE id = ?', str(b.name, 'Name', { max: 60 }), g.id);
  if (b.targetAmount !== undefined) run('UPDATE goals SET target_amount = ? WHERE id = ?', num(b.targetAmount, 'Target', { min: 1 }), g.id);
  if (b.deadline !== undefined) run('UPDATE goals SET deadline = ? WHERE id = ?', b.deadline ? isoDate(b.deadline, 'Deadline') : null, g.id);
  if (b.icon !== undefined) run('UPDATE goals SET icon = ? WHERE id = ?', str(b.icon, 'Icon', { max: 40 }), g.id);
  if (b.color !== undefined) run('UPDATE goals SET color = ? WHERE id = ?', str(b.color, 'Colour', { max: 20 }), g.id);
  if (b.image !== undefined) run('UPDATE goals SET image = ? WHERE id = ?', image(b.image), g.id);
  if (b.completed !== undefined) run('UPDATE goals SET completed_at = ? WHERE id = ?', b.completed ? new Date().toISOString() : null, g.id);
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
  const amount = num(req.body.amount, 'Amount');
  if (amount === 0) throw bad('Amount cannot be zero');
  run(
    'INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)',
    randomUUID(),
    g.id,
    me,
    amount,
    req.body.date ? isoDate(req.body.date, 'Date') : toISODate(new Date()),
    str(req.body.note, 'Note', { max: 120, optional: true }) || null,
  );
  const updated = find(me, g.id);
  if (!updated.completedAt && updated.saved >= updated.targetAmount) {
    run('UPDATE goals SET completed_at = ? WHERE id = ?', new Date().toISOString(), g.id);
  }
  res.status(201).json(find(me, g.id));
});

goals.delete('/:id/contributions/:cid', (req, res) => {
  const me = uid(req);
  const g = find(me, req.params.id);
  const c = g.contributions.find((x) => x.id === req.params.cid);
  if (!c) throw notFound('Contribution not found');
  if (c.userId !== me) throw forbidden('Only the person who added this can remove it');
  run('DELETE FROM goal_contributions WHERE id = ?', c.id);
  res.json(find(me, g.id));
});
