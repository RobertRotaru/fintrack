import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { all, get, run, tx } from '../db';
import { bad, hexColor, iconName, notFound, oneOf, str, uid } from '../http';
import { toCategory } from '../repo';

export const categories = Router();

function assertUniqueName(userId: string, kind: string, name: string, exceptId?: string) {
  const clash = get(
    'SELECT 1 FROM categories WHERE user_id = ? AND kind = ? AND name = ? COLLATE NOCASE AND archived = 0 AND id != ?',
    userId,
    kind,
    name,
    exceptId ?? '',
  );
  if (clash) throw bad(`You already have a "${name}" category`);
}

categories.get('/', (req, res) => {
  res.json(all('SELECT * FROM categories WHERE user_id = ? ORDER BY kind, archived, is_default DESC, name', uid(req)).map(toCategory));
});

categories.post('/', (req, res) => {
  const me = uid(req);
  const kind = oneOf(req.body.kind, 'Kind', ['expense', 'income'] as const);
  const name = str(req.body.name, 'Name', { max: 40 });
  assertUniqueName(me, kind, name);
  const id = randomUUID();
  run(
    'INSERT INTO categories (id, user_id, kind, name, icon, color) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    me,
    kind,
    name,
    iconName(req.body.icon ?? 'tag'),
    hexColor(req.body.color ?? '#64748b'),
  );
  res.status(201).json(toCategory(get('SELECT * FROM categories WHERE id = ?', id)!));
});

categories.patch('/:id', (req, res) => {
  const me = uid(req);
  const row = get('SELECT * FROM categories WHERE id = ? AND user_id = ?', req.params.id, me);
  if (!row) throw notFound('Category not found');
  const b = req.body;
  // All-or-nothing: an invalid field must not leave earlier fields applied.
  tx(() => {
    if (b.name !== undefined) {
      const name = str(b.name, 'Name', { max: 40 });
      assertUniqueName(me, row.kind as string, name, row.id as string);
      run('UPDATE categories SET name = ? WHERE id = ?', name, row.id);
    }
    if (b.icon !== undefined) run('UPDATE categories SET icon = ? WHERE id = ?', iconName(b.icon), row.id);
    if (b.color !== undefined) run('UPDATE categories SET color = ? WHERE id = ?', hexColor(b.color), row.id);
    if (b.archived !== undefined) {
      // Restoring must not create a duplicate of an active category.
      if (!b.archived) assertUniqueName(me, row.kind as string, row.name as string, row.id as string);
      run('UPDATE categories SET archived = ? WHERE id = ?', b.archived ? 1 : 0, row.id);
    }
  });
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
