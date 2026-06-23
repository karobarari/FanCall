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

config();
