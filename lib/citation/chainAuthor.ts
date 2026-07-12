/**
 * Resolve the numeric `User.id` (BigInt) that should own rows whose
 * ownership column is a BigInt FK to `User` — e.g. `ArgumentChain.createdBy`
 * and `ArgumentChainNode.addedBy`.
 *
 * This is intentionally separate from `resolveCitationCallerUserId`
 * (lib/citation/mcpAuth.ts), which returns a *string* author id. That string
 * is fine for free-text columns like `Argument.authorId`, but the chain
 * tables FK into `User.id` (BigInt), so an MCP-tokened request whose author
 * handle is the non-numeric `MCP_AUTHOR_USER_ID` (default "mcp-bot") cannot
 * satisfy the constraint directly.
 *
 * Resolution order for the MCP bot:
 *   1. `MCP_AUTHOR_USER_BIGINT_ID` env var (preferred — set to the seeded
 *      bot user's numeric id).
 *   2. Fallback lookup of the seeded bot `User` by its stable `auth_id`
 *      (= `MCP_AUTHOR_USER_ID`), so the seed script and env stay decoupled.
 *
 * Seed the bot user with `scripts/seed-mcp-bot-user.ts`.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { isMcpBearer } from "@/lib/citation/mcpAuth";

export interface ChainAuthor {
  /** Numeric owner id for BigInt FK columns (createdBy / addedBy). */
  ownerId: bigint;
  /** String author id for free-text columns (e.g. Argument.authorId). */
  userIdStr: string;
  /** True when the caller authenticated with the MCP shared-secret bearer. */
  viaMcp: boolean;
}

async function resolveMcpAuthorBigInt(): Promise<bigint | null> {
  const envId = process.env.MCP_AUTHOR_USER_BIGINT_ID;
  if (envId && /^\d+$/.test(envId)) return BigInt(envId);

  const handle = process.env.MCP_AUTHOR_USER_ID || "mcp-bot";
  const row = await prisma.user.findUnique({
    where: { auth_id: handle },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Resolve the chain owner for a request, supporting both cookie sessions and
 * the MCP shared-secret bearer. Returns `null` when the request is
 * unauthenticated or the MCP bot user has not been provisioned.
 */
export async function resolveChainAuthor(
  req: NextRequest,
): Promise<ChainAuthor | null> {
  if (isMcpBearer(req)) {
    const ownerId = await resolveMcpAuthorBigInt();
    if (ownerId == null) return null;
    return {
      ownerId,
      userIdStr: process.env.MCP_AUTHOR_USER_ID || "mcp-bot",
      viaMcp: true,
    };
  }

  let sessionUserId: unknown = null;
  try {
    sessionUserId = await getCurrentUserId();
  } catch {
    return null;
  }
  if (sessionUserId == null) return null;

  const userIdStr = String(sessionUserId);
  if (!/^\d+$/.test(userIdStr)) return null;

  return { ownerId: BigInt(userIdStr), userIdStr, viaMcp: false };
}
