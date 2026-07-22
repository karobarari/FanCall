// Bootstrap a fresh database to the current schema.
//
//   npm run db:setup            # against DATABASE_URL, from compiled dist/
//   npm run db:setup:dev        # same, via tsx from src/
//   npm run db:setup -- --fixtures   # also load the sample fixtures
//   npm run db:setup -- --force      # re-run even if tables already exist
//
// db/schema.sql is a full pg_dump snapshot that already contains every
// migration in server/src/db/migrations, so a fresh DB is provisioned from the
// schema + seeds — NOT by replaying those migrations (that would double-apply
// backfills). After provisioning, this records the schema baseline and marks
// every existing migration as applied, so a later `db:migrate` only runs
// migrations added after this snapshot.
import {
  makePool,
  paths,
  readSql,
  migrationFiles,
  MIGRATIONS_TABLE_DDL,
  BASELINE_MARKER,
} from './runner';

async function main() {
  const force = process.argv.includes('--force');
  const withFixtures = process.argv.includes('--fixtures');
  const p = paths();
  const pool = makePool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `select to_regclass('public.users') as users`
    );
    if (rows[0].users && !force) {
      console.error(
        'Database already has a "users" table — it looks provisioned.\n' +
          'Run `npm run db:migrate` to apply any new migrations, or pass ' +
          '--force to re-run setup anyway (this will error on existing objects).'
      );
      process.exit(1);
    }

    await client.query('begin');

    console.log('Applying db/schema.sql …');
    await client.query(readSql(p.schema));

    console.log('Seeding teams (db/seed-teams.sql) …');
    await client.query(readSql(p.seedTeams));

    console.log('Seeding club plans (db/seed-plans.sql) …');
    await client.query(readSql(p.seedPlans));

    if (withFixtures) {
      console.log('Seeding sample fixtures (db/seed-fixtures-all.sql) …');
      await client.query(readSql(p.seedFixtures));
    }

    // Record the baseline: schema.sql plus every migration that is already
    // baked into it, so db:migrate treats them as done and only runs newer ones.
    await client.query(MIGRATIONS_TABLE_DDL);
    const files = [BASELINE_MARKER, ...migrationFiles(p.migrationsDir)];
    await client.query(
      `insert into schema_migrations (filename)
         select unnest($1::text[])
       on conflict (filename) do nothing`,
      [files]
    );

    await client.query('commit');
    console.log(
      `\nDone. Provisioned schema + seeds and recorded ${files.length} baseline ` +
        `migration markers.\nVerify: select count(*) from teams; (expect 20).`
    );
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('\nSetup failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
