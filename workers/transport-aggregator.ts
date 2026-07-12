// workers/transport-aggregator.ts
// Sprint C2 — keeps `RoomTransportSnapshot` rows fresh.
//
// Two entry points:
//   - `recomputeSnapshotForFunctor(fromRoomId, toRoomId)`: synchronous
//      recompute, called from `app/api/room-functor/transport/route.ts`
//      whenever a functor is upserted.
//   - `refreshAllSnapshots()`: periodic sweep that re-runs every active
//      functor, picking up source-side `ArgumentSupport` drift. Wired into
//      the workers bootstrap below.
//
// One-hop only (ECC plan §4 row 2). Errors per-functor are isolated so a
// single bad row does not poison the sweep.

import "dotenv/config";
import { prisma } from "@/lib/prismaclient";
import {
  computeTransportPayload,
  computeTransportHash,
  type TransportSource,
} from "@/lib/argumentation/transportAggregator";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface SourceSnapshot {
  scoresByClaim: Map<string, number>;
}

/**
 * Pull aggregate per-claim support for a deliberation, mirroring the
 * scalar reducer in `app/api/deliberations/[id]/evidential/route.ts` so
 * the imported contribution stays parity-aligned with the local payload.
 */
async function loadSourceSupport(deliberationId: string, mode: "min" | "product"): Promise<SourceSnapshot> {
  const supports = await prisma.argumentSupport.findMany({
    where: { deliberationId },
    select: { claimId: true, base: true },
  });
  const byClaim = new Map<string, number[]>();
  for (const s of supports) {
    const v = Math.max(0, Math.min(1, s.base ?? 0.6));
    const list = byClaim.get(s.claimId) ?? [];
    list.push(v);
    byClaim.set(s.claimId, list);
  }
  const out = new Map<string, number>();
  for (const [cid, xs] of byClaim) {
    const score = mode === "min"
      ? Math.max(...xs)
      : 1 - xs.reduce((a, x) => a * (1 - x), 1);
    out.set(cid, +score.toFixed(4));
  }
  return { scoresByClaim: out };
}

export async function recomputeSnapshotForFunctor(
  fromRoomId: string,
  toRoomId: string
): Promise<{ ok: true; snapshotId: string; unchanged: boolean } | { ok: false; reason: string }> {
  const functor = await prisma.roomFunctor.findFirst({
    where: { fromRoomId, toRoomId },
    select: { claimMapJson: true },
  });
  if (!functor) return { ok: false, reason: "functor-not-found" };
  const claimMap = (functor.claimMapJson && typeof functor.claimMapJson === "object")
    ? functor.claimMapJson as Record<string, string>
    : {};

  const { scoresByClaim } = await loadSourceSupport(fromRoomId, "product");
  const source: TransportSource = {
    fromRoomId,
    claimMap,
    supports: Array.from(scoresByClaim, ([claimId, score]) => ({ claimId, score })),
  };
  const hash = computeTransportHash(source);

  const existing = await prisma.roomTransportSnapshot.findUnique({
    where: { transport_snapshot_pair: { toRoomId, fromRoomId } },
    select: { id: true, claimMapHash: true },
  });
  if (existing && existing.claimMapHash === hash) {
    return { ok: true, snapshotId: existing.id, unchanged: true };
  }

  const payload = computeTransportPayload(source);
  const row = existing
    ? await prisma.roomTransportSnapshot.update({
        where: { id: existing.id },
        data: { claimMapHash: hash, payloadJson: payload as any, computedAt: new Date() },
        select: { id: true },
      })
    : await prisma.roomTransportSnapshot.create({
        data: { fromRoomId, toRoomId, claimMapHash: hash, payloadJson: payload as any },
        select: { id: true },
      });
  return { ok: true, snapshotId: row.id, unchanged: false };
}

export async function refreshAllSnapshots(): Promise<{ scanned: number; updated: number; errors: number }> {
  const functors = await prisma.roomFunctor.findMany({
    select: { fromRoomId: true, toRoomId: true },
  });
  let updated = 0;
  let errors = 0;
  for (const f of functors) {
    try {
      const r = await recomputeSnapshotForFunctor(f.fromRoomId, f.toRoomId);
      if (r.ok && !r.unchanged) updated++;
    } catch (err) {
      errors++;
      console.error(`[transport-aggregator] failed ${f.fromRoomId} → ${f.toRoomId}:`, err);
    }
  }
  return { scanned: functors.length, updated, errors };
}

// Auto-bootstrap when imported by `workers/index.ts` (ECC plan §C2).
if (process.env.WORKERS_TRANSPORT_AGGREGATOR !== "off") {
  const tick = async () => {
    try {
      const { scanned, updated, errors } = await refreshAllSnapshots();
      if (scanned > 0) {
        console.log(`[transport-aggregator] swept ${scanned} functors, updated ${updated}, errors ${errors}`);
      }
    } catch (err) {
      console.error("[transport-aggregator] sweep failed:", err);
    }
  };
  setTimeout(() => { void tick(); }, 10_000);
  setInterval(() => { void tick(); }, REFRESH_INTERVAL_MS);
}
