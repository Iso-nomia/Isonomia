/**
 * orchestrator/translators/topology.ts
 *
 * Materializes a `ClaimAnalystOutput` onto the live deliberation:
 *
 *   1. Mint the central (root) claim — claimType from `centralClaimType`
 *      (default CAUSAL).
 *   2. PATCH /api/deliberations/[id]/representative-claim — pin the root.
 *   3. For each sub-claim (in index order), mint a Claim with its
 *      declared `claimType`. mintClaimMoid dedup is global by stable
 *      hash, so re-runs after a partial abort reuse existing claims.
 *   4. For each sub-claim with `dependsOn`, file an edge from the
 *      *dependent* (`from`) → *depended-upon* (`to`) with type "supports".
 *      (V1 collapses presupposes/supports per Stage 2 §9 Q2.)
 *   5. For every sub-claim, file an edge sub-claim → root with type
 *      "supports" (so the graph is navigable from root).
 *
 * Returns the materialized topology + the index→claimId map. The orchestrator
 * persists this map in `PHASE_1_PARTIAL.json` and uses it as the canonical
 * stable identifier in every later phase.
 *
 * Idempotency: every step is safe to re-run.
 *   • Claims dedupe via moid (server-side).
 *   • Representative-claim PATCH is idempotent (same value → same state).
 *   • Edges upsert on (fromClaimId, toClaimId, type, attackType).
 */

import type { IsonomiaClient, IsonomiaCallContext } from "../isonomia-client";
import type { RoundLogger } from "../log/round-logger";
import type { ClaimAnalystOutput } from "../agents/claim-analyst-schema";

export interface TopologyResult {
  rootClaimId: string;
  rootClaimType: string;
  subClaims: Array<{
    index: number;
    claimId: string;
    text: string;
    claimType: string;
    layer: string;
    dependsOn: number[];
    dedup: boolean; // true if mintClaimMoid returned an existing claim
  }>;
  edges: Array<{
    from: number | "root";
    to: number | "root";
    fromClaimId: string;
    toClaimId: string;
    type: "supports";
  }>;
}

export interface TranslateOpts {
  output: ClaimAnalystOutput;
  deliberationId: string;
  iso: IsonomiaClient;
  logger: RoundLogger;
  /** Role used to sign Claim/edge writes — almost always "claim-analyst". */
  authorRole?: string;
  /** Default claimType for the central claim. Configurable per topic; for the
   *  polarization-1 experiment the central claim is causal. */
  centralClaimType?: string;
}

export async function translateClaimAnalystOutput(opts: TranslateOpts): Promise<TopologyResult> {
  const role = opts.authorRole ?? "claim-analyst";
  const ctx: IsonomiaCallContext = { role, logger: opts.logger };
  const centralClaimType = opts.centralClaimType ?? "CAUSAL";

  // 1. Root claim. We'll log dedup separately by inspecting whether the
  //    `created` flag came back false (the server returns `{ claim, created }`
  //    on dedup; our client normalizes to just the claim shape, so we
  //    rely on the dedup server log).
  const root = await opts.iso.createClaim(
    { deliberationId: opts.deliberationId, text: opts.output.centralClaim, claimType: centralClaimType },
    ctx,
  );
  opts.logger.event("round_summary", {
    step: "root-mint",
    claimId: root.id,
    claimType: centralClaimType,
    text: root.text.slice(0, 200),
  });

  // 2. Pin as representative.
  try {
    await opts.iso.setRepresentativeClaim(opts.deliberationId, root.id, ctx);
    opts.logger.event("round_summary", { step: "representative-claim-pinned", claimId: root.id });
  } catch (err) {
    // Pinning failure is non-fatal (Stage-2 fallback: rely on the gate file).
    // Log loudly but continue so the run doesn't lose all progress.
    opts.logger.event("review_flag", {
      ruleId: "topology:representative-claim-pin-failed",
      severity: "warn",
      message: `Could not pin representative claim: ${(err as Error).message}`,
      evidence: { claimId: root.id },
    });
  }

  // 3. Sub-claims, in index order.
  const idByIndex = new Map<number, string>();
  const subClaimResults: TopologyResult["subClaims"] = [];
  const ordered = [...opts.output.subClaims].sort((a, b) => a.index - b.index);
  for (const sc of ordered) {
    const minted = await opts.iso.createClaim(
      { deliberationId: opts.deliberationId, text: sc.text, claimType: sc.claimType },
      ctx,
    );
    idByIndex.set(sc.index, minted.id);
    subClaimResults.push({
      index: sc.index,
      claimId: minted.id,
      text: minted.text,
      claimType: sc.claimType,
      layer: sc.layer,
      dependsOn: sc.dependsOn,
      dedup: false, // The /api/claims response shape after our normalization
                   // doesn't surface `created`. Logged as `isonomia_call`
                   // event with full server response for forensics.
    });
    opts.logger.event("round_summary", {
      step: "sub-claim-mint",
      index: sc.index,
      claimId: minted.id,
      claimType: sc.claimType,
      layer: sc.layer,
    });
  }

  // 4. Dependency edges. Direction: dependent → depended-upon (the
  //    upstream claim "supports" the dependent's premise).
  const edges: TopologyResult["edges"] = [];
  for (const sc of ordered) {
    for (const upstream of sc.dependsOn) {
      const fromId = idByIndex.get(sc.index)!;
      const toId = idByIndex.get(upstream)!;
      await opts.iso.createClaimEdge(
        fromId,
        { toClaimId: toId, type: "supports" },
        ctx,
      );
      edges.push({ from: sc.index, to: upstream, fromClaimId: fromId, toClaimId: toId, type: "supports" });
    }
  }

  // 5. Sub-claim → root edges (every sub-claim supports the central claim).
  for (const sc of ordered) {
    const fromId = idByIndex.get(sc.index)!;
    await opts.iso.createClaimEdge(
      fromId,
      { toClaimId: root.id, type: "supports" },
      ctx,
    );
    edges.push({ from: sc.index, to: "root", fromClaimId: fromId, toClaimId: root.id, type: "supports" });
  }

  opts.logger.event("round_summary", {
    step: "topology-complete",
    subClaimCount: subClaimResults.length,
    edgeCount: edges.length,
  });

  return {
    rootClaimId: root.id,
    rootClaimType: centralClaimType,
    subClaims: subClaimResults,
    edges,
  };
}
