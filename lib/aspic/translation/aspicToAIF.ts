/**
 * ASPIC+ → AIF Translation (Definition 4.2)
 * Creates AIF PA-nodes from ASPIC+ KnowledgeBase preferences
 * 
 * Based on Bex, Prakken, Reed (2013) formal definitions:
 * For each (φ, ψ) ∈ ≤': Create PA-node with I-node(φ) →[preferred] PA →[dispreferred] I-node(ψ)
 * For each (r, r') ∈ ≤: Create PA-node with RA-node(r) →[preferred] PA →[dispreferred] RA-node(r')
 */

import { prisma } from "@/lib/prismaclient";
import type { KnowledgeBase } from "@/lib/aspic/types";

/**
 * Main translation function: KB preferences → create PA-nodes
 * 
 * @param deliberationId The deliberation context
 * @param knowledgeBase ASPIC+ knowledge base with preferences
 * @param userId User creating the preferences
 * @returns Statistics about created and skipped PA-nodes
 */
export async function createPANodesFromASPICPreferences(
  deliberationId: string,
  knowledgeBase: KnowledgeBase,
  userId: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // 1. Create PA-nodes for premise preferences (≤')
  for (const pref of knowledgeBase.premisePreferences) {
    try {
      const preferredClaim = await getClaimIdFromFormula(pref.preferred, deliberationId);
      const dispreferredClaim = await getClaimIdFromFormula(pref.dispreferred, deliberationId);

      if (!preferredClaim) {
        errors.push(`Preferred premise not found: ${pref.preferred}`);
        skipped++;
        continue;
      }

      if (!dispreferredClaim) {
        errors.push(`Dispreferred premise not found: ${pref.dispreferred}`);
        skipped++;
        continue;
      }

      // Check if PA-node already exists
      const existing = await prisma.preferenceApplication.findFirst({
        where: {
          deliberationId,
          preferredClaimId: preferredClaim,
          dispreferredClaimId: dispreferredClaim,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.preferenceApplication.create({
        data: {
          deliberationId,
          createdById: userId,
          preferredClaimId: preferredClaim,
          dispreferredClaimId: dispreferredClaim,
        },
      });

      created++;
    } catch (error) {
      errors.push(`Error creating premise preference: ${error}`);
      skipped++;
    }
  }

  // 2. Create PA-nodes for rule preferences (≤)
  for (const pref of knowledgeBase.rulePreferences) {
    try {
      const preferredArg = await getArgumentIdFromRuleId(pref.preferred, deliberationId);
      const dispreferredArg = await getArgumentIdFromRuleId(pref.dispreferred, deliberationId);

      if (!preferredArg) {
        // Try as scheme ID directly
        const preferredScheme = await getSchemeById(pref.preferred);
        const dispreferredScheme = await getSchemeById(pref.dispreferred);

        if (preferredScheme && dispreferredScheme) {
          // Create scheme-to-scheme preference
          const existing = await prisma.preferenceApplication.findFirst({
            where: {
              deliberationId,
              preferredSchemeId: pref.preferred,
              dispreferredSchemeId: pref.dispreferred,
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          await prisma.preferenceApplication.create({
            data: {
              deliberationId,
              createdById: userId,
              preferredSchemeId: pref.preferred,
              dispreferredSchemeId: pref.dispreferred,
            },
          });

          created++;
          continue;
        }

        errors.push(`Preferred rule not found: ${pref.preferred}`);
        skipped++;
        continue;
      }

      if (!dispreferredArg) {
        errors.push(`Dispreferred rule not found: ${pref.dispreferred}`);
        skipped++;
        continue;
      }

      const existing = await prisma.preferenceApplication.findFirst({
        where: {
          deliberationId,
          preferredArgumentId: preferredArg,
          dispreferredArgumentId: dispreferredArg,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.preferenceApplication.create({
        data: {
          deliberationId,
          createdById: userId,
          preferredArgumentId: preferredArg,
          dispreferredArgumentId: dispreferredArg,
        },
      });

      created++;
    } catch (error) {
      errors.push(`Error creating rule preference: ${error}`);
      skipped++;
    }
  }

  return { created, skipped, errors };
}

/**
 * Map formula text → Claim ID (reverse of getFormulaFromClaim)
 * 
 * @param formula The formula text to find
 * @param deliberationId The deliberation context
 * @returns The claim ID or null if not found
 */
async function getClaimIdFromFormula(
  formula: string,
  deliberationId: string
): Promise<string | null> {
  const claim = await prisma.claim.findFirst({
    where: {
      text: formula,
      deliberationId,
    },
    select: { id: true },
  });
  return claim?.id ?? null;
}

/**
 * Map Rule ID → Argument ID (reverse of getRuleIdFromArgument)
 * 
 * @param ruleId The rule/scheme ID to find
 * @param deliberationId The deliberation context
 * @returns The argument ID or null if not found
 */
async function getArgumentIdFromRuleId(
  ruleId: string,
  deliberationId: string
): Promise<string | null> {
  const argument = await prisma.argument.findFirst({
    where: {
      schemeId: ruleId,
      deliberationId,
    },
    select: { id: true },
  });
  return argument?.id ?? null;
}

/**
 * Get scheme by ID
 * 
 * @param schemeId The scheme ID
 * @returns The scheme or null if not found
 */
async function getSchemeById(schemeId: string): Promise<any | null> {
  const scheme = await prisma.argumentScheme.findUnique({
    where: { id: schemeId },
    select: { id: true, key: true },
  });
  return scheme ?? null;
}

/**
 * Batch create PA-nodes from preferences
 * More efficient for large numbers of preferences
 * 
 * @param deliberationId The deliberation context
 * @param knowledgeBase ASPIC+ knowledge base with preferences
 * @param userId User creating the preferences
 * @returns Statistics about created and skipped PA-nodes
 */
export async function batchCreatePANodesFromASPICPreferences(
  deliberationId: string,
  knowledgeBase: KnowledgeBase,
  userId: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const paNodes: any[] = [];
  const errors: string[] = [];
  let skipped = 0;

  // Collect all PA-node data to create
  for (const pref of knowledgeBase.premisePreferences) {
    const preferredClaim = await getClaimIdFromFormula(pref.preferred, deliberationId);
    const dispreferredClaim = await getClaimIdFromFormula(pref.dispreferred, deliberationId);

    if (!preferredClaim || !dispreferredClaim) {
      skipped++;
      continue;
    }

    // Check if already exists
    const existing = await prisma.preferenceApplication.findFirst({
      where: {
        deliberationId,
        preferredClaimId: preferredClaim,
        dispreferredClaimId: dispreferredClaim,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    paNodes.push({
      deliberationId,
      createdById: userId,
      preferredClaimId: preferredClaim,
      dispreferredClaimId: dispreferredClaim,
    });
  }

  for (const pref of knowledgeBase.rulePreferences) {
    const preferredArg = await getArgumentIdFromRuleId(pref.preferred, deliberationId);
    const dispreferredArg = await getArgumentIdFromRuleId(pref.dispreferred, deliberationId);

    if (!preferredArg || !dispreferredArg) {
      // Try as scheme preferences
      const preferredScheme = await getSchemeById(pref.preferred);
      const dispreferredScheme = await getSchemeById(pref.dispreferred);

      if (preferredScheme && dispreferredScheme) {
        const existing = await prisma.preferenceApplication.findFirst({
          where: {
            deliberationId,
            preferredSchemeId: pref.preferred,
            dispreferredSchemeId: pref.dispreferred,
          },
        });

        if (!existing) {
          paNodes.push({
            deliberationId,
            createdById: userId,
            preferredSchemeId: pref.preferred,
            dispreferredSchemeId: pref.dispreferred,
          });
        } else {
          skipped++;
        }
        continue;
      }

      skipped++;
      continue;
    }

    const existing = await prisma.preferenceApplication.findFirst({
      where: {
        deliberationId,
        preferredArgumentId: preferredArg,
        dispreferredArgumentId: dispreferredArg,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    paNodes.push({
      deliberationId,
      createdById: userId,
      preferredArgumentId: preferredArg,
      dispreferredArgumentId: dispreferredArg,
    });
  }

  // Batch create all PA-nodes
  try {
    await prisma.preferenceApplication.createMany({
      data: paNodes,
      skipDuplicates: true,
    });
  } catch (error) {
    errors.push(`Batch creation error: ${error}`);
  }

  return { created: paNodes.length, skipped, errors };
}

/**
 * Delete PA-nodes that correspond to ASPIC+ preferences
 * Useful for cleanup or when preferences are removed from KB
 * 
 * @param deliberationId The deliberation context
 * @param knowledgeBase ASPIC+ knowledge base with preferences to remove
 * @returns Number of PA-nodes deleted
 */
export async function deletePANodesFromASPICPreferences(
  deliberationId: string,
  knowledgeBase: KnowledgeBase
): Promise<number> {
  let deleted = 0;

  // Delete premise preference PA-nodes
  for (const pref of knowledgeBase.premisePreferences) {
    const preferredClaim = await getClaimIdFromFormula(pref.preferred, deliberationId);
    const dispreferredClaim = await getClaimIdFromFormula(pref.dispreferred, deliberationId);

    if (!preferredClaim || !dispreferredClaim) continue;

    const result = await prisma.preferenceApplication.deleteMany({
      where: {
        deliberationId,
        preferredClaimId: preferredClaim,
        dispreferredClaimId: dispreferredClaim,
      },
    });

    deleted += result.count;
  }

  // Delete rule preference PA-nodes
  for (const pref of knowledgeBase.rulePreferences) {
    const preferredArg = await getArgumentIdFromRuleId(pref.preferred, deliberationId);
    const dispreferredArg = await getArgumentIdFromRuleId(pref.dispreferred, deliberationId);

    if (preferredArg && dispreferredArg) {
      const result = await prisma.preferenceApplication.deleteMany({
        where: {
          deliberationId,
          preferredArgumentId: preferredArg,
          dispreferredArgumentId: dispreferredArg,
        },
      });

      deleted += result.count;
    } else {
      // Try as scheme preferences
      const result = await prisma.preferenceApplication.deleteMany({
        where: {
          deliberationId,
          preferredSchemeId: pref.preferred,
          dispreferredSchemeId: pref.dispreferred,
        },
      });

      deleted += result.count;
    }
  }

  return deleted;
}
