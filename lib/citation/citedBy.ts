/**
 * Phase 10a — Internal cited-by graph (spec: docs/Phase10a_CitedBy_Spec.md).
 *
 * Pure read composition over rows that already exist — zero schema change.
 * "Cited-by" answers *who points at / uses this node*, which is distinct from
 * `/stances` (*who concludes for/against it*). An argument that concludes a
 * claim is PRODUCING the claim, not citing it, so it is intentionally absent
 * from that claim's cited-by (see spec §1).
 *
 * Four typed relations, drawn from four existing tables:
 *   supports   — ArgumentEdge type=support|concede into the target
 *   contests   — ArgumentEdge type=rebut|undercut into it, OR a ConflictApplication
 *   builds-on  — an ArgumentPremise that uses the target's conclusion claim
 *   reuses     — an ArgumentImport of the target into another deliberation
 *
 * Honesty (cross-dependency: decorrelated gating, M-1):
 *   - `counts.contests` is a top-level field so no renderer can present
 *     cited-by as pure applause — attacks are always visible.
 *   - Non-public citers are counted (`counts.nonPublic`) but never given a
 *     dangling link.
 *   - Empty is a first-class result (`edges: []`, `counts.total: 0`), and must
 *     be read as *absence of engagement*, never as settledness or soundness.
 */

import { prisma } from "@/lib/prismaclient";
import {
  computeDialecticalCounters,
  standingStateFromCounters,
} from "@/lib/citations/dialecticalCounters";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export const CITED_BY_DEFAULT_LIMIT = 50;
export const CITED_BY_MAX_LIMIT = 200;

export type CitedByKind = "supports" | "contests" | "builds-on" | "reuses";
export type CitedByVia =
  | "argument-edge"
  | "conflict-application"
  | "argument-premise"
  | "argument-import"
  | "argument-citation";

/** The node doing the citing. `shortCode`/`permalinkUrl` are null when the
 *  citer is not a public argument — cited-by counts non-public citers honestly
 *  but only links the ones the public can actually open. */
export interface CitingNode {
  kind: "argument" | "claim" | "deliberation";
  id: string;
  text: string | null;
  shortCode: string | null;
  permalinkUrl: string | null;
  deliberationId: string | null;
  authorKind: "HUMAN" | "AI" | "HYBRID" | null;
  /** Populated only when opts.includeStanding = true (bounded second pass). */
  standingState: string | null;
}

export interface CitedByEdge {
  kind: CitedByKind;
  via: CitedByVia;
  edgeSubtype: string | null;
  from: CitingNode;
  crossDeliberation: boolean;
  createdAt: string; // ISO 8601
}

export interface CitedByCounts {
  /** Internal citers + TRUSTED external citations. Unreviewed external
   *  citations are displayed but NOT counted here (D2 honesty invariant). */
  total: number;
  byKind: Record<CitedByKind, number>;
  contests: number;
  crossDeliberation: number;
  nonPublic: number;
  /** Verified-but-unreviewed external citations — displayed, not in `total`. */
  externalUnreviewed: number;
  /** Moderator-promoted external citations — included in `total`. */
  externalTrusted: number;
}

/** An inbound citation from an external page (Webmention). */
export interface ExternalCitationView {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  title: string | null;
  trustState: "unreviewed" | "trusted";
  verifiedAt: string | null;
  createdAt: string;
}

export interface CitedByResult {
  target: {
    kind: "argument" | "claim";
    id: string;
    shortCode?: string | null;
    moid?: string | null;
    /** For argument targets: the conclusion claim's MOID (drives counter-search links). */
    conclusionMoid?: string | null;
    text: string | null;
    deliberationId: string | null;
  };
  edges: CitedByEdge[];
  /** External (Webmention) citations, hidden ones excluded. Displayed below
   *  the internal edges; unreviewed ones are flagged and out of `counts.total`. */
  external: ExternalCitationView[];
  counts: CitedByCounts;
  truncated: boolean;
}

export interface CitedByOptions {
  limit?: number;
  sort?: "recent" | "stance";
  publicOnly?: boolean;
  includeStanding?: boolean;
}

/** Internal, pre-hydration edge. */
interface RawEdge {
  fromKind: "argument" | "claim" | "deliberation";
  fromId: string;
  kind: CitedByKind;
  via: CitedByVia;
  edgeSubtype: string | null;
  createdAt: Date;
}

const KIND_ORDER: CitedByKind[] = ["supports", "builds-on", "reuses", "contests"];

/** support and concede are non-adversarial engagement; rebut/undercut (and any
 *  unknown future EdgeType) fail safe to `contests` so an attack is never
 *  silently dropped from a cited-by list. `CA` edges are excluded upstream
 *  (the ConflictApplication row is the source of truth for those). */
