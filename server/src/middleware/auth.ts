import type { Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { env } from "../config/env";
import { HttpError } from "../lib/errors";
import { isAdminEmail } from "../lib/adminEmail";
import { SESSION_COOKIE } from "../lib/session";
import { verifyToken } from "../lib/jwt";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}

// Gates admin-only actions (settling fixtures, and later other admin tools).
// MUST be mounted after requireAuth — it relies on req.userId. "Admin" is
// whichever account's email matches ADMIN_EMAIL: a deliberately minimal gate
// for the skeleton, to be swapped for a real role/permission model when the
// production version needs more than a single admin.
//
// It touches the DB, so mount it via asyncHandler(requireAdmin) and let
// HttpError flow to the error middleware, the same way the services do.
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!env.ADMIN_EMAIL) {
    throw new HttpError(403, "Admin access is not configured");
  }
  const { rows } = await pool.query("select email from users where id = $1", [
    req.userId,
  ]);
  const email: string | undefined = rows[0]?.email;
  if (!email || !isAdminEmail(email)) {
    throw new HttpError(403, "Admin access required");
  }
  next();
}

// Gates the paid product (predictions) behind the demo payment step. No
// real payment processing yet (roadmap step 18) — payment.service.ts just
// flips users.paid; this middleware is what actually enforces it server-side
// so the gate can't be skipped by calling the API directly. The admin
// account is auto-marked paid at signup (see auth.service.ts / oauth.service.ts),
// so this never blocks admin testing.
export async function requirePaid(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const { rows } = await pool.query<{ paid: boolean }>(
    "select paid from users where id = $1",
    [req.userId],
  );
  if (!rows[0]?.paid) {
    throw new HttpError(402, "Payment required");
  }
  next();
}
