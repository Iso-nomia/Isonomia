/**
 * Phase 10a (task 10.1b) — the single source of truth for an argument's
 * per-row dialectical counters and the standing derived from them.
 *
 * Extracted verbatim from the public search route so that search, cited-by,
 * and any future consumer compute standing from identical code instead of
 * three drifting copies. The counts are:
 *
 *   cqAnswered   — CQStatus rows SATISFIED/PARTIALLY_SATISFIED for the argument
 *   supportEdges — inbound ArgumentEdge type=support
 *   attackEdges  — inbound ArgumentEdge type∈{rebut,undercut}
 *   attackCAs    — ConflictApplications targeting the argument OR any of its
 *                  attack-target claims (conclusion + premises; an undermine
 *                  targets a premise, so premise-targeted CAs are real attacks)
 *
 * `isTested` and the 5-bucket `standingState` are derived from these exactly as
 * the search route did inline.
 */

import { prisma } from "@/lib/prismaclient";
import { computeStandingState } from "@/lib/citations/argumentAttestation";

export interface DialecticalCounters {
  cqAnswered: number;
  supportEdges: number;
  attackEdges: number;
  attackCAs: number;
}

/**
 * The claim ids a ConflictApplication may target to count as an attack on this
 * argument: its conclusion plus every premise. Callers that already loaded the
 * argument (the search route) pass these in; callers that only have an id
 * (cited-by's opt-in standing pass) let this resolve them with one query.
 */
export async function resolveAttackTargetClaimIds(
  argumentId: string,
): Promise<string[]> {
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      conclusionClaimId: true,
      premises: { select: { claimId: true } },
    },
  });
  if (!arg) return [];
  const ids = [
    ...(arg.conclusionClaimId ? [arg.conclusionClaimId] : []),
    ...arg.premises.map((p) => p.claimId),
  ];
  return [...new Set(ids)];
}

export async function computeDialecticalCounters(input: {
  argumentId: string;
  /** Skip the resolve query when the caller already has them (search route). */
  attackTargetClaimIds?: string[];
}): Promise<DialecticalCounters> {
  const argId = input.argumentId;
  const attackTargetClaimIds =
    input.attackTargetClaimIds ?? (await resolveAttackTargetClaimIds(argId));

  const [cqAnswered, supportEdges, attackEdges, attackCAs] = await Promise.all([
    prisma.cQStatus.count({
      where: {
        OR: [
          { argumentId: argId },
          { targetType: "argument" as any, targetId: argId },
        ],
        statusEnum: { in: ["SATISFIED", "PARTIALLY_SATISFIED"] as any },
      },
    }),
    prisma.argumentEdge.count({
      where: { toArgumentId: argId, type: "support" as any },
    }),
    prisma.argumentEdge.count({
      where: { toArgumentId: argId, type: { in: ["rebut", "undercut"] as any } },
    }),
    prisma.conflictApplication.count({
      where: {
        OR: [
          { conflictedArgumentId: argId },
          attackTargetClaimIds.length
            ? { conflictedClaimId: { in: attackTargetClaimIds } }
            : undefined,
        ].filter(Boolean) as any[],
      },
    }),
  ]);

  return { cqAnswered, supportEdges, attackEdges, attackCAs };
}

/** The `tested_only` predicate, shared by search's quality filter and standing. */
export function deriveIsTested(c: DialecticalCounters): boolean {
  return (
    c.cqAnswered >= 2 ||
    (c.attackEdges + c.attackCAs >= 1 && c.supportEdges >= 1)
  );
}

/** The 5-bucket standing classifier fed from the counters. */
export function standingStateFromCounters(
  c: DialecticalCounters,
): ReturnType<typeof computeStandingState> {
  return computeStandingState({
    isTested: deriveIsTested(c),
    criticalQuestionsAnswered: c.cqAnswered,
    incomingAttacks: c.attackCAs,
    incomingAttackEdges: c.attackEdges,
    incomingSupports: c.supportEdges,
  });
}
