import type { Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { env } from "../config/env";
import { HttpError } from "../lib/errors";
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
  if (!email || email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    throw new HttpError(403, "Admin access required");
  }
  next();
}
