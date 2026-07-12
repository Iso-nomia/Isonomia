import { prisma } from "@/lib/prismaclient";

/**
 * Detect if an argument is composed (has incoming premise edges).
 * 
 * An argument is considered "composed" if it has ArgumentEdge records with type='support'
 * pointing TO it (toArgumentId), indicating that other arguments serve as its premises.
 * 
 * @param argumentId - The argument ID to check
 * @returns true if the argument has premise edges, false otherwise
 */
export async function detectComposition(argumentId: string): Promise<boolean> {
  const premiseCount = await prisma.argumentEdge.count({
    where: {
      toArgumentId: argumentId,
      type: "support", // premise edges
    },
  });
  
  return premiseCount > 0;
}

/**
 * Detect composition for an argument using ArgumentPremise join table.
 * 
 * This checks if the argument has ArgumentPremise records, which link
 * premise claims to the argument. This is an alternative to ArgumentEdge
 * for detecting composed arguments.
 * 
 * @param argumentId - The argument ID to check
 * @returns true if the argument has ArgumentPremise records, false otherwise
 */
export async function detectCompositionViaPremises(argumentId: string): Promise<boolean> {
  const premiseCount = await prisma.argumentPremise.count({
    where: {
      argumentId,
    },
  });
  
  return premiseCount > 0;
}

/**
 * Mark an argument's ArgumentSupport record as composed.
 * Updates all ArgumentSupport records for this argument to set composed=true.
 * 
 * @param argumentId - The argument ID to mark as composed
 * @param rationale - Optional rationale string (default: "Composed via premise chain")
 */
export async function markArgumentAsComposed(
  argumentId: string,
  rationale: string = "Composed via premise chain"
): Promise<void> {
  await prisma.argumentSupport.updateMany({
    where: { argumentId },
    data: { 
      composed: true,
      rationale,
      updatedAt: new Date(),
    },
  });
}

/**
 * Mark an argument as composed within a transaction.
 * Use this when you're already in a Prisma transaction context.
 * 
 * @param tx - Prisma transaction client
 * @param argumentId - The argument ID to mark as composed
 * @param rationale - Optional rationale string
 */
export async function markArgumentAsComposedInTx(
  tx: any,
  argumentId: string,
  rationale: string = "Composed via premise chain"
): Promise<void> {
  await tx.argumentSupport.updateMany({
    where: { argumentId },
    data: { 
      composed: true,
      rationale,
      updatedAt: new Date(),
    },
  });
}
