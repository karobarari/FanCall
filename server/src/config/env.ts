import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";

// Validate the environment once, at startup, so a misconfig fails loudly
// here instead of surfacing as a confusing runtime error later.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET should be a long random string"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // The single account allowed to settle fixtures (and later other admin
  // actions). Optional: if unset, no one is treated as admin and the settle
  // endpoint refuses everyone. Set it to your own login email in server/.env.
  ADMIN_EMAIL: z.string().email().optional(),

  // Google OAuth (Google Cloud Console -> APIs & Services -> Credentials).
  // All optional: if any is missing, /api/auth/google responds 503 instead of
  // the server failing to start.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Sign in with Apple (developer.apple.com -> Certificates, Identifiers &
  // Profiles). Requires a paid Apple Developer membership. APPLE_CLIENT_ID is
  // the Services ID (not the app's bundle ID). APPLE_PRIVATE_KEY is the
  // contents of the downloaded .p8 key, with real newlines escaped as \n so it
  // fits on one .env line. All optional, same 503-if-unset behaviour as Google.
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_REDIRECT_URI: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
