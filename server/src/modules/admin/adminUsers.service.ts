import { pool } from '../../db/pool';
import { HttpError, isUniqueViolation } from '../../lib/errors';

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  team_name: string;
  paid: boolean;
  is_active: boolean;
  created_at: string;
}

const SELECT = `
  select u.id, u.email, u.display_name, u.avatar, u.paid, u.is_active, u.created_at,
         t.name as team_name
    from users u
    join teams t on t.id = u.team_id
`;

async function getById(id: string): Promise<AdminUser> {
  const { rows } = await pool.query<AdminUser>(`${SELECT} where u.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'User not found');
  return rows[0];
}

export async function listUsers(): Promise<AdminUser[]> {
  const { rows } = await pool.query<AdminUser>(`${SELECT} order by u.created_at asc`);
  return rows;
}

export async function updateUsername(targetId: string, displayName: string): Promise<AdminUser> {
  try {
    const { rowCount } = await pool.query('update users set display_name = $1 where id = $2', [
      displayName,
      targetId,
    ]);
    if (!rowCount) throw new HttpError(404, 'User not found');
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'That username is already taken');
    throw err;
  }
  return getById(targetId);
}

// Soft flag, not a delete: predictions/scores (both ON DELETE CASCADE to
// users) stay intact, and re-activating just flips the flag back.
export async function setActive(targetId: string, requesterId: string, isActive: boolean): Promise<AdminUser> {
  if (!isActive && targetId === requesterId) {
    throw new HttpError(400, "You can't deactivate your own account");
  }
  const { rowCount } = await pool.query('update users set is_active = $1 where id = $2', [
    isActive,
    targetId,
  ]);
  if (!rowCount) throw new HttpError(404, 'User not found');
  return getById(targetId);
}
