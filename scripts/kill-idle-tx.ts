/**
 * Terminate Supavisor backends stuck "idle in transaction" so the
 * Argument migration can acquire AccessExclusiveLock.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL! } },
});

async function main() {
  const killed: any[] = await prisma.$queryRawUnsafe(`
    SELECT pid, pg_terminate_backend(pid) as terminated
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND state = 'idle in transaction'
      AND application_name = 'Supavisor'
      AND pid <> pg_backend_pid()
  `);
  console.log("terminated:", killed);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
