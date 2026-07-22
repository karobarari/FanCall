// Apply any forward migrations not yet recorded in schema_migrations.
//
//   npm run db:migrate          # against DATABASE_URL, from compiled dist/
//   npm run db:migrate:dev      # same, via tsx from src/
//
// Run this after `db:setup` on a fresh DB (setup records the current migrations
// as baseline, so the first migrate is a no-op), and on every deploy that adds
// new migration files. Each migration file manages its own transaction where it
// needs one (several wrap themselves in begin/commit), so this runner executes
// the file as-is and records it on success rather than wrapping it.
import {
  makePool,
  paths,
  readSql,
  migrationFiles,
  MIGRATIONS_TABLE_DDL,
} from './runner';
import path from 'node:path';

async function main() {
  const p = paths();
  const pool = makePool();
  const client = await pool.connect();
  try {
    await client.query(MIGRATIONS_TABLE_DDL);
    const { rows } = await client.query(`select filename from schema_migrations`);
    const applied = new Set(rows.map((r) => r.filename as string));

    const pending = migrationFiles(p.migrationsDir).filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('No pending migrations — database is up to date.');
      return;
    }

    console.log(`${pending.length} pending migration(s):`);
    for (const file of pending) {
      console.log(`  applying ${file} …`);
      await client.query(readSql(path.join(p.migrationsDir, file)));
      await client.query(
        `insert into schema_migrations (filename) values ($1)
         on conflict (filename) do nothing`,
        [file]
      );
    }
    console.log(`\nDone. Applied ${pending.length} migration(s).`);
  } catch (err) {
    console.error('\nMigration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
