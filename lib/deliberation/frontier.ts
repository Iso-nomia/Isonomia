/**
 * ContestedFrontier — Track AI-EPI Pt. 4 §2.
 *
 * The set of dialectical *open edges* in a deliberation: the moves that
 * would actually shift the graph if engaged. This is the anti-centrist
 * substrate. An LLM consuming this object cannot produce "the truth is
 * somewhere between" prose without lying about a structured field —
 * the unanswered moves are listed by name and ranked by impact.
 *
 * `loadBearingnessRanking` is currently a heuristic (degree-based) rather
 * than a strict grounded-extension flip computation: removing an
 * argument and recomputing the extension over the deliberation's CEG is
 * O(n^2) in the worst case and is not the right operation to bake into
 * an MCP read path. The heuristic is honest about its shape: arguments
 * that *give* the most support to others, and conclude main-claim-path
 * conclusions, are ranked higher. A full grounded-extension version is
 * a sprint-2 candidate.
 */

import { prisma } from "@/lib/prismaclient";
import { computeMissingMoves } from "@/lib/deliberation/missingMoves";
import type { MinimalDisagreement } from "packages/ludics-engine/properTest";

export type { MinimalDisagreement } from "packages/ludics-engine/properTest";

export interface FrontierUnansweredUndercut {
  targetArgumentId: string;
  /**
   * Locator for which inference step this undercut targets within the
   * argument. `null` when the attack is conclusion-scoped (no sub-step).
   */
  inferenceLocator: string | null;
  /**
   * The challenger argument id when the undercut has been raised but not
   * yet answered. `null` when the undercut is *scheme-typical* (the
   * catalog says this scheme expects it) but no challenger exists yet.
   */
  challengerArgumentId: string | null;
  /** True when the absence comes from the scheme catalog rather than an actively-raised challenge. */
  schemeTypical: boolean;
  /** Scheme-catalog undercut key when `schemeTypical` is true; null otherwise. */
  undercutTypeKey: string | null;
  severity: "scheme-required" | "scheme-recommended" | "actively-raised";
}

export interface FrontierUnansweredUndermine {
  targetArgumentId: string;
  targetPremiseId: string;
  challengerArgumentId: string | null;
}

export interface FrontierUnansweredCQ {
  targetArgumentId: string;
  schemeKey: string;
  cqKey: string;
  cqPrompt: string;
  severity: "scheme-required" | "scheme-recommended";
}

export interface FrontierTerminalLeaf {
  argumentId: string;
  /** How far this argument sits from the deliberation's main-claim path (0 = on the path). */
  chainDepth: number;
  onMainConclusionPath: boolean;
}

export type FrontierSortBy = "loadBearingness" | "recency" | "severity";

export interface ContestedFrontier {
  deliberationId: string;
  unansweredUndercuts: FrontierUnansweredUndercut[];
  unansweredUndermines: FrontierUnansweredUndermine[];
  unansweredCqs: FrontierUnansweredCQ[];
  terminalLeaves: FrontierTerminalLeaf[];
  /** Argument ids ordered by frontier impact (highest first). */
  loadBearingnessRanking: string[];
  /**
   * Arguments ranked by *unanswered actively-raised attacks against them*
   * (highest first). Complements `loadBearingnessRanking`, which is
   * degree-based and surfaces foundational arguments. This list surfaces
   * arguments that have been challenged and not yet defended — i.e.
   * `tested-undermined` / `tested-attacked` material. Counts:
   *   undercuts targeting the arg with `severity === "actively-raised"`
   *   + undermines targeting the arg with a non-null challenger
   * Catalog-only (`schemeTypical`) undercuts and unanswered CQs are
   * excluded — those represent gaps, not contests.
   */
  contestednessRanking: Array<{
    argumentId: string;
    unansweredAttackCount: number;
  }>;
  /**
   * Per-argument load-bearingness scores keyed by argument id.
   *
   * Same heuristic that produces `loadBearingnessRanking`:
   *   score = (#arguments this one supports)
   *         + (2 if its conclusion is on the main-conclusion path else 0)
   *         − (#inbound attacks)
   *
   * Exposed so downstream consumers (e.g. `lib/deliberation/topology.ts`)
   * can detect near-co-equal hubs without re-walking the graph.
   * Additive — pre-existing consumers can ignore this field.
   */
  loadBearingnessScores: Record<string, number>;
  /**
   * The provably-minimal locus of disagreement (T008), when the dispute's
   * contested region is a single chronicle and the test fed to the kernel is a
   * proper (frontier-complete) test; otherwise a first-divergence (T006) or
   * heuristic fallback, or `null` when no verified extraction is attempted.
   *
   * The `basis` tag is load-bearing: the surface may only render "minimal" copy
   * when `basis === "minimal-T008"`. Additive — pre-existing consumers may
   * ignore this field. See
   * `RESEARCH_PROGRAMME/DEV_SPEC-minimal-disagreement-extractor-2026-06-04.md`.
   */
  minimalDisagreement?: MinimalDisagreement | null;
}

