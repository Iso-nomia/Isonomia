// app/api/scheme-instances/[id]/state/route.ts
//
// Roadmap E2 (SCHEMES_MCP_ALIGNMENT §3) — GET /api/scheme-instances/[id]/state
//
// Projects a SchemeInstance's CQ-obligation state for read consumers (the MCP
// `get_argument` instance block and the write tool's return shape both mirror
// this). Reuses the Spec 3 close-gate evaluator for `closeHookEligible` via the
// shared `projectSchemeInstanceState` helper. Read-only; no auth beyond the
// existing scheme-read pattern.

import { NextRequest, NextResponse } from "next/server";
import { projectSchemeInstanceState } from "@/lib/schemes/protocol/instanceState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json(
      { error: "bad-request", detail: "instance id is required" },
      { status: 400 },
    );
  }

  const result = await projectSchemeInstanceState(id);
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
