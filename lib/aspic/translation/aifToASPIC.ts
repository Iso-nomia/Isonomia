/**
 * AIF → ASPIC+ Translation (Definition 4.1)
 * Populates ASPIC+ KnowledgeBase preferences from AIF PreferenceApplication records
 * 
 * Based on Bex, Prakken, Reed (2013) formal definitions:
 * ≤' = {(vi, vj) | vi, vj ∈ K, ∃PA-node: vi →[preferred] PA →[dispreferred] vj}
 * ≤ = {(ri, rj) | ri, rj ∈ R, ∃PA-node: rai →[preferred] PA →[dispreferred] raj}
 */

import { prisma } from "@/lib/prismaclient";

/**
 * Main translation function: Fetch PA-nodes → populate KB preferences
 * 
 * @param deliberationId The deliberation to fetch preferences for
 * @returns Premise and rule preferences ready for ASPIC+ KnowledgeBase
 */
export async function populateKBPreferencesFromAIF(
  deliberationId: string
): Promise<{
  premisePreferences: Array<{ preferred: string; dispreferred: string }>;
  rulePreferences: Array<{ preferred: string; dispreferred: string }>;
}> {
  // 1. Fetch all PA records for deliberation
  const paRecords = await prisma.preferenceApplication.findMany({
    where: { deliberationId },
    select: {
      id: true,
      preferredClaimId: true,
      dispreferredClaimId: true,
      preferredArgumentId: true,
      dispreferredArgumentId: true,
      preferredSchemeId: true,
      dispreferredSchemeId: true,
    },
  });

  const premisePrefs: Array<{ preferred: string; dispreferred: string }> = [];
  const rulePrefs: Array<{ preferred: string; dispreferred: string }> = [];

  for (const pa of paRecords) {
    // Clause 5: I-node to I-node → premise preference ≤'
    if (pa.preferredClaimId && pa.dispreferredClaimId) {
      const preferred = await getFormulaFromClaim(pa.preferredClaimId);
      const dispreferred = await getFormulaFromClaim(pa.dispreferredClaimId);
      if (preferred && dispreferred) {
        premisePrefs.push({ preferred, dispreferred });
      }
    }

    // Clause 6: RA-node to RA-node → rule preference ≤
    if (pa.preferredArgumentId && pa.dispreferredArgumentId) {
      const preferredRule = await getRuleIdFromArgument(pa.preferredArgumentId);
      const dispreferredRule = await getRuleIdFromArgument(pa.dispreferredArgumentId);
      if (preferredRule && dispreferredRule) {
        rulePrefs.push({ preferred: preferredRule, dispreferred: dispreferredRule });
      }
    }

    // Handle scheme-to-scheme preferences (schemes are rules in ASPIC+)
    if (pa.preferredSchemeId && pa.dispreferredSchemeId) {
      rulePrefs.push({
        preferred: pa.preferredSchemeId,
        dispreferred: pa.dispreferredSchemeId,
      });
    }
  }

  return {
    premisePreferences: premisePrefs,
    rulePreferences: rulePrefs,
  };
}

/**
 * Map Claim ID → formula text
 * AIF I-nodes contain claims; ASPIC+ KB uses formula strings
 * 
 * @param claimId The claim ID to look up
 * @returns The claim text (formula) or null if not found
 */
async function getFormulaFromClaim(claimId: string): Promise<string | null> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { text: true },
  });
  return claim?.text ?? null;
}

/**
 * Map Argument ID → ASPIC+ rule ID.
 *
 * Canonical rule key (PA_NODE_PREFERENCE_INTEGRATION_ROADMAP decision Q1) is the
 * RA-node id `RA:<argumentId>`. This is exactly the defeasible-rule id assigned
 * during argument construction: `lib/aif/translation/aifToAspic.ts` builds rules
 * with `id: ra.id`, and `app/api/aspic/evaluate/route.ts` sets the RA node id to
 * `RA:<argumentId>`. The two layers MUST agree on this key or rule preferences
 * silently never match (issue A).
 *
 * Previously this returned `argument.scheme.id`, which never matched the
 * `RA:<argumentId>` rule ids, so every stored rule preference was inert.
 *
 * @param argumentId The argument ID to look up
 * @returns The `RA:<argumentId>` rule key, or null if the argument is missing
 */
