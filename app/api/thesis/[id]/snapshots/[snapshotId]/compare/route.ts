export const dynamic = "force-dynamic";

// app/api/thesis/[id]/snapshots/[snapshotId]/compare/route.ts
//
// Living Thesis — Phase 5.2: snapshot comparison endpoint.
//
// POST /api/thesis/[id]/snapshots/[snapshotId]/compare?against=<id|live>
//   ?against=live (default) — compare snapshot vs current live state
//   ?against=<id>           — compare snapshot vs another snapshot
//
// Response surfaces stat deltas per object (label flips, attack count Δ,
// support Δ, evidence Δ, CQ Δ), confidence Δ, and an inventory diff
// (added/removed object ids). The TipTap content diff itself is left to
// the client (ThesisSnapshotDiff) so we don't duplicate render logic.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status, ...NO_STORE });
}

interface LiveObjectStats {
  kind: string;
  label?: string;
  attackCount?: number;
  undefendedAttackCount?: number;
  defendedAttackCount?: number;
  supportCount?: number;
  evidenceCount?: number;
  cqSatisfied?: number;
  cqTotal?: number;
  lastChangedAt?: string;
}

interface StatsPayload {
  cursor?: string;
  computedAt?: string;
  objects?: Record<string, LiveObjectStats>;
}

interface ConfidencePayload {
  computedAt?: string;
  overall?: { score?: number; level?: string };
  prongs?: Array<{ id: string; title?: string | null; score?: number; level?: string }>;
}

interface ObjectDelta {
  id: string;
  kind: string | null;
  status: "added" | "removed" | "changed" | "unchanged";
  before: LiveObjectStats | null;
  after: LiveObjectStats | null;
  changes: string[];
}

