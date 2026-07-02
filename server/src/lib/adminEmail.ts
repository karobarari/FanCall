import { env } from '../config/env';

// Case-insensitive match against the one account configured as admin. False
// (not an error) when ADMIN_EMAIL is unset — callers that need admin to be
// configured check that separately (see requireAdmin).
export function isAdminEmail(email: string): boolean {
  return !!env.ADMIN_EMAIL && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
}
