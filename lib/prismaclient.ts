import { PrismaClient, Prisma } from "@prisma/client";
import { DEFAULT_ARGUMENT_CONFIDENCE } from "@/lib/config/confidence";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const datasourceUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace("pgbouncer=false", "pgbouncer=true")
  : undefined;

// Add connection pool parameters to the URL
// Increased limits to handle long-running Ludics compilation transactions
const enhancedUrl = datasourceUrl
  ? `${datasourceUrl}${datasourceUrl.includes('?') ? '&' : '?'}connection_limit=30&pool_timeout=60`
  : undefined;

// ============================================================================
// PHASE 1: Auto-create ArgumentSupport for all arguments with conclusions
// ============================================================================
// Using Prisma Client Extensions (v5+ compatible) instead of deprecated middleware
// This ensures ArgumentSupport records are created automatically whenever an
// Argument is created with a claimId, preventing integration gaps.

const basePrisma = new PrismaClient({
  datasources: enhancedUrl ? { db: { url: enhancedUrl } } : undefined,
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Extend Prisma client with auto-ArgumentSupport creation
const extendedPrisma = basePrisma.$extends({
  query: {
    argument: {
      async create({ args, query }) {
        // Execute the original create operation
        const result = await query(args);
        
        // Auto-create ArgumentSupport if argument has a conclusion
        if (result.id && result.claimId && result.deliberationId) {
          try {
            await basePrisma.argumentSupport.create({
              data: {
                argumentId: result.id,
                claimId: result.claimId,
                deliberationId: result.deliberationId,
                base: result.confidence ?? DEFAULT_ARGUMENT_CONFIDENCE,
                rationale: "Auto-created via Prisma extension",
              },
            });
            console.log(`[ArgumentSupport Extension] Created support record for argument ${result.id}`);
          } catch (err: any) {
            // Ignore duplicate errors (@@unique constraint on [claimId, argumentId, mode])
            if (err.code !== "P2002") {
              console.error(`[ArgumentSupport Extension] Failed to create support for ${result.id}:`, err.message);
              // Don't fail the argument creation, just log the error
            }
          }
        }
        
        return result;
      },
    },
  },
});

export const prisma = (globalForPrisma.prisma || extendedPrisma) as typeof basePrisma;
export { Prisma };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma as any;
}

// Don't eagerly connect - let Prisma handle connections on-demand
// This prevents connection pool exhaustion from pre-connecting
// lib/prismaclient.ts
// import { PrismaClient } from '@prisma/client';

// // Augment the global scope so TS knows about __PRISMA__
// declare global {
//   // eslint-disable-next-line no-var
//   var __PRISMA__: PrismaClient | undefined;
// }

// // Build datasource URL (swap pgbouncer=false → true if present)
// const datasourceUrl = process.env.DATABASE_URL
//   ? process.env.DATABASE_URL.replace('pgbouncer=false', 'pgbouncer=true')
//   : undefined;


//   const prismaAny = (globalThis as any).__PRISMA__ as PrismaClient | undefined;

// // Create or reuse the client
// export const prisma: PrismaClient =
// prismaAny ??
//   new PrismaClient(
//     datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : undefined,
//   );

// // Cache in dev
// if (process.env.NODE_ENV !== 'production') {
//   globalThis.__PRISMA__ = prisma;
// }

// // Optional: eager connect (good for scripts)
// void prisma.$connect();