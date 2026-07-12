/**
 * Seed the MCP bot `User` row that owns chain rows created over the MCP
 * shared-secret bearer.
 *
 * Why: `ArgumentChain.createdBy` / `ArgumentChainNode.addedBy` are BigInt FKs
 * into `User.id`. The MCP author handle (`MCP_AUTHOR_USER_ID`, default
 * "mcp-bot") is a non-numeric string and cannot satisfy that FK, unlike the
 * free-text `Argument.authorId`. This upserts a stable `service` user keyed
 * on `auth_id = MCP_AUTHOR_USER_ID` so `resolveChainAuthor` (lib/citation/
 * chainAuthor.ts) can resolve a real numeric owner.
 *
 * Run: npx tsx scripts/seed-mcp-bot-user.ts
 * Then (optional) set MCP_AUTHOR_USER_BIGINT_ID to the printed id.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const handle = process.env.MCP_AUTHOR_USER_ID || "mcp-bot";

  const user = await prisma.user.upsert({
    where: { auth_id: handle },
    update: {},
    create: {
      auth_id: handle,
      username: handle,
      name: "Isonomia MCP Bot",
      kind: "service",
      onboarded: true,
    },
    select: { id: true, auth_id: true, kind: true },
  });

  console.log(
    `[seed-mcp-bot-user] ok — id=${user.id.toString()} auth_id=${user.auth_id} kind=${user.kind}`,
  );
  console.log(
    `[seed-mcp-bot-user] set MCP_AUTHOR_USER_BIGINT_ID=${user.id.toString()} (optional; auth_id lookup is the fallback)`,
  );
}

main()
  .catch((err) => {
    console.error("[seed-mcp-bot-user] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
