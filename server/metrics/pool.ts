// server/metrics/pool.ts
import { getGlobalPrisma } from '@/server/db/tenant';

export async function getGlobalConnectionCount() {
  const prisma = getGlobalPrisma();
  const [{ count }] = await prisma.$queryRawUnsafe<{ count: number }[]>(`
    SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()
  `);
  return count;
}
