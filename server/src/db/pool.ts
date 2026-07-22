import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Managed Postgres providers (Render's external URL, Supabase, Neon) require
  // TLS but present certs signed by a CA that isn't in Node's default trust
  // store, so verification would fail — rejectUnauthorized:false accepts the
  // connection while still encrypting it. Gated on DATABASE_SSL so local dev
  // and Render's non-TLS internal URL connect without SSL.
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error', err);
});