export async function computeContestedFrontier(
  deliberationId: string,
  sortBy: FrontierSortBy = "loadBearingness",
): Promise<ContestedFrontier | null> {
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!deliberation) return null;

  const argRows = await prisma.argument.findMany({
    where: { deliberationId },
    select: {
      id: true,
      createdAt: true,
      conclusionClaimId: true,
      premises: { select: { claim: { select: { id: true } } } },
      argumentSchemes: {
        select: {
          isPrimary: true,
          order: true,
          scheme: {
            select: {
              key: true,
              cqs: { select: { cqKey: true, text: true } },
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
      },
    },
  });

  const argIds = argRows.map((a) => a.id);

  const edges = await prisma.argumentEdge.findMany({
    where: { deliberationId },
    select: {
      type: true,
      attackType: true,
      fromArgumentId: true,
      toArgumentId: true,
      targetInferenceId: true,
      targetPremiseId: true,
    },
  });

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

  // ────────────────────────────────────────────────────────────
  // unansweredUndercuts: actively-raised undercuts whose challenger
  // is itself unattacked (hence "unanswered") + scheme-typical
  // undercut absences from MissingMoveReport.
  // ────────────────────────────────────────────────────────────

  // Map every argument → ids of arguments attacking it.
  const attackersByArg = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type === "rebut" || e.type === "undercut") {
      const list = attackersByArg.get(e.toArgumentId) ?? [];
      list.push(e.fromArgumentId);
      attackersByArg.set(e.toArgumentId, list);
    }
  }

  const unansweredUndercuts: FrontierUnansweredUndercut[] = [];
  for (const e of edges) {
    if (e.type !== "undercut") continue;
    // The undercut is "unanswered" if the challenger argument itself has
    // no inbound attacks.
    const challengerAttackers = attackersByArg.get(e.fromArgumentId) ?? [];
    if (challengerAttackers.length === 0) {
      unansweredUndercuts.push({
        targetArgumentId: e.toArgumentId,
        inferenceLocator: e.targetInferenceId ?? null,
        challengerArgumentId: e.fromArgumentId,
        schemeTypical: false,
        undercutTypeKey: null,
        severity: "actively-raised",
      });
    }
  }

  // Pull scheme-typical missing undercuts via MissingMoveReport.
  const missing = await computeMissingMoves(deliberationId);
  if (missing) {
    for (const argId of Object.keys(missing.perArgument)) {
      const m = missing.perArgument[argId];
      for (const u of m.missingUndercutTypes) {
        unansweredUndercuts.push({
          targetArgumentId: argId,
          inferenceLocator: null,
          challengerArgumentId: null,
          schemeTypical: true,
          undercutTypeKey: u.key,
          severity: u.severity,
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // unansweredUndermines: rebut-edges with a targetPremiseId and no
  // counter-attack against the challenger.
  // ────────────────────────────────────────────────────────────

  const unansweredUndermines: FrontierUnansweredUndermine[] = [];
  for (const e of edges) {
    if (e.type !== "rebut" || !e.targetPremiseId) continue;
    const challengerAttackers = attackersByArg.get(e.fromArgumentId) ?? [];
    if (challengerAttackers.length === 0) {
      unansweredUndermines.push({
        targetArgumentId: e.toArgumentId,
        targetPremiseId: e.targetPremiseId,
        challengerArgumentId: e.fromArgumentId,
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // unansweredCqs: any catalog CQ with status OPEN or no row at all.
  // ────────────────────────────────────────────────────────────

  const unansweredCqs: FrontierUnansweredCQ[] = [];
  for (const a of argRows) {
    const primary =
      a.argumentSchemes.find((s) => s.isPrimary) ?? a.argumentSchemes[0] ?? null;
    if (!primary?.scheme?.key) continue;
    const cqs = primary.scheme.cqs ?? [];
    for (const cq of cqs) {
      const row = cqStatuses.find(
        (s) => s.targetId === a.id && s.cqKey === cq.cqKey,
      );
      const status = row?.statusEnum ?? "OPEN";
      if (status === "OPEN" || status === "DISPUTED") {
        unansweredCqs.push({
          targetArgumentId: a.id,
          schemeKey: primary.scheme.key,
          cqKey: cq.cqKey ?? "",
          cqPrompt: cq.text,
          // Severity: every catalog CQ is treated as scheme-required when
          // the scheme defines it. A finer split (required vs recommended)
          // would come from the CriticalQuestion.burdenOfProof field; left
          // as a refinement for sprint 2.
          severity: "scheme-required",
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // terminalLeaves: arguments with no inbound attacks that sit at
  // chain-depth ≥ 1 from the main-conclusion path.
  // ────────────────────────────────────────────────────────────

  // Conclusions that no other argument premises against = "main"
  // conclusions. (Heuristic; refine post-D4.)
  const isPremiseClaim = new Set<string>();
  for (const a of argRows) {
    for (const p of a.premises) {
      if (p.claim?.id) isPremiseClaim.add(p.claim.id);
    }
  }
  const mainConclusionClaimIds = new Set<string>();
  for (const a of argRows) {
    if (a.conclusionClaimId && !isPremiseClaim.has(a.conclusionClaimId)) {
      mainConclusionClaimIds.add(a.conclusionClaimId);
    }
  }

  const terminalLeaves: FrontierTerminalLeaf[] = [];
  for (const a of argRows) {
    const attackers = attackersByArg.get(a.id) ?? [];
    if (attackers.length > 0) continue; // not a terminal leaf
    const onMainConclusionPath = a.conclusionClaimId
      ? mainConclusionClaimIds.has(a.conclusionClaimId)
      : false;
    terminalLeaves.push({
      argumentId: a.id,
      // Without a full chain reachability pass we report 0 / 1 only.
      chainDepth: onMainConclusionPath ? 0 : 1,
      onMainConclusionPath,
    });
  }

  // ────────────────────────────────────────────────────────────
  // loadBearingnessRanking: heuristic — number of arguments this one
  // supports + bonus for sitting on the main-conclusion path − inbound
  // attacks. Higher = more load-bearing.
  // ────────────────────────────────────────────────────────────

  const supportOutByArg = new Map<string, number>();
  const attackInByArg = new Map<string, number>();
  for (const e of edges) {
    if (e.type === "support") {
      supportOutByArg.set(
        e.fromArgumentId,
        (supportOutByArg.get(e.fromArgumentId) ?? 0) + 1,
      );
    } else if (e.type === "rebut" || e.type === "undercut") {
      attackInByArg.set(
        e.toArgumentId,
        (attackInByArg.get(e.toArgumentId) ?? 0) + 1,
      );
    }
  }

  const scoreById = new Map<string, number>();
  for (const a of argRows) {
    const score =
      (supportOutByArg.get(a.id) ?? 0) +
      (a.conclusionClaimId && mainConclusionClaimIds.has(a.conclusionClaimId)
        ? 2
        : 0) -
      (attackInByArg.get(a.id) ?? 0);
    scoreById.set(a.id, score);
  }

  const ranked = [...argRows].sort((a, b) => {
    const scoreA = scoreById.get(a.id) ?? 0;
    const scoreB = scoreById.get(b.id) ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Tie-break: oldest first (more time to accrete dialectical traffic).
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const loadBearingnessRanking = ranked.map((a) => a.id);
  const loadBearingnessScores: Record<string, number> = {};
  for (const [id, score] of scoreById.entries()) {
    loadBearingnessScores[id] = score;
  }

  // ────────────────────────────────────────────────────────────
  // contestednessRanking: count unanswered *actively-raised* attacks
  // per target argument and sort desc. Surfaces tested-undermined
  // material that loadBearingnessRanking (degree-based) misses.
  // ────────────────────────────────────────────────────────────
  const contestCount = new Map<string, number>();
  for (const u of unansweredUndercuts) {
    if (u.severity !== "actively-raised") continue;
    contestCount.set(
      u.targetArgumentId,
      (contestCount.get(u.targetArgumentId) ?? 0) + 1,
    );
  }
  for (const u of unansweredUndermines) {
    if (!u.challengerArgumentId) continue;
    contestCount.set(
      u.targetArgumentId,
      (contestCount.get(u.targetArgumentId) ?? 0) + 1,
    );
  }
  const contestednessRanking = [...contestCount.entries()]
    .map(([argumentId, unansweredAttackCount]) => ({
      argumentId,
      unansweredAttackCount,
    }))
    .sort((a, b) => b.unansweredAttackCount - a.unansweredAttackCount);

  // ────────────────────────────────────────────────────────────
  // Sort the per-list outputs as requested.
  // ────────────────────────────────────────────────────────────

  if (sortBy === "loadBearingness") {
    const rank = new Map(loadBearingnessRanking.map((id, i) => [id, i] as const));
    const byRank = (a: { targetArgumentId: string }, b: { targetArgumentId: string }) =>
      (rank.get(a.targetArgumentId) ?? Infinity) -
      (rank.get(b.targetArgumentId) ?? Infinity);
    unansweredUndercuts.sort(byRank);
    unansweredUndermines.sort(byRank);
    unansweredCqs.sort(byRank);
  } else if (sortBy === "severity") {
    const sev = (s: string) =>
      s === "scheme-required" ? 0 : s === "scheme-recommended" ? 1 : 2;
    unansweredUndercuts.sort((a, b) => sev(a.severity) - sev(b.severity));
    unansweredCqs.sort((a, b) => sev(a.severity) - sev(b.severity));
  }
  // recency: arguments are already pulled in insertion order; no further sort.

  // ────────────────────────────────────────────────────────────
  // minimalDisagreement: the verified T008 extractor runs only on a single
  // realized dispute chronicle (one ⊑-chain). Building that chronicle faithfully
  // from the prisma argument graph is gated work (the contested region of a real
  // deliberation is typically branching, where minimality must NOT be claimed —
  // Q-041 O2). Until that translation lands we FAIL CLOSED: leave the field null
  // so the surface keeps the honest heuristic and never overclaims "minimal".
  // ────────────────────────────────────────────────────────────
  const minimalDisagreement: MinimalDisagreement | null = null;

  return {
    deliberationId,
    unansweredUndercuts,
    unansweredUndermines,
    unansweredCqs,
    terminalLeaves,
    loadBearingnessRanking,
    contestednessRanking,
    loadBearingnessScores,
    minimalDisagreement,
  };
}
