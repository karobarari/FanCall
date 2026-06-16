import type { Response } from 'express';
import { signToken } from './jwt';
import { isProd } from '../config/env';

export const SESSION_COOKIE = 'fancall_token';

// 'none' + secure in prod so the cookie survives the frontend and API being on
// different domains; 'lax' over HTTP in dev.
const cookieOptions = {
  httpOnly: true,
  sameSite: isProd ? ('none' as const) : ('lax' as const),
  secure: isProd,
};

export function setSession(res: Response, userId: string) {
  res.cookie(SESSION_COOKIE, signToken(userId), {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
