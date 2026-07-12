export const dynamic = "force-dynamic";

// app/api/aif/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { importAifJSONLD } from "@/packages/aif-core/src/import";
import { checkAifVersionStamp } from "@/lib/aif/version";
export async function POST(req: NextRequest) {
  const { deliberationId, graph } = await req.json().catch(()=>({}));
  if (!deliberationId || !graph) return NextResponse.json({ ok:false, error:'missing deliberationId/graph' }, { status:400 });
  // Q-023 version pin: import path NEVER accepts unstamped documents.
  const stampCheck = checkAifVersionStamp(graph, /* allowUnstamped */ false);
  if (!stampCheck.ok) {
    return NextResponse.json(
      { ok: false, error: stampCheck.code, message: stampCheck.message, expected: stampCheck.expected, got: stampCheck.got },
      { status: 422 },
    );
  }
  const res = await importAifJSONLD(deliberationId, graph);
  return NextResponse.json(res, { status: 201 });
}
