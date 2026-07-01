import { Apple, decodeIdToken, Google } from 'arctic';
import { env } from '../config/env';
import { HttpError } from './errors';

export function getGoogleProvider(): Google {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new HttpError(503, 'Google sign-in is not configured');
  }
  return new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

export function getAppleProvider(): Apple {
  if (
    !env.APPLE_CLIENT_ID ||
    !env.APPLE_TEAM_ID ||
    !env.APPLE_KEY_ID ||
    !env.APPLE_PRIVATE_KEY ||
    !env.APPLE_REDIRECT_URI
  ) {
    throw new HttpError(503, 'Apple sign-in is not configured');
  }
  return new Apple(
    env.APPLE_CLIENT_ID,
    env.APPLE_TEAM_ID,
    env.APPLE_KEY_ID,
    pemToPkcs8Bytes(env.APPLE_PRIVATE_KEY),
    env.APPLE_REDIRECT_URI,
  );
}

// APPLE_PRIVATE_KEY holds the .p8 file's PEM text with real newlines escaped
// as \n (so it fits in one .env line). arctic's Apple client wants the raw
// PKCS8 DER bytes, not the PEM wrapper, hence the strip-and-decode below.
function pemToPkcs8Bytes(pem: string): Uint8Array {
  const base64 = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN (.*)-----/, '')
    .replace(/-----END (.*)-----/, '')
    .replace(/\s+/g, '');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export interface IdTokenClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
}

// arctic's decodeIdToken() only base64-decodes the JWT payload — it does not
// verify the signature. That's fine here because both callers only ever
// decode a token they just received directly from the provider's token
// endpoint over a server-to-server HTTPS call (not one supplied by the
// browser), so the channel itself already guarantees authenticity. We still
// check aud/iss/exp by hand as defense in depth in case that assumption ever
// stops holding (e.g. a future client-side flow feeds in a token instead).
export function parseIdTokenClaims(
  idToken: string,
  expectedAud: string,
  expectedIssuers: string[],
): IdTokenClaims {
  const claims = decodeIdToken(idToken) as Partial<{
    sub: string;
    email: string;
    email_verified: boolean | string;
    aud: string;
    iss: string;
    exp: number;
  }>;

  if (!claims.sub || !claims.email || !claims.aud || !claims.iss || !claims.exp) {
    throw new HttpError(401, 'Malformed identity token');
  }
  if (claims.aud !== expectedAud) throw new HttpError(401, 'Identity token audience mismatch');
  if (!expectedIssuers.includes(claims.iss)) throw new HttpError(401, 'Identity token issuer mismatch');
  if (claims.exp * 1000 < Date.now()) throw new HttpError(401, 'Identity token expired');

  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  };
}
