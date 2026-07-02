import { pool } from '../../db/pool';
import { HttpError } from '../../lib/errors';
import type { PublicUser } from '../auth/auth.service';

// Demo only — no real payment processor yet (roadmap step 18 is where
// Stripe replaces this). Just flips the flag requirePaid checks, so the
// signup -> pay -> predict loop can be exercised end to end.
export async function markPaid(userId: string): Promise<PublicUser> {
  const { rows } = await pool.query<PublicUser>(
    `update users u set paid = true
       from teams t
      where u.id = $1 and t.id = u.team_id
      returning u.id, u.email, u.display_name, u.team_id, t.name as team_name, u.paid`,
    [userId],
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');
  return rows[0];
}
