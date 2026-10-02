import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { get, run, tx } from '../db';
import { HttpError, bad, forbidden, notFound, str, uid } from '../http';
import { householdFor, householdIdOf } from '../repo';

export const household = Router();

// Unambiguous characters only — codes get read aloud and typed on phones.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function inviteCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

household.get('/', (req, res) => {
  res.json(householdFor(uid(req)));
});

household.post('/', (req, res) => {
  const me = uid(req);
  if (householdIdOf(me)) throw new HttpError(409, 'You are already in a family');
  const id = randomUUID();
  tx(() => {
    run('INSERT INTO households (id, name, invite_code, created_by) VALUES (?, ?, ?, ?)', id, str(req.body.name, 'Name', { max: 60 }), inviteCode(), me);
    run("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')", id, me);
  });
  res.status(201).json(householdFor(me));
});

household.patch('/', (req, res) => {
  const me = uid(req);
  const h = householdFor(me);
  if (!h) throw notFound('You are not in a family');
  run('UPDATE households SET name = ? WHERE id = ?', str(req.body.name, 'Name', { max: 60 }), h.id);
  res.json(householdFor(me));
});

household.post('/join', (req, res) => {
  const me = uid(req);
  if (householdIdOf(me)) throw new HttpError(409, 'Leave your current family before joining another');
  const code = str(req.body.code, 'Invite code').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
  const h = get('SELECT id FROM households WHERE invite_code = ?', formatted);
  if (!h) throw bad('That invite code is not valid');
  run("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'member')", h.id, me);
  res.json(householdFor(me));
});

household.post('/invite-code', (req, res) => {
  const me = uid(req);
  const h = householdFor(me);
  if (!h) throw notFound('You are not in a family');
  if (h.members.find((m) => m.userId === me)?.role !== 'owner') throw forbidden('Only the family owner can reset the code');
  run('UPDATE households SET invite_code = ? WHERE id = ?', inviteCode(), h.id);
  res.json(householdFor(me));
});

/** Leaving un-shares your accounts and goals; the last member out deletes the family. */
household.post('/leave', (req, res) => {
  const me = uid(req);
  const h = householdFor(me);
  if (!h) throw notFound('You are not in a family');
  tx(() => {
    run('UPDATE accounts SET household_id = NULL WHERE owner_id = ? AND household_id = ?', me, h.id);
    run('UPDATE goals SET household_id = NULL WHERE user_id = ? AND household_id = ?', me, h.id);
    run('DELETE FROM household_members WHERE user_id = ?', me);
    const rest = h.members.filter((m) => m.userId !== me);
    if (!rest.length) run('DELETE FROM households WHERE id = ?', h.id);
    else if (h.members.find((m) => m.userId === me)?.role === 'owner') {
      run("UPDATE household_members SET role = 'owner' WHERE user_id = ?", rest[0].userId);
    }
  });
  res.json(null);
});

household.delete('/members/:userId', (req, res) => {
  const me = uid(req);
  const h = householdFor(me);
  if (!h) throw notFound('You are not in a family');
  if (h.members.find((m) => m.userId === me)?.role !== 'owner') throw forbidden('Only the family owner can remove members');
  const target = req.params.userId;
  if (target === me) throw bad('Use "leave" to remove yourself');
  if (!h.members.some((m) => m.userId === target)) throw notFound('Member not found');
  tx(() => {
    run('UPDATE accounts SET household_id = NULL WHERE owner_id = ? AND household_id = ?', target, h.id);
    run('UPDATE goals SET household_id = NULL WHERE user_id = ? AND household_id = ?', target, h.id);
    run('DELETE FROM household_members WHERE user_id = ?', target);
  });
  res.json(householdFor(me));
});