function classifyEdgeType(type: string): CitedByKind {
  if (type === "support" || type === "concede") return "supports";
  return "contests";
}

/** Classify an ArgCitationType (argument→argument citation). Constructive uses
 *  are enumerated; REBUTTAL / CRITIQUE / CONTRAST and any unknown future value
 *  fail safe to `contests` so an attacking citation is never shown as applause. */
function classifyArgCitationType(t: string): CitedByKind {
  switch (t) {
    case "SUPPORT":
      return "supports";
    case "EXTENSION":
    case "APPLICATION":
    case "REFINEMENT":
    case "METHODOLOGY":
      return "builds-on";
    default:
      return "contests";
  }
}

function clampLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw) || raw <= 0) return CITED_BY_DEFAULT_LIMIT;
  return Math.min(CITED_BY_MAX_LIMIT, Math.floor(raw));
}

function emptyByKind(): Record<CitedByKind, number> {
  return { supports: 0, contests: 0, "builds-on": 0, reuses: 0 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns null when the target argument does not exist. */
export async function getArgumentCitedBy(
  argumentId: string,
  opts: CitedByOptions = {},
): Promise<CitedByResult | null> {
  const target = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      text: true,
      deliberationId: true,
      conclusionClaimId: true,
      conclusion: { select: { moid: true } },
      permalink: { select: { shortCode: true } },
    },
  });
  if (!target) return null;

  const conclusionClaimId = target.conclusionClaimId ?? null;

  const [edges, conflicts, premiseUsers, imports, argCitations] = await Promise.all([
    prisma.argumentEdge.findMany({
      where: { toArgumentId: argumentId, type: { not: "CA" as any } },
      select: { fromArgumentId: true, type: true, attackSubtype: true, createdAt: true },
    }),
    prisma.conflictApplication.findMany({
      where: {
        OR: [
          { conflictedArgumentId: argumentId },
          conclusionClaimId ? { conflictedClaimId: conclusionClaimId } : undefined,
        ].filter(Boolean) as any[],
      },
      select: {
        conflictingArgumentId: true,
        conflictingClaimId: true,
        legacyAttackType: true,
        createdAt: true,
      },
    }),
    conclusionClaimId
      ? prisma.argumentPremise.findMany({
          where: { claimId: conclusionClaimId, argumentId: { not: argumentId } },
          select: { argumentId: true, argument: { select: { createdAt: true } } },
        })
      : Promise.resolve([] as any[]),
    prisma.argumentImport.findMany({
      where: { fromArgumentId: argumentId },
      select: {
        toArgumentId: true,
        toDeliberationId: true,
        kind: true,
        createdAt: true,
      },
    }),
    prisma.argumentCitation.findMany({
      where: { citedArgumentId: argumentId },
      select: { citingArgumentId: true, citationType: true, createdAt: true },
    }),
  ]);

  const raw: RawEdge[] = [];

  for (const e of edges) {
    if (!e.fromArgumentId || e.fromArgumentId === argumentId) continue; // self-loop
    raw.push({
      fromKind: "argument",
      fromId: e.fromArgumentId,
      kind: classifyEdgeType(String(e.type)),
      via: "argument-edge",
      edgeSubtype: (e.attackSubtype as string | null) ?? String(e.type),
      createdAt: e.createdAt,
    });
  }

  for (const c of conflicts) {
    const fromId = c.conflictingArgumentId ?? c.conflictingClaimId ?? null;
    if (!fromId || fromId === argumentId) continue;
    raw.push({
      fromKind: c.conflictingArgumentId ? "argument" : "claim",
      fromId,
      kind: "contests",
      via: "conflict-application",
      edgeSubtype: (c.legacyAttackType as string | null) ?? null,
      createdAt: c.createdAt,
    });
  }

  for (const p of premiseUsers) {
    raw.push({
      fromKind: "argument",
      fromId: p.argumentId,
      kind: "builds-on",
      via: "argument-premise",
      edgeSubtype: null,
      createdAt: p.argument?.createdAt ?? new Date(0),
    });
  }

  for (const im of imports) {
    const materialized =
      im.toArgumentId && !im.toArgumentId.startsWith("virt:") ? im.toArgumentId : null;
    if (materialized === argumentId) continue;
    raw.push({
      fromKind: materialized ? "argument" : "deliberation",
      fromId: materialized ?? im.toDeliberationId,
      kind: "reuses",
      via: "argument-import",
      edgeSubtype: (im.kind as string | null) ?? null,
      createdAt: im.createdAt,
    });
  }

  for (const ac of argCitations) {
    if (!ac.citingArgumentId || ac.citingArgumentId === argumentId) continue;
    raw.push({
      fromKind: "argument",
      fromId: ac.citingArgumentId,
      kind: classifyArgCitationType(String(ac.citationType)),
      via: "argument-citation",
      edgeSubtype: (ac.citationType as string | null) ?? null,
      createdAt: ac.createdAt,
    });
  }

  return finalize(
    {
      kind: "argument",
      id: target.id,
      shortCode: target.permalink?.shortCode ?? null,
      conclusionMoid: target.conclusion?.moid ?? null,
      text: target.text ?? null,
      deliberationId: target.deliberationId ?? null,
    },
    target.deliberationId ?? null,
    raw,
    opts,
  );
}

