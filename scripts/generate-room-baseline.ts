// scripts/generate-room-baseline.ts
/**
 * Dev helper to generate sql/room_baseline.sql from your current DB.
 * Requires `pg_dump` in PATH and appropriate env (PG* vars).
 *
 * Example:
 *   PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=... ts-node scripts/generate-room-baseline.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = spawnSync('pg_dump', ['--schema-only', '--no-owner', process.env.PGDATABASE ?? 'postgres'], { env: process.env });
if (out.status !== 0) {
  console.error(out.stderr.toString());
  process.exit(out.status ?? 1);
}
const sql = out.stdout.toString();
// Optional: filter down to room-scoped tables if you prefix or tag them.
fs.writeFileSync(path.join(process.cwd(), 'sql', 'room_baseline.sql'), sql, 'utf8');
console.log('Wrote sql/room_baseline.sql');
