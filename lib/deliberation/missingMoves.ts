/**
 * MissingMoveReport — Track AI-EPI Pt. 4 §3.
 *
 * Per-deliberation diff between the scheme-typical-move catalog
 * (`config/schemeMoveCatalog`) and the moves actually present in the
 * argument graph. Converts the protocol's preventive anti-strawman
 * discipline ("you cannot attack a conclusion without naming a premise
 * or inference") into a productive surface ("here are the
 * scheme-typical moves the graph does not contain, by name").
 */

import { prisma } from "@/lib/prismaclient";
import {
  SCHEME_MOVE_CATALOG,
  TYPICAL_DELIBERATION_SCHEME_PAIRS,
  CROSS_SCHEME_MEDIATORS,
} from "@/config/schemeMoveCatalog";

export interface MissingMovePerArgument {
  argumentId: string;
  schemeKey: string | null;
  expectedCqs: string[];
  presentCqs: string[];
  missingCqs: string[];
  expectedUndercutTypes: Array<{
    key: string;
    label: string;
    severity: "scheme-required" | "scheme-recommended";
  }>;
  presentUndercutTypes: string[];
  missingUndercutTypes: Array<{
    key: string;
    label: string;
    severity: "scheme-required" | "scheme-recommended";
  }>;
}

export interface MissingMoveReport {
  deliberationId: string;
  perArgument: Record<string, MissingMovePerArgument>;
  perDeliberation: {
    /** Schemes the topic typically employs but no argument in the deliberation uses. */
    schemesUnused: string[];
    /** True when no argument targets the deliberation itself (no meta-argument). */
    metaArgumentsAbsent: boolean;
    /** True when no `practical-reasoning` (or other mediator) bridges sub-debates. */
    crossSchemeMediatorsAbsent: boolean;
  };
}

/**
 * Read the metaJson on a ConflictApplication to surface an "undercut
 * type" tag if one was set when the attack was created. Existing rows
 * may not carry this tag — `null` is correct in that case.
 */
function readUndercutTypeFromCa(metaJson: unknown): string | null {
  if (!metaJson || typeof metaJson !== "object") return null;
  const meta = metaJson as Record<string, unknown>;
  const t = meta.undercutType ?? meta.attackKind ?? null;
  return typeof t === "string" ? t : null;
}

