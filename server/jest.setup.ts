// Jest setup: load .env so DB-backed suites can authenticate.
//
// Jest never runs the app entry (src/config/env.ts) that normally calls
// dotenv, so without this the SQL tests see an empty process.env and the pg
// pool connects with no password -> "SASL: client password must be a string".
//
// dotenv.config() does NOT override variables already set in the shell, so
// precedence is: real shell env > .env. Nothing here is test-secret; the
// password rides along in DATABASE_URL (already gitignored via .env).
import { config } from "dotenv";

config({ quiet: true });

// Redirect every DB-backed test — including the app's own db/pool.ts,
// imported transitively by any HTTP integration test via createApp() — at
// the disposable fancall_test database, never the real dev DB in
// DATABASE_URL. Only the database name changes; host/user/password/port
// still come from the real .env. Set TEST_DATABASE_URL to override this
// explicitly. This runs before any test file is required, so config/env.ts
// picks up the redirected value the first time anything imports it.
const testDatabaseUrl = (() => {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL ?? "postgres://karod@localhost:5432/karod");
  url.pathname = "/fancall_test";
  return url.toString();
})();
process.env.DATABASE_URL = testDatabaseUrl;

// Admin-gated routes compare the signed-in user's email against
// ADMIN_EMAIL. Tests need a stable, known admin identity that doesn't depend
// on whatever personal email happens to be in the developer's real .env.
process.env.ADMIN_EMAIL = "admin@test.dev";
