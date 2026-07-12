// lib/prisma-cli.ts
import { PrismaClient } from '@prisma/client';

// No global caching, no globalThis typing needed—perfect for one-off scripts
export const prisma = new PrismaClient(
  process.env.DATABASE_URL
    ? { datasources: { db: { url: process.env.DATABASE_URL.replace('pgbouncer=false', 'pgbouncer=true') } } }
    : undefined
);

// Eager connect so scripts fail fast if DB is unreachable
void prisma.$connect();
