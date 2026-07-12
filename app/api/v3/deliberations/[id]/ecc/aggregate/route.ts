/**
 * GET /api/v3/deliberations/[id]/ecc/aggregate?claimId=...&mode=min|product|logodds
 *
 * Sprint E1 — `aggregateAcrossRooms` projection: returns the
 * `{ local, imported, total }` band for one claim by combining its
 * local confidence with every cached `RoomTransportSnapshot` payload
 * landing on it.
 *
 * Closed-enum mode (ECC plan §4 row 5). DS-mode aggregation is not
 * supported here — the cached snapshots carry scalar imported scores
 * computed under the reducer; DS would need its own cached payload shape,
 * which is out of scope for Sprint E.
 *
 * Phase 5b (2026-06-03): default mode is now `"logodds"`; imported support is
 * folded as log-odds corroboration (transportAggregator handles the per-mode
 * join). `product` stays selectable until the bake-in window closes.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  combineLocalAndImported,
  reduceImportedScores,
  reduceImportedByOrigin,
  type TransportSnapshotPayload,
} from "@/lib/argumentation/transportAggregator";
import { evaluateConfidence, loadClaimArrow, type Mode } from "@/lib/argumentation/eccLoader";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<Mode>(["min", "product", "logodds"]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;
  const url = new URL(req.url);
  const claimId = url.searchParams.get("claimId");
  const mode = (url.searchParams.get("mode") ?? "logodds").toLowerCase() as Mode;
  if (!claimId) {
    return NextResponse.json(
      { ok: false, error: "claimId query parameter is required" },
      { status: 400 },
    );
  }
  if (!ALLOWED.has(mode)) {
    return NextResponse.json(
      { ok: false, error: "mode must be one of: min, product, logodds (ds aggregation not cached)" },
      { status: 400 },
    );
  }

  const loaded = await loadClaimArrow(deliberationId, claimId);
  const localValue =
    loaded ? (evaluateConfidence(loaded, mode) as number | null) : null;

  const snaps = await prisma.roomTransportSnapshot.findMany({
    where: { toRoomId: deliberationId },
    select: { fromRoomId: true, payloadJson: true },
  });

  const importedContributions: Array<{ fromRoomId: string; score: number }> = [];
  // Origin-keyed atoms across ALL snapshots landing on this claim. The `imported`
  // scalar is reduced by ultimate transport origin (T010 L2 origin-dedupe), so a
  // source reaching this claim by two paths corroborates ONCE rather than stacking.
  // Back-compat: snapshots written before `originId` existed fall back to the
  // immediate predecessor `fromClaimId` (one-hop: they are equal, so this is
  // behaviour-neutral under the current one-hop cap — see reduceImportedByOrigin P5).
  const originAtoms: Array<{ originId: string; score: number }> = [];
  for (const s of snaps) {
    const payload = s.payloadJson as TransportSnapshotPayload | null;
    const slot = payload?.byClaim?.[claimId];
    if (!slot?.sources?.length) continue;
    for (const src of slot.sources) {
      originAtoms.push({ originId: src.originId ?? src.fromClaimId, score: src.score });
    }
    // Per-room breakdown retained for the response's display field only.
    const sourceScores = slot.sources.map((src) => src.score);
    importedContributions.push({
      fromRoomId: s.fromRoomId,
      score: reduceImportedScores(sourceScores, mode),
    });
  }

  const imported = reduceImportedByOrigin(originAtoms, mode);
  const local = localValue ?? 0;
  const total = combineLocalAndImported(local, imported, mode);

  return NextResponse.json({
    ok: true,
    deliberationId,
    claimId,
    mode,
    band: { local, imported, total },
    importedContributions,
    note:
      "One-hop transport only (ECC plan \u00a74 row 2). The `imported` value is computed from cached `RoomTransportSnapshot` rows produced by `workers/transport-aggregator.ts`, deduped by ultimate transport origin (T010 L2) so a source reaching this claim by multiple paths corroborates once.",
  });
}
