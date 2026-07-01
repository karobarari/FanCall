import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { sub: string };
  return payload.sub;
}

// Short-lived token for the gap between "OAuth provider confirmed this
// identity" and "user picked a team + username to finish creating their
// account". Carries no session privileges — a distinct `typ` claim stops it
// being usable anywhere a session token (or vice versa) is expected.
export interface OAuthPendingProfile {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  emailVerified: boolean;
}

export function signOAuthPending(profile: OAuthPendingProfile): string {
  return jwt.sign({ ...profile, typ: 'oauth_pending' }, env.JWT_SECRET, {
    expiresIn: '10m',
    algorithm: 'HS256',
  });
}

export function verifyOAuthPending(token: string): OAuthPendingProfile {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as OAuthPendingProfile & {
    typ?: string;
  };
  if (payload.typ !== 'oauth_pending') throw new Error('Not a pending-OAuth token');
  return {
    provider: payload.provider,
    providerId: payload.providerId,
    email: payload.email,
    emailVerified: payload.emailVerified,
  };
}