export async function computeMissingMoves(
  deliberationId: string,
): Promise<MissingMoveReport | null> {
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!deliberation) return null;

  const argRows = await prisma.argument.findMany({
    where: { deliberationId },
    select: {
      id: true,
      conclusionClaimId: true,
      argumentSchemes: {
        select: {
          isPrimary: true,
          order: true,
          scheme: {
            select: {
              key: true,
              cqs: { select: { cqKey: true } },
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
      },
    },
  });

  const argIds = argRows.map((a) => a.id);
  const conclusionIds = argRows
    .map((a) => a.conclusionClaimId)
    .filter((x): x is string => !!x);

  // Pull conflict applications whose `metaJson.undercutType` (or attackKind)
  // tells us which scheme-typical undercut was raised against each argument.
  const cas = await prisma.conflictApplication.findMany({
    where: {
      deliberationId,
      OR: [
        { conflictedArgumentId: { in: argIds.length ? argIds : ["__none__"] } },
        {
          conflictedClaimId: {
            in: conclusionIds.length ? conclusionIds : ["__none__"],
          },
        },
      ],
    },
    select: {
      conflictedArgumentId: true,
      conflictedClaimId: true,
      metaJson: true,
    },
  });

  // Pull CQ statuses to know which catalog CQs have been engaged.
  const cqStatuses = await prisma.cQStatus.findMany({
    where: {
      targetType: "argument",
      targetId: { in: argIds.length ? argIds : ["__none__"] },
    },
    select: {
      targetId: true,
      schemeKey: true,
      cqKey: true,
      statusEnum: true,
    },
  });

  // Map argument → present CQ keys (any non-OPEN status counts as "present").
  const presentCqsByArg = new Map<string, Set<string>>();
  for (const s of cqStatuses) {
    if (!s.targetId) continue;
    const set = presentCqsByArg.get(s.targetId) ?? new Set();
    if (s.statusEnum !== "OPEN" || s.statusEnum) {
      // Any row at all means the CQ has been engaged at minimum (a row is
      // created when the CQ is opened or answered).
      set.add(s.cqKey);
    }
    presentCqsByArg.set(s.targetId, set);
  }

  // Map argument → present undercut-type tags from CA metaJson.
  const claimToConcludingArgs = new Map<string, string[]>();
  for (const a of argRows) {
    if (a.conclusionClaimId) {
      const list = claimToConcludingArgs.get(a.conclusionClaimId) ?? [];
      list.push(a.id);
      claimToConcludingArgs.set(a.conclusionClaimId, list);
    }
  }

  const presentUndercutTypesByArg = new Map<string, Set<string>>();
  for (const ca of cas) {
    const tag = readUndercutTypeFromCa(ca.metaJson);
    if (!tag) continue;
    const targets: string[] = [];
    if (ca.conflictedArgumentId) targets.push(ca.conflictedArgumentId);
    if (ca.conflictedClaimId) {
      targets.push(...(claimToConcludingArgs.get(ca.conflictedClaimId) ?? []));
    }
    for (const t of targets) {
      const set = presentUndercutTypesByArg.get(t) ?? new Set();
      set.add(tag);
      presentUndercutTypesByArg.set(t, set);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Per-argument diffs
  // ────────────────────────────────────────────────────────────

  const perArgument: Record<string, MissingMovePerArgument> = {};
  const schemesUsed = new Set<string>();

  for (const a of argRows) {
    const primary =
      a.argumentSchemes.find((s) => s.isPrimary) ?? a.argumentSchemes[0] ?? null;
    const schemeKey = primary?.scheme?.key ?? null;
    if (schemeKey) schemesUsed.add(schemeKey);

    const expectedCqs: string[] =
      primary?.scheme?.cqs
        ?.map((c) => c.cqKey)
        .filter((k): k is string => k != null) ?? [];
    const presentCqs = [...(presentCqsByArg.get(a.id) ?? new Set<string>())];
    const missingCqs = expectedCqs.filter((k) => !presentCqs.includes(k));

    const catalog = schemeKey ? SCHEME_MOVE_CATALOG[schemeKey] : undefined;
    const expectedUndercutTypes = catalog?.expectedUndercutTypes ?? [];
    const presentUndercutTypes = [
      ...(presentUndercutTypesByArg.get(a.id) ?? new Set<string>()),
    ];
    const missingUndercutTypes = expectedUndercutTypes.filter(
      (u) => !presentUndercutTypes.includes(u.key),
    );

    perArgument[a.id] = {
      argumentId: a.id,
      schemeKey,
      expectedCqs,
      presentCqs,
      missingCqs,
      expectedUndercutTypes,
      presentUndercutTypes,
      missingUndercutTypes,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Per-deliberation rollups
  // ────────────────────────────────────────────────────────────

  // schemesUnused: any catalog scheme that the typical-pairs say should
  // appear given the schemes already in use, but doesn't.
  const schemesUnusedSet = new Set<string>();
  for (const [a, b] of TYPICAL_DELIBERATION_SCHEME_PAIRS) {
    if (schemesUsed.has(a) && !schemesUsed.has(b)) schemesUnusedSet.add(b);
    if (schemesUsed.has(b) && !schemesUsed.has(a)) schemesUnusedSet.add(a);
  }

  // metaArgumentsAbsent: are there Issue rows of kind 'structural' /
  // 'governance' / 'community_defense' for this deliberation? (The closest
  // thing the schema has to "argument about the deliberation itself".)
  const metaIssueCount = await prisma.issue.count({
    where: {
      deliberationId,
      kind: { in: ["structural", "governance", "community_defense"] },
    },
  });

  const crossSchemeMediatorsAbsent = ![...schemesUsed].some((k) =>
    CROSS_SCHEME_MEDIATORS.has(k),
  );

  return {
    deliberationId,
    perArgument,
    perDeliberation: {
      schemesUnused: [...schemesUnusedSet].sort(),
      metaArgumentsAbsent: metaIssueCount === 0,
      crossSchemeMediatorsAbsent,
    },
  };
}
