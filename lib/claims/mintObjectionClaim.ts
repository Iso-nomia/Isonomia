// lib/claims/mintObjectionClaim.ts
//
// Shared mint for a *scheme-free objection `Claim`* — an objection/challenge
// node that carries NO scheme, and therefore NO critical questions of its own,
// which keeps the challenge regress finite (ideation §4.2).
//
// Two write paths need to turn free objection text into an attacker `Claim`
// before wiring an edge, and must do so identically:
//   · the CQ-challenge path — lib/cqs/challengeCq.ts (step 7.2), which then
//     files a `ClaimEdge` + `CQAttack`;
//   · the freestanding attack path — `attack_argument` → POST /api/ca, which
//     needs an existing `conflictingClaimId` and mints one from `groundsText`.
//
// The mint is deliberately minimal (text + author + moid + deliberation) so
// both callers stay byte-for-byte compatible; validation/clamping of the text
// is the caller's responsibility.

import crypto from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Either the base client or an interactive-transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

export interface MintObjectionClaimInput {
  /**
   * Prisma handle. Accepts either the base client or a transaction client, so
   * callers can mint inside an existing `$transaction` or standalone.
   */
  db: Db;
  /** The objection text; the claim body. Caller validates/clamps length. */
  text: string;
  /** Resolved author id (auth_id string). MCP callers resolve to `mcp-bot`. */
  createdById: string;
  /** Deliberation the objection belongs to (nullable, mirroring `Claim`). */
  deliberationId: string | null;
  /**
   * moid namespace prefix, e.g. `"cq-challenge"` (CQ path) or
   * `"attack-objection"` (freestanding attack). Defaults to `"objection"`.
   */
  moidPrefix?: string;
}

/**
 * Mint a scheme-free objection `Claim`. Returns the new claim's id.
 */
export async function mintObjectionClaim(
  input: MintObjectionClaimInput,
): Promise<{ id: string }> {
  const {
    db,
    text,
    createdById,
    deliberationId,
    moidPrefix = "objection",
  } = input;

  return db.claim.create({
    data: {
      text,
      createdById,
      moid: `${moidPrefix}-${crypto.randomBytes(8).toString("hex")}`,
      deliberationId,
    },
    select: { id: true },
  });
}