async function fetchInternal(req: NextRequest, path: string): Promise<any | null> {
  try {
    const url = new URL(path, req.nextUrl.origin);
    const res = await fetch(url, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function diffObjectStats(
  before: LiveObjectStats | undefined,
  after: LiveObjectStats | undefined,
): ObjectDelta {
  const changes: string[] = [];
  const fields: (keyof LiveObjectStats)[] = [
    "label",
    "attackCount",
    "undefendedAttackCount",
    "defendedAttackCount",
    "supportCount",
    "evidenceCount",
    "cqSatisfied",
    "cqTotal",
  ];
  if (before && after) {
    for (const f of fields) {
      const a = before[f];
      const b = after[f];
      if (a !== b) {
        if (typeof a === "number" || typeof b === "number") {
          const an = (a as number) ?? 0;
          const bn = (b as number) ?? 0;
          if (an !== bn) changes.push(`${f}: ${an} → ${bn}`);
        } else if (a !== b) {
          changes.push(`${f}: ${a ?? "—"} → ${b ?? "—"}`);
        }
      }
    }
  }
  let status: ObjectDelta["status"];
  if (!before && after) status = "added";
  else if (before && !after) status = "removed";
  else if (changes.length > 0) status = "changed";
  else status = "unchanged";

  return {
    id: "", // filled by caller
    kind: (after?.kind ?? before?.kind) ?? null,
    status,
    before: before ?? null,
    after: after ?? null,
    changes,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; snapshotId: string } },
) {
  try {
    const authId = await getCurrentUserAuthId();
    if (!authId) return bad(401, "Unauthorized");

    const snapshot = await prisma.thesisSnapshot.findUnique({
      where: { id: params.snapshotId },
      select: {
        id: true,
        thesisId: true,
        label: true,
        createdAt: true,
        contentJson: true,
        statsSnapshot: true,
        confidenceSnapshot: true,
      },
    });
    if (!snapshot) return bad(404, "Snapshot not found");
    if (snapshot.thesisId !== params.id) {
      return bad(404, "Snapshot does not belong to this thesis");
    }

    const against = (req.nextUrl.searchParams.get("against") ?? "live").trim();

    // Resolve the "against" payloads.
    let againstStats: StatsPayload | null;
    let againstConfidence: ConfidencePayload | null;
    let againstMeta: { kind: "live" | "snapshot"; id?: string; label?: string | null; createdAt?: string };
    if (against === "live" || against === "") {
      againstStats = (await fetchInternal(req, `/api/thesis/${params.id}/live`)) as StatsPayload | null;
      againstConfidence = (await fetchInternal(
        req,
        `/api/thesis/${params.id}/confidence`,
      )) as ConfidencePayload | null;
      againstMeta = { kind: "live" };
    } else {
      const other = await prisma.thesisSnapshot.findUnique({
        where: { id: against },
        select: {
          id: true,
          thesisId: true,
          label: true,
          createdAt: true,
          statsSnapshot: true,
          confidenceSnapshot: true,
        },
      });
      if (!other || other.thesisId !== params.id) {
        return bad(404, "Comparison snapshot not found");
      }
      againstStats = (other.statsSnapshot ?? null) as StatsPayload | null;
      againstConfidence = (other.confidenceSnapshot ?? null) as ConfidencePayload | null;
      againstMeta = {
        kind: "snapshot",
        id: other.id,
        label: other.label,
        createdAt: other.createdAt.toISOString(),
      };
    }

    const beforeStats = (snapshot.statsSnapshot ?? null) as StatsPayload | null;
    const beforeConfidence = (snapshot.confidenceSnapshot ?? null) as ConfidencePayload | null;

    // Per-object deltas.
    const beforeObjects = beforeStats?.objects ?? {};
    const afterObjects = againstStats?.objects ?? {};
    const allIds = new Set<string>([
      ...Object.keys(beforeObjects),
      ...Object.keys(afterObjects),
    ]);

    const deltas: ObjectDelta[] = [];
    for (const id of allIds) {
      const d = diffObjectStats(beforeObjects[id], afterObjects[id]);
      d.id = id;
      deltas.push(d);
    }
    deltas.sort((a, b) => {
      const order: Record<ObjectDelta["status"], number> = {
        added: 0,
        removed: 1,
        changed: 2,
        unchanged: 3,
      };
      return order[a.status] - order[b.status];
    });

    const counts = {
      added: deltas.filter((d) => d.status === "added").length,
      removed: deltas.filter((d) => d.status === "removed").length,
      changed: deltas.filter((d) => d.status === "changed").length,
      unchanged: deltas.filter((d) => d.status === "unchanged").length,
    };

    // Confidence delta.
    const confidenceDelta = {
      before: beforeConfidence?.overall?.score ?? null,
      after: againstConfidence?.overall?.score ?? null,
      delta:
        beforeConfidence?.overall?.score != null &&
        againstConfidence?.overall?.score != null
          ? Number(
              (
                (againstConfidence.overall.score as number) -
                (beforeConfidence.overall.score as number)
              ).toFixed(4),
            )
          : null,
      prongs: (() => {
        const beforeMap = new Map(
          (beforeConfidence?.prongs ?? []).map((p) => [p.id, p] as const),
        );
        const afterMap = new Map(
          (againstConfidence?.prongs ?? []).map((p) => [p.id, p] as const),
        );
        const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
        return Array.from(ids).map((id) => {
          const b = beforeMap.get(id);
          const a = afterMap.get(id);
          return {
            id,
            title: a?.title ?? b?.title ?? null,
            before: b?.score ?? null,
            after: a?.score ?? null,
            delta:
              b?.score != null && a?.score != null
                ? Number(((a.score as number) - (b.score as number)).toFixed(4))
                : null,
          };
        });
      })(),
    };

    return NextResponse.json(
      {
        comparedAt: new Date().toISOString(),
        from: {
          kind: "snapshot",
          id: snapshot.id,
          label: snapshot.label,
          createdAt: snapshot.createdAt.toISOString(),
        },
        to: againstMeta,
        counts,
        deltas,
        confidence: confidenceDelta,
      },
      NO_STORE,
    );
  } catch (err) {
    console.error("[thesis/snapshots/compare POST] error:", err);
    return bad(500, "Internal error");
  }
}
