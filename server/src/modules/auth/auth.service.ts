import { pool } from '../../db/pool';
import { hashPassword, verifyPassword } from '../../lib/password';
import { HttpError } from '../../lib/errors';

export interface PublicUser {
  id: string;
  email: string;
  display_name: string | null;
}

export async function signup(
  email: string,
  password: string,
  displayName?: string
): Promise<PublicUser> {
  const existing = await pool.query('select 1 from users where email = $1', [email]);
  if (existing.rowCount) throw new HttpError(409, 'That email is already registered');

  const hash = await hashPassword(password);
  const { rows } = await pool.query(
    `insert into users (email, password_hash, display_name)
     values ($1, $2, $3)
     returning id, email, display_name`,
    [email, hash, displayName ?? email.split('@')[0]]
  );
  return rows[0];
}

export async function login(email: string, password: string): Promise<PublicUser> {
  const { rows } = await pool.query(
    'select id, email, display_name, password_hash from users where email = $1',
    [email]
  );
  const user = rows[0];
  // Same message either way so we don't reveal which emails exist.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'Wrong email or password');
  }
  return { id: user.id, email: user.email, display_name: user.display_name };
}

export async function getUser(id: string): Promise<PublicUser> {
  const { rows } = await pool.query(
    'select id, email, display_name from users where id = $1',
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');
  return rows[0];
}
