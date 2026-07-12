// lib/server/db-retry.ts
import { prisma } from "@/lib/prismaclient";

export async function withDbRetry<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (e?.code === "P1017" || e?.code === "P1001") {
      console.warn(`[db-retry] ${label ?? ""} ${e.code} → reconnecting`);
      try { await prisma.$disconnect(); } catch {}
      try { await prisma.$connect(); } catch {}
      return await fn();
    }
    throw e;
  }
}