/** Returns null when the target claim does not exist. */
export async function getClaimCitedBy(
  claimId: string,
  opts: CitedByOptions = {},
): Promise<CitedByResult | null> {
  const target = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, moid: true, text: true, deliberationId: true },
  });
  if (!target) return null;

  const [premiseUsers, edges, conflicts] = await Promise.all([
    prisma.argumentPremise.findMany({
      where: { claimId },
      select: { argumentId: true, argument: { select: { createdAt: true } } },
    }),
    prisma.argumentEdge.findMany({
      where: {
        type: { not: "CA" as any },
        OR: [{ targetClaimId: claimId }, { targetPremiseId: claimId }],
      },
      select: { fromArgumentId: true, type: true, attackSubtype: true, createdAt: true },
    }),
    prisma.conflictApplication.findMany({
      where: { conflictedClaimId: claimId },
      select: {
        conflictingArgumentId: true,
        conflictingClaimId: true,
        legacyAttackType: true,
        createdAt: true,
      },
    }),
  ]);

  const raw: RawEdge[] = [];

  for (const p of premiseUsers) {
    raw.push({
      fromKind: "argument",
      fromId: p.argumentId,
      kind: "builds-on",
      via: "argument-premise",
      edgeSubtype: null,
      createdAt: p.argument?.createdAt ?? new Date(0),
    });
  }

  for (const e of edges) {
    if (!e.fromArgumentId) continue;
    // targetPremiseId/targetClaimId edges are attacks on the claim.
    raw.push({
      fromKind: "argument",
      fromId: e.fromArgumentId,
      kind: classifyEdgeType(String(e.type)) === "supports" ? "builds-on" : "contests",
      via: "argument-edge",
      edgeSubtype: (e.attackSubtype as string | null) ?? String(e.type),
      createdAt: e.createdAt,
    });
  }

  for (const c of conflicts) {
    const fromId = c.conflictingArgumentId ?? c.conflictingClaimId ?? null;
    if (!fromId) continue;
    raw.push({
      fromKind: c.conflictingArgumentId ? "argument" : "claim",
      fromId,
      kind: "contests",
      via: "conflict-application",
      edgeSubtype: (c.legacyAttackType as string | null) ?? null,
      createdAt: c.createdAt,
    });
  }

  return finalize(
    {
      kind: "claim",
      id: target.id,
      moid: target.moid,
      text: target.text ?? null,
      deliberationId: target.deliberationId ?? null,
    },
    target.deliberationId ?? null,
    raw,
    opts,
  );
}

// ---------------------------------------------------------------------------
// Shared assembly: self-exclusion is done by callers; here we dedup, hydrate
// (one batched query per citer type — the no-N+1 guarantee), count over the
// full set, then sort + truncate.
// ---------------------------------------------------------------------------

