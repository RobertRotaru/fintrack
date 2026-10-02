import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { all, get, run } from '../db';
import { bad, notFound, oneOf, str, uid } from '../http';
import { toCategory } from '../repo';

export const categories = Router();

categories.get('/', (req, res) => {
  res.json(all('SELECT * FROM categories WHERE user_id = ? ORDER BY kind, archived, is_default DESC, name', uid(req)).map(toCategory));
});

categories.post('/', (req, res) => {
  const me = uid(req);
  const kind = oneOf(req.body.kind, 'Kind', ['expense', 'income'] as const);
  const name = str(req.body.name, 'Name', { max: 40 });
  if (get('SELECT 1 FROM categories WHERE user_id = ? AND kind = ? AND name = ? COLLATE NOCASE AND archived = 0', me, kind, name)) {
    throw bad(`You already have a "${name}" category`);
  }
  const id = randomUUID();
  run(
    'INSERT INTO categories (id, user_id, kind, name, icon, color) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    me,
    kind,
    name,
    str(req.body.icon ?? 'tag', 'Icon', { max: 40 }),
    str(req.body.color ?? '#64748b', 'Colour', { max: 20 }),
  );
  res.status(201).json(toCategory(get('SELECT * FROM categories WHERE id = ?', id)!));
});

categories.patch('/:id', (req, res) => {
  const me = uid(req);
  const row = get('SELECT * FROM categories WHERE id = ? AND user_id = ?', req.params.id, me);
  if (!row) throw notFound('Category not found');
  const b = req.body;
  if (b.name !== undefined) run('UPDATE categories SET name = ? WHERE id = ?', str(b.name, 'Name', { max: 40 }), row.id);
  if (b.icon !== undefined) run('UPDATE categories SET icon = ? WHERE id = ?', str(b.icon, 'Icon', { max: 40 }), row.id);
  if (b.color !== undefined) run('UPDATE categories SET color = ? WHERE id = ?', str(b.color, 'Colour', { max: 20 }), row.id);
  if (b.archived !== undefined) run('UPDATE categories SET archived = ? WHERE id = ?', b.archived ? 1 : 0, row.id);
  res.json(toCategory(get('SELECT * FROM categories WHERE id = ?', row.id)!));
});

// Categories in use are archived rather than deleted so history keeps its labels.
categories.delete('/:id', (req, res) => {
  const me = uid(req);
  const row = get('SELECT * FROM categories WHERE id = ? AND user_id = ?', req.params.id, me);
  if (!row) throw notFound('Category not found');
  if (get('SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1', row.id)) {
    run('UPDATE categories SET archived = 1 WHERE id = ?', row.id);
  } else {
    run('DELETE FROM categories WHERE id = ?', row.id);
  }
  res.status(204).end();
});
