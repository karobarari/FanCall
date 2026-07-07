import request from 'supertest';
import { createApp } from './app';
import { pool } from './db/pool';

// Shared by every HTTP integration test. jest.setup.ts has already pointed
// DATABASE_URL at fancall_test by the time this (or anything importing it)
// is required, so this pool and app never touch the real dev database.
export const app = createApp();
export { pool };

// Order matters: scores/predictions reference fixtures + users; club_plans/
// payments/subscriptions/entitlements/redemption_codes reference teams
// and/or users. teams is seed data (the 20-club list) and is deliberately
// never truncated.
export async function resetDb() {
  await pool.query(
    `TRUNCATE scores, predictions, fixtures, users, club_plans,
              payments, subscriptions, entitlements, redemption_codes CASCADE`
  );
}

// A logged-in supertest client — persists the session cookie across
// requests like a real browser, so callers can sign up once and then make
// authenticated calls without juggling cookies by hand.
export function agent() {
  return request.agent(app);
}

// Every signup now needs a real team_id (no more auto-assigned pilot club).
// teams is seeded once and never truncated (see resetDb above), so any test
// can resolve a real club's id by name whenever it needs one.
export async function getTeamId(name = 'Manchester City'): Promise<string> {
  const { rows } = await pool.query<{ id: string }>('select id from teams where name = $1', [name]);
  if (!rows[0]) throw new Error(`Team "${name}" is not seeded in the test database`);
  return rows[0].id;
}
