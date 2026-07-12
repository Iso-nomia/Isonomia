export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const target = u.searchParams.get("u");
  if (!target) return NextResponse.json({ error: "u required" }, { status: 400 });

  // (Optional) restrict allowed hosts here.

  const r = await fetch(target, { redirect: "follow" });
  if (!r.ok) return NextResponse.json({ error: `fetch failed ${r.status}` }, { status: 502 });

  const ab = await r.arrayBuffer();
  const origin = req.headers.get("Origin") || "";
  return new NextResponse(Buffer.from(ab), {
    headers: {
      "Content-Type": r.headers.get("content-type") || "application/pdf",
      "Cache-Control": "no-store",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Vary": "Origin",
    },
  });
}
