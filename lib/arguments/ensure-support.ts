// lib/arguments/ensure-support.ts
/**
 * Ensures an ArgumentSupport (derivation) record exists for an argument.
 * This is required for the evidential API to compute confidence scores.
 * 
 * Should be called after creating any Argument with a claimId.
 */

import { prisma } from "@/lib/prismaclient";
import { DEFAULT_ARGUMENT_CONFIDENCE } from "@/lib/config/confidence";

type EnsureSupportParams = {
  argumentId: string;
  claimId: string;
  deliberationId: string;
  base?: number;
  tx?: typeof prisma; // Optional transaction client
};

export async function ensureArgumentSupport({
  argumentId,
  claimId,
  deliberationId,
  base = DEFAULT_ARGUMENT_CONFIDENCE,
  tx,
}: EnsureSupportParams): Promise<void> {
  const client = tx ?? prisma;

  // Check if support already exists
  const existing = await client.argumentSupport.findFirst({
    where: { argumentId },
    select: { id: true },
  });

  if (existing) {
    // Support already exists, nothing to do
    return;
  }

  // Create the support record
  await client.argumentSupport.create({
    data: {
      argumentId,
      claimId,
      deliberationId,
      base: base ?? DEFAULT_ARGUMENT_CONFIDENCE,
    },
  });
}

/**
 * Convenience wrapper for ensuring support within a transaction
 */
export async function ensureArgumentSupportInTx(
  tx: any,
  params: Omit<EnsureSupportParams, 'tx'>
): Promise<void> {
  await ensureArgumentSupport({ ...params, tx });
}