async function finalize(
  target: CitedByResult["target"],
  targetDeliberationId: string | null,
  raw: RawEdge[],
  opts: CitedByOptions,
): Promise<CitedByResult> {
  const limit = clampLimit(opts.limit);
  const sort = opts.sort === "stance" ? "stance" : "recent";

  // Dedup on (fromKind:fromId | kind | via), keeping the earliest createdAt.
  const deduped = new Map<string, RawEdge>();
  for (const r of raw) {
    const key = `${r.fromKind}:${r.fromId}|${r.kind}|${r.via}`;
    const prev = deduped.get(key);
    if (!prev || r.createdAt < prev.createdAt) deduped.set(key, r);
  }
  const rawEdges = [...deduped.values()];

  // Batched hydration — one query per citer type, independent of edge count.
  const argIds = [...new Set(rawEdges.filter((r) => r.fromKind === "argument").map((r) => r.fromId))];
  const claimIds = [...new Set(rawEdges.filter((r) => r.fromKind === "claim").map((r) => r.fromId))];

  const [argRows, claimRows] = await Promise.all([
    argIds.length
      ? prisma.argument.findMany({
          where: { id: { in: argIds } },
          select: {
            id: true,
            text: true,
            deliberationId: true,
            authorKind: true,
            permalink: { select: { shortCode: true } },
          },
        })
      : Promise.resolve([] as any[]),
    claimIds.length
      ? prisma.claim.findMany({
          where: { id: { in: claimIds } },
          select: { id: true, text: true, deliberationId: true },
        })
      : Promise.resolve([] as any[]),
  ]);

  const argById = new Map(argRows.map((a: any) => [a.id, a]));
  const claimById = new Map(claimRows.map((c: any) => [c.id, c]));

  const hydrated: CitedByEdge[] = [];
  for (const r of rawEdges) {
    let node: CitingNode | null = null;
    if (r.fromKind === "argument") {
      const a = argById.get(r.fromId);
      if (!a) continue; // stale edge → drop, never throw
      const shortCode = a.permalink?.shortCode ?? null;
      node = {
        kind: "argument",
        id: a.id,
        text: a.text ?? null,
        shortCode,
        permalinkUrl: shortCode ? `${BASE_URL}/a/${shortCode}` : null,
        deliberationId: a.deliberationId ?? null,
        authorKind: (a.authorKind as CitingNode["authorKind"]) ?? null,
        standingState: null,
      };
    } else if (r.fromKind === "claim") {
      const c = claimById.get(r.fromId);
      if (!c) continue;
      node = {
        kind: "claim",
        id: c.id,
        text: c.text ?? null,
        shortCode: null,
        permalinkUrl: null,
        deliberationId: c.deliberationId ?? null,
        authorKind: null,
        standingState: null,
      };
    } else {
      // deliberation citer (virtual import) — counted, not linkable
      node = {
        kind: "deliberation",
        id: r.fromId,
        text: null,
        shortCode: null,
        permalinkUrl: null,
        deliberationId: r.fromId,
        authorKind: null,
        standingState: null,
      };
    }

    const crossDeliberation =
      node.deliberationId != null &&
      targetDeliberationId != null &&
      node.deliberationId !== targetDeliberationId;

    hydrated.push({
      kind: r.kind,
      via: r.via,
      edgeSubtype: r.edgeSubtype,
      from: node,
      crossDeliberation,
      createdAt: r.createdAt.toISOString(),
    });
  }

  // publicOnly drops unlinkable citers entirely (and out of the counts).
  const scoped = opts.publicOnly
    ? hydrated.filter((e) => e.from.permalinkUrl != null)
    : hydrated;

  // External (Webmention) citations — hidden ones excluded. Displayed below the
  // internal edges; unreviewed ones are shown but kept OUT of the headline
  // `total` until a moderator promotes them (D2 honesty invariant).
  const externalRows = await prisma.externalCitation.findMany({
    where: {
      targetType: target.kind,
      targetId: target.id,
      trustState: { not: "hidden" as any },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const external: ExternalCitationView[] = externalRows.map((r: any) => ({
    id: r.id,
    sourceUrl: r.sourceUrl,
    sourceDomain: r.sourceDomain,
    title: r.title ?? null,
    trustState: r.trustState,
    verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
  const externalTrusted = external.filter((e) => e.trustState === "trusted").length;
  const externalUnreviewed = external.filter((e) => e.trustState === "unreviewed").length;

  // Counts over the FULL scoped set (before truncation) so total never lies.
  const byKind = emptyByKind();
  let crossDeliberation = 0;
  let nonPublic = 0;
  for (const e of scoped) {
    byKind[e.kind]++;
    if (e.crossDeliberation) crossDeliberation++;
    if (e.from.permalinkUrl == null) nonPublic++;
  }
  const counts: CitedByCounts = {
    // Internal citers + trusted external only. Unreviewed external is
    // deliberately absent so spam can't inflate the cited number.
    total: scoped.length + externalTrusted,
    byKind,
    contests: byKind.contests,
    crossDeliberation,
    nonPublic,
    externalUnreviewed,
    externalTrusted,
  };

  // Sort, then truncate.
  scoped.sort((a, b) => {
    if (sort === "stance") {
      const d = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (d !== 0) return d;
    }
    return b.createdAt.localeCompare(a.createdAt); // recent first
  });
  const truncated = scoped.length > limit;
  const edges = scoped.slice(0, limit);

  if (opts.includeStanding) {
    await hydrateStanding(edges);
  }

  return { target, edges, external, counts, truncated };
}

/**
 * Bounded per-citer standing pass (opt-in). Only public arguments get a
 * standing; runs over the already-truncated edge list, so it is O(limit).
 * Uses the shared dialectical-counter helper so a citer's standing here is
 * computed by the exact same code the search route uses for its own rows.
 */
async function hydrateStanding(edges: CitedByEdge[]): Promise<void> {
  const targets = edges.filter((e) => e.from.kind === "argument" && e.from.shortCode);
  await Promise.all(
    targets.map(async (e) => {
      const counters = await computeDialecticalCounters({ argumentId: e.from.id });
      e.from.standingState = standingStateFromCounters(counters);
    }),
  );
}
