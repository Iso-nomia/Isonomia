import { prisma } from "@/lib/prismaclient";
import type { CitationIntentType } from "@/components/citations/IntentSelector";

export interface EvidenceBalance {
  supports: number;
  refutes: number;
  context: number;
  other: number;
  unclassified: number; // Citations without intent (null)
  total: number;
  balance: "pro" | "con" | "balanced" | "neutral" | "unclassified";
  ratio: number; // supports / (supports + refutes), NaN if both 0
}

/**
 * Compute the evidence balance for a target (claim, argument, etc.)
 * Handles null intent gracefully (counts as "unclassified")
 */
export async function computeEvidenceBalance(
  targetType: string,
  targetId: string
): Promise<EvidenceBalance> {
  // Use raw query to fetch citations with intent field
  const citations = await prisma.citation.findMany({
    where: { targetType, targetId },
  });

  // Map to extract intent (handles old Prisma client cache)
  const mapped = citations.map((c: any) => ({ intent: c.intent ?? null }));
  return computeEvidenceBalanceFromCitations(mapped);
}

/**
 * Compute evidence balance from an array of citations (client-side friendly)
 * Useful when you already have citations loaded
 */
export function computeEvidenceBalanceFromCitations(
  citations: Array<{ intent?: CitationIntentType | string | null }>
): EvidenceBalance {
  const counts: Record<string, number> = {};
  let unclassified = 0;
  let total = citations.length;

  for (const c of citations) {
    if (c.intent === null || c.intent === undefined) {
      unclassified++;
    } else {
      counts[c.intent] = (counts[c.intent] || 0) + 1;
    }
  }

  const supports = counts["supports"] || 0;
  const refutes = counts["refutes"] || 0;
  const context =
    (counts["context"] || 0) +
    (counts["background"] || 0) +
    (counts["defines"] || 0);
  const other = total - supports - refutes - context - unclassified;

  let balance: EvidenceBalance["balance"];
  if (total === 0) {
    balance = "neutral";
  } else if (unclassified === total) {
    balance = "unclassified";
  } else if (supports === 0 && refutes === 0) {
    balance = "neutral";
  } else if (supports > refutes * 2) {
    balance = "pro";
  } else if (refutes > supports * 2) {
    balance = "con";
  } else {
    balance = "balanced";
  }

  const ratio =
    supports + refutes > 0 ? supports / (supports + refutes) : NaN;

  return {
    supports,
    refutes,
    context,
    other,
    unclassified,
    total,
    balance,
    ratio,
  };
}

/**
 * Get a human-readable summary of evidence balance
 */
export function getBalanceSummary(balance: EvidenceBalance): string {
  if (balance.total === 0) {
    return "No evidence yet";
  }

  if (balance.unclassified === balance.total) {
    return `${balance.total} citation${balance.total === 1 ? "" : "s"} (unclassified)`;
  }

  const parts: string[] = [];
  if (balance.supports > 0) {
    parts.push(`${balance.supports} supporting`);
  }
  if (balance.refutes > 0) {
    parts.push(`${balance.refutes} refuting`);
  }
  if (balance.context > 0) {
    parts.push(`${balance.context} contextual`);
  }
  if (balance.unclassified > 0) {
    parts.push(`${balance.unclassified} unclassified`);
  }

  return parts.join(", ");
}
