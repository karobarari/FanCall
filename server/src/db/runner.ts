// Shared plumbing for the db:setup / db:migrate scripts.
//
// These scripts intentionally do NOT import ../config/env: that schema requires
// JWT_SECRET and friends, but provisioning a database only needs DATABASE_URL
// (+ optional DATABASE_SSL). Reading those two directly keeps the runner usable
// on a bare box that only has the connection string.
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required (set it in server/.env or the host env).');
    process.exit(1);
  }
  // Mirror db/pool.ts: TLS only when explicitly asked for, so local dev and
  // Render's internal URL connect without SSL while a managed external URL can.
  const sslFlag = (process.env.DATABASE_SSL ?? '').toLowerCase();
  const ssl = ['true', '1', 'yes'].includes(sslFlag)
    ? { rejectUnauthorized: false }
    : undefined;
  return new Pool({ connectionString, ssl });
}

// Walk up from this file until we find the repo root (the directory that holds
// db/schema.sql). Robust whether run via tsx from src/ or as compiled JS from
// dist/ — in both cases the repo tree is on disk above us. The SQL files live
// in the repo, not in the compiled output (tsc only emits .js), so we always
// resolve them against the real repo layout rather than __dirname/dist.
export function repoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'db', 'schema.sql'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate db/schema.sql walking up from ${__dirname}`);
}

export const paths = () => {
  const root = repoRoot();
  return {
    root,
    schema: path.join(root, 'db', 'schema.sql'),
    seedTeams: path.join(root, 'db', 'seed-teams.sql'),
    seedPlans: path.join(root, 'db', 'seed-plans.sql'),
    seedFixtures: path.join(root, 'db', 'seed-fixtures-all.sql'),
    migrationsDir: path.join(root, 'server', 'src', 'db', 'migrations'),
  };
};

export function readSql(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

// Ordered list of the migration filenames in the migrations directory. Names are
// ISO-date-prefixed, so a lexical sort is chronological.
export function migrationFiles(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export const MIGRATIONS_TABLE_DDL = `
  create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  );
`;

// The marker row recorded for the schema.sql baseline. Kept distinct from any
// real migration filename so it can never collide with one.
export const BASELINE_MARKER = '000_baseline_schema.sql';
