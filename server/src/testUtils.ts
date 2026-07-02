import request from 'supertest';
import { createApp } from './app';
import { pool } from './db/pool';

// Shared by every HTTP integration test. jest.setup.ts has already pointed
// DATABASE_URL at fancall_test by the time this (or anything importing it)
// is required, so this pool and app never touch the real dev database.
export const app = createApp();
export { pool };

// Order matters: scores/predictions reference fixtures + users. teams is
// seed data (the 20-club list) and is deliberately never truncated.
export async function resetDb() {
  await pool.query('TRUNCATE scores, predictions, fixtures, users CASCADE');
}

export async function getAnyTeamId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>('select id from teams limit 1');
  if (!rows[0]) {
    throw new Error(
      'No teams seeded in fancall_test — run db/migrations/2026-06-24-teams-and-usernames.sql against it first.',
    );
  }
  return rows[0].id;
}

// A logged-in supertest client — persists the session cookie across
// requests like a real browser, so callers can sign up once and then make
// authenticated calls without juggling cookies by hand.
export function agent() {
  return request.agent(app);
}
