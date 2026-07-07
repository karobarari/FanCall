import bcrypt from 'bcryptjs';
import { pool } from '../../db/pool';
import { hashPassword, verifyPassword } from '../../lib/password';
import { HttpError, isUniqueViolation } from '../../lib/errors';
import { isAdminEmail } from '../../lib/adminEmail';
import { getTeamById } from '../teams/teams.service';
import { grantEntitlement } from '../payment/payment.service';

// Bcrypt hash of an arbitrary fixed string, used only so login always pays
// the cost of a bcrypt.compare — otherwise a nonexistent-email request
// returns faster than a wrong-password one, leaking which emails exist via
// response timing even though the error message is identical.
const DUMMY_HASH = bcrypt.hashSync('fancall-timing-safety-dummy', 10);

export interface PublicUser {
  id: string;
  email: string;
  display_name: string | null;
  // Preset id "<color>-<icon>" or null (frontend falls back to initials).
  avatar: string | null;
  team_id: string;
  team_name: string;
  // Per-club branding — null until an admin sets them for this club.
  team_primary_color: string | null;
  team_secondary_color: string | null;
  team_logo_url: string | null;
  paid: boolean;
  is_admin: boolean;
}

export async function signup(
  email: string,
  password: string,
  displayName: string,
  teamId: string
): Promise<PublicUser> {
  const existing = await pool.query('select 1 from users where email = $1', [email]);
  if (existing.rowCount) throw new HttpError(409, 'That email is already registered');

  const team = await getTeamById(teamId);
  if (!team) throw new HttpError(400, 'Unknown team');
  // The admin account never needs to click through the demo payment screen
  // to test settle/predict — everyone else starts unpaid, same as any real
  // signup would.
  const paid = isAdminEmail(email);

  const hash = await hashPassword(password);
  try {
    const { rows } = await pool.query<{
      id: string;
      email: string;
      display_name: string | null;
      avatar: string | null;
    }>(
      `insert into users (email, password_hash, display_name, team_id, paid)
       values ($1, $2, $3, $4, $5)
       returning id, email, display_name, avatar`,
      [email, hash, displayName, team.id, paid]
    );
    // requireEntitled checks the entitlements table, not users.paid directly
    // — the admin account needs a real row there too, not just the flag.
    if (paid) await grantEntitlement(rows[0].id, team.id, 'demo', 'demo', null);
    return {
      ...rows[0],
      team_id: team.id,
      team_name: team.name,
      team_primary_color: team.primary_color,
      team_secondary_color: team.secondary_color,
      team_logo_url: team.logo_url,
      paid,
      is_admin: isAdminEmail(email),
    };
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
    avatar: string | null;
    password_hash: string | null;
    team_id: string;
    team_name: string;
    team_primary_color: string | null;
    team_secondary_color: string | null;
    team_logo_url: string | null;
    paid: boolean;
    is_active: boolean;
  }>(
    `select u.id, u.email, u.display_name, u.avatar, u.password_hash, u.team_id,
            t.name as team_name, t.primary_color as team_primary_color,
            t.secondary_color as team_secondary_color, t.logo_url as team_logo_url,
            u.paid, u.is_active
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
  // Checked only after a correct password, so a deactivated account isn't
  // distinguishable from a wrong password to someone who doesn't know it.
  if (!user.is_active) {
    throw new HttpError(403, 'This account has been deactivated');
  }
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar: user.avatar,
    team_id: user.team_id,
    team_name: user.team_name,
    team_primary_color: user.team_primary_color,
    team_secondary_color: user.team_secondary_color,
    team_logo_url: user.team_logo_url,
    paid: user.paid,
    is_admin: isAdminEmail(user.email),
  };
}

export interface ProfileUpdate {
  displayName?: string;
  // A preset id sets the avatar; null clears it back to the initials fallback.
  avatar?: string | null;
}

export async function updateProfile(userId: string, fields: ProfileUpdate): Promise<PublicUser> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.displayName !== undefined) {
    values.push(fields.displayName);
    sets.push(`display_name = $${values.length}`);
  }
  if (fields.avatar !== undefined) {
    values.push(fields.avatar);
    sets.push(`avatar = $${values.length}`);
  }
  if (!sets.length) throw new HttpError(400, 'Nothing to update');

  values.push(userId);
  try {
    const { rowCount } = await pool.query(
      `update users set ${sets.join(', ')} where id = $${values.length}`,
      values
    );
    if (!rowCount) throw new HttpError(404, 'User not found');
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'That username is already taken');
    throw err;
  }
  return getUser(userId);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const { rows } = await pool.query<{ password_hash: string | null }>(
    'select password_hash from users where id = $1',
    [userId]
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');

  const passwordHash = rows[0].password_hash;
  if (!passwordHash) {
    throw new HttpError(400, 'This account signs in with Google or Apple and has no password to change');
  }
  const ok = await verifyPassword(currentPassword, passwordHash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');

  const hash = await hashPassword(newPassword);
  await pool.query('update users set password_hash = $1 where id = $2', [hash, userId]);
}

export async function getUser(id: string): Promise<PublicUser> {
  const { rows } = await pool.query<Omit<PublicUser, 'is_admin'>>(
    `select u.id, u.email, u.display_name, u.avatar, u.team_id,
            t.name as team_name, t.primary_color as team_primary_color,
            t.secondary_color as team_secondary_color, t.logo_url as team_logo_url,
            u.paid
       from users u
       join teams t on t.id = u.team_id
      where u.id = $1`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');
  return { ...rows[0], is_admin: isAdminEmail(rows[0].email) };
}