async function getRuleIdFromArgument(argumentId: string): Promise<string | null> {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { id: true },
  });

  if (!argument) return null;

  return `RA:${argument.id}`;
}

/**
 * Compute transitive closure of preferences
 * Ensures: A < B, B < C ⟹ A < C
 * 
 * Uses Floyd-Warshall style algorithm to compute all implied preferences
 * 
 * @param prefs Initial preference relations
 * @returns Transitive closure of preferences
 */
export function computeTransitiveClosure(
  prefs: Array<{ preferred: string; dispreferred: string }>
): Array<{ preferred: string; dispreferred: string }> {
  // Build adjacency map: entity → set of worse entities
  const graph = new Map<string, Set<string>>();

  for (const { preferred, dispreferred } of prefs) {
    if (!graph.has(preferred)) graph.set(preferred, new Set());
    graph.get(preferred)!.add(dispreferred);

    // Ensure both nodes exist in graph
    if (!graph.has(dispreferred)) graph.set(dispreferred, new Set());
  }

  // Floyd-Warshall style transitive closure
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, aWorse] of graph) {
      for (const b of aWorse) {
        const bWorse = graph.get(b);
        if (bWorse) {
          for (const c of bWorse) {
            if (!aWorse.has(c)) {
              aWorse.add(c);
              changed = true;
            }
          }
        }
      }
    }
  }

  // Convert back to array format
  const result: Array<{ preferred: string; dispreferred: string }> = [];
  for (const [preferred, worseSet] of graph) {
    for (const dispreferred of worseSet) {
      result.push({ preferred, dispreferred });
    }
  }

  return result;
}

/**
 * Validate preferences (detect cycles)
 * Cycles indicate inconsistent preferences (A < B, B < C, C < A)
 * 
 * @param prefs Preference relations to validate
 * @returns Array of cycles found (each cycle is an array of node IDs)
 */
export function detectPreferenceCycles(
  prefs: Array<{ preferred: string; dispreferred: string }>
): string[][] {
  // Build adjacency map
  const graph = new Map<string, Set<string>>();
  for (const { preferred, dispreferred } of prefs) {
    if (!graph.has(preferred)) graph.set(preferred, new Set());
    graph.get(preferred)!.add(dispreferred);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      } else if (recStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
      }
    }

    recStack.delete(node);
    path.pop();
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Get detailed preference information including ordering metadata
 * 
 * @param deliberationId The deliberation to fetch preferences for
 * @returns Detailed preference records with ordering policies
 */
export async function getDetailedPreferences(deliberationId: string) {
  const paRecords = await prisma.preferenceApplication.findMany({
    where: { deliberationId },
    select: {
      id: true,
      preferredClaimId: true,
      dispreferredClaimId: true,
      preferredArgumentId: true,
      dispreferredArgumentId: true,
      preferredSchemeId: true,
      dispreferredSchemeId: true,
      createdAt: true,
      createdById: true,
    },
  });

  return paRecords;
}

/**
 * Check if a specific preference exists
 * 
 * @param deliberationId The deliberation context
 * @param preferred Preferred entity ID
 * @param dispreferred Dispreferred entity ID
 * @param type Type of preference (claim, argument, or scheme)
 * @returns True if preference exists
 */
export async function preferenceExists(
  deliberationId: string,
  preferred: string,
  dispreferred: string,
  type: "claim" | "argument" | "scheme"
): Promise<boolean> {
  const where: any = { deliberationId };

  if (type === "claim") {
    where.preferredClaimId = preferred;
    where.dispreferredClaimId = dispreferred;
  } else if (type === "argument") {
    where.preferredArgumentId = preferred;
    where.dispreferredArgumentId = dispreferred;
  } else if (type === "scheme") {
    where.preferredSchemeId = preferred;
    where.dispreferredSchemeId = dispreferred;
  }

  const existing = await prisma.preferenceApplication.findFirst({ where });
  return existing !== null;
}
