/**
 * Dev helper — grant a `DeliberationRole` so you can read typology / facilitation
 * surfaces without being the deliberation's `createdById`.
 *
 * Usage:
 *   npx tsx scripts/grant-deliberation-role.ts <deliberationId> <authUserId> [role]
 *
 * Defaults `role` to `facilitator` (which `isFacilitator` recognises). Pass
 * `author` for plain participant access.
 *
 * Tip: discover your auth id with `curl http://localhost:3000/api/auth/me`
 * after signing in.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [deliberationId, userId, roleArg] = process.argv.slice(2);
const role = roleArg ?? "facilitator";

if (!deliberationId || !userId) {
  console.error(
    "Usage: npx tsx scripts/grant-deliberation-role.ts <deliberationId> <authUserId> [role]",
  );
  process.exit(1);
}

async function main() {
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, createdById: true },
  });
  if (!delib) {
    console.error(`✗ Deliberation ${deliberationId} not found`);
    process.exit(2);
  }

  if (delib.createdById === userId) {
    console.log(
      `· ${userId} is already the deliberation host (createdById). No role row needed.`,
    );
    return;
  }

  const row = await prisma.deliberationRole.upsert({
    where: {
      deliberationId_userId_role: { deliberationId, userId, role },
    },
    create: { deliberationId, userId, role },
    update: {},
  });
  console.log(
    `✓ Granted role "${role}" to ${userId} on deliberation ${deliberationId} (id ${row.id}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
