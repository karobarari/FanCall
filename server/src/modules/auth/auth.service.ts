import bcrypt from 'bcryptjs';
import { pool } from '../../db/pool';
import { hashPassword, verifyPassword } from '../../lib/password';
import { HttpError, isUniqueViolation } from '../../lib/errors';

// Bcrypt hash of an arbitrary fixed string, used only so login always pays
// the cost of a bcrypt.compare — otherwise a nonexistent-email request
// returns faster than a wrong-password one, leaking which emails exist via
// response timing even though the error message is identical.
const DUMMY_HASH = bcrypt.hashSync('fancall-timing-safety-dummy', 10);

export interface PublicUser {
  id: string;
  email: string;
  display_name: string | null;
  team_id: string;
  team_name: string;
}

export async function signup(
  email: string,
  password: string,
  displayName: string,
  teamId: string
): Promise<PublicUser> {
  const existing = await pool.query('select 1 from users where email = $1', [email]);
  if (existing.rowCount) throw new HttpError(409, 'That email is already registered');

  const team = await pool.query<{ name: string }>('select name from teams where id = $1', [teamId]);
  if (!team.rowCount) throw new HttpError(400, 'Unknown team');

  const hash = await hashPassword(password);
  try {
    const { rows } = await pool.query<{ id: string; email: string; display_name: string | null }>(
      `insert into users (email, password_hash, display_name, team_id)
       values ($1, $2, $3, $4)
       returning id, email, display_name`,
      [email, hash, displayName, teamId]
    );
    return { ...rows[0], team_id: teamId, team_name: team.rows[0].name };
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'That username is already taken');
    throw err;
  }
}

export async function login(email: string, password: string): Promise<PublicUser> {
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string | null;
    password_hash: string | null;
    team_id: string;
    team_name: string;
  }>(
    `select u.id, u.email, u.display_name, u.password_hash, u.team_id, t.name as team_name
       from users u
       join teams t on t.id = u.team_id
      where u.email = $1`,
    [email]
  );
  const user = rows[0];
  // Same message either way, and always run a compare (against a dummy hash
  // when there's no user), so we don't reveal which emails exist via timing.
  const passwordOk = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new HttpError(401, 'Wrong email or password');
  }
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    team_id: user.team_id,
    team_name: user.team_name,
  };
}

export async function getUser(id: string): Promise<PublicUser> {
  const { rows } = await pool.query<PublicUser>(
    `select u.id, u.email, u.display_name, u.team_id, t.name as team_name
       from users u
       join teams t on t.id = u.team_id
      where u.id = $1`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');
  return rows[0];
}
