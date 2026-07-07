import { pool } from '../../db/pool';
import { HttpError, isUniqueViolation } from '../../lib/errors';
import { isAdminEmail } from '../../lib/adminEmail';
import { getTeamById } from '../teams/teams.service';
import { grantEntitlement } from '../payment/payment.service';
import type { PublicUser } from './auth.service';

export type OAuthProvider = 'google' | 'apple';

export interface OAuthIdentity {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  emailVerified: boolean;
}

export type OAuthLoginResult = { status: 'logged_in'; user: PublicUser } | { status: 'needs_profile' };

// Not user input — a fixed two-entry lookup, safe to interpolate as a column name.
const PROVIDER_COLUMN: Record<OAuthProvider, 'google_id' | 'apple_id'> = {
  google: 'google_id',
  apple: 'apple_id',
};

// Three outcomes for a provider callback:
//  1. We've seen this provider identity before -> log the linked user in.
//  2. No link yet, but the email matches an existing account and the
//     provider vouches it's verified -> link this provider to that account
//     and log in. (Skipped if the provider doesn't say the email is
//     verified, to avoid letting an attacker take over an account by
//     registering an OAuth identity with someone else's unverified address.)
//  3. No match at all -> genuinely new person; caller sends them to pick a
//     team + username before an account is created.
export async function resolveOAuthLogin(identity: OAuthIdentity): Promise<OAuthLoginResult> {
  const column = PROVIDER_COLUMN[identity.provider];

  const byProvider = await pool.query<Omit<PublicUser, 'is_admin'>>(
    `select u.id, u.email, u.display_name, u.avatar, u.team_id,
            t.name as team_name, t.primary_color as team_primary_color,
            t.secondary_color as team_secondary_color, t.logo_url as team_logo_url,
            u.paid
       from users u
       join teams t on t.id = u.team_id
      where u.${column} = $1`,
    [identity.providerId],
  );
  if (byProvider.rowCount) {
    const found = byProvider.rows[0];
    return { status: 'logged_in', user: { ...found, is_admin: isAdminEmail(found.email) } };
  }

  const byEmail = await pool.query<{
    id: string;
    team_id: string;
    team_name: string;
    team_primary_color: string | null;
    team_secondary_color: string | null;
    team_logo_url: string | null;
    paid: boolean;
  }>(
    `select u.id, u.team_id, t.name as team_name, t.primary_color as team_primary_color,
            t.secondary_color as team_secondary_color, t.logo_url as team_logo_url, u.paid
       from users u
       join teams t on t.id = u.team_id
      where lower(u.email) = lower($1)`,
    [identity.email],
  );
  if (byEmail.rowCount) {
    if (!identity.emailVerified) {
      throw new HttpError(
        409,
        'An account already exists with this email — log in with your password instead.',
      );
    }
    const { rows } = await pool.query<{
      id: string;
      email: string;
      display_name: string | null;
      avatar: string | null;
    }>(
      `update users set ${column} = $1, email_verified = true where id = $2
       returning id, email, display_name, avatar`,
      [identity.providerId, byEmail.rows[0].id],
    );
    return {
      status: 'logged_in',
      user: {
        ...rows[0],
        team_id: byEmail.rows[0].team_id,
        team_name: byEmail.rows[0].team_name,
        team_primary_color: byEmail.rows[0].team_primary_color,
        team_secondary_color: byEmail.rows[0].team_secondary_color,
        team_logo_url: byEmail.rows[0].team_logo_url,
        paid: byEmail.rows[0].paid,
        is_admin: isAdminEmail(rows[0].email),
      },
    };
  }

  return { status: 'needs_profile' };
}

export interface CompleteOAuthSignupInput extends OAuthIdentity {
  displayName: string;
  teamId: string;
}

export async function completeOAuthSignup(input: CompleteOAuthSignupInput): Promise<PublicUser> {
  const column = PROVIDER_COLUMN[input.provider];
  const team = await getTeamById(input.teamId);
  if (!team) throw new HttpError(400, 'Unknown team');
  const paid = isAdminEmail(input.email);

  try {
    const { rows } = await pool.query<{
      id: string;
      email: string;
      display_name: string | null;
      avatar: string | null;
    }>(
      `insert into users (email, email_verified, display_name, team_id, paid, ${column})
       values ($1, $2, $3, $4, $5, $6)
       returning id, email, display_name, avatar`,
      [input.email, input.emailVerified, input.displayName, team.id, paid, input.providerId],
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
      is_admin: isAdminEmail(input.email),
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'That username is already taken, or the account already exists');
    }
    throw err;
  }
}
