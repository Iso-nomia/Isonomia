export const dynamic = "force-dynamic";

// app/api/thesis/[id]/snapshots/route.ts
//
// Living Thesis — Phase 5.2: snapshot list & create endpoints.
//
// POST  /api/thesis/[id]/snapshots         (author-only) — freeze content + /live + /confidence
// GET   /api/thesis/[id]/snapshots         — list snapshots (newest first)
//
// TODO: see docs/LIVING_THESIS_DEFERRED.md D1 — auto-snapshot workers
// (publish, version bump, attack threshold). For V1 only user-triggered
// snapshots are created; auto-snapshot triggers are deferred.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { checkThesisReadable, checkThesisWritable } from "@/lib/thesis/permissions";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status, ...NO_STORE });
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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authId = await getCurrentUserAuthId();
    const gate = await checkThesisReadable(authId, params.id);
    if (!gate.ok) return bad(gate.status, gate.message);

    const snapshots = await prisma.thesisSnapshot.findMany({
      where: { thesisId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        createdAt: true,
        createdById: true,
        parentSnapshotId: true,
      },
      take: 200,
    });

    return NextResponse.json({ snapshots }, NO_STORE);
  } catch (err) {
    console.error("[thesis/snapshots GET] error:", err);
    return bad(500, "Internal error");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authId = await getCurrentUserAuthId();
    const gate = await checkThesisWritable(authId, params.id);
    if (!gate.ok) return bad(gate.status, gate.message);
    if (!authId) return bad(401, "Unauthorized");

    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true, content: true },
    });
    if (!thesis) return bad(404, "Thesis not found");

    let label: string | null = null;
    let parentSnapshotId: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.label === "string") label = body.label.slice(0, 200);
      if (typeof body?.parentSnapshotId === "string") {
        parentSnapshotId = body.parentSnapshotId;
      }
    } catch {
      // body is optional
    }

    // Freeze derived payloads (best-effort; null on failure so creation still succeeds).
    const [statsSnapshot, confidenceSnapshot, attacksSnapshot] = await Promise.all([
      fetchInternal(req, `/api/thesis/${params.id}/live`),
      fetchInternal(req, `/api/thesis/${params.id}/confidence`),
      fetchInternal(req, `/api/thesis/${params.id}/attacks?status=all`),
    ]);

    if (!statsSnapshot) {
      return bad(500, "Failed to capture live stats; snapshot aborted");
    }

    const snapshot = await prisma.thesisSnapshot.create({
      data: {
        thesisId: params.id,
        label,
        contentJson: (thesis.content ?? {}) as any,
        statsSnapshot: statsSnapshot as any,
        confidenceSnapshot: (confidenceSnapshot ?? null) as any,
        attacksSnapshot: (attacksSnapshot ?? null) as any,
        createdById: authId,
        parentSnapshotId,
      },
      select: {
        id: true,
        label: true,
        createdAt: true,
        createdById: true,
        parentSnapshotId: true,
      },
    });

    return NextResponse.json({ snapshot }, { status: 201, ...NO_STORE });
  } catch (err) {
    console.error("[thesis/snapshots POST] error:", err);
    return bad(500, "Internal error");
  }
}
