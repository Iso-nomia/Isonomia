// server/provisioner/db.ts
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

export async function createSchema(globalPrisma: PrismaClient, roomId: string) {
  const schema = `room_${roomId.replace(/[^a-zA-Z0-9_]/g, '')}`;
  await globalPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  return schema;
}

/**
 * Apply baseline SQL into the target schema.
 * The baseline file should NOT contain CREATE SCHEMA; it should assume search_path is set.
 */
export async function applyBaseline(globalPrisma: PrismaClient, schema: string) {
  const sqlPath = path.join(process.cwd(), 'sql', 'room_baseline.sql');
  if (!fs.existsSync(sqlPath)) {
    console.warn(`[provisioner] baseline not found at ${sqlPath}; skipping`);
    return;
  }
  const baseline = fs.readFileSync(sqlPath, 'utf8');
  await globalPrisma.$executeRawUnsafe(`SET search_path = "${schema}"`);
  await globalPrisma.$executeRawUnsafe(baseline);
}
