export const dynamic = "force-dynamic";

// app/api/aif/preferences/route.ts
//
// DEPRECATED (PA_NODE_PREFERENCE_INTEGRATION_ROADMAP Phase 0.2, decision Q3).
//
// Preference (PA) creation is consolidated onto `POST /api/pa`, which
// authenticates the caller and derives `createdById` server-side. This endpoint
// previously accepted an UNAUTHENTICATED request with a client-supplied
// `createdById`, and threw a 500 on malformed input (z.parse). Rather than
// harden a redundant write path we retire it: the only in-repo caller
// (components/arguments/AttackMenuPro.tsx) now targets /api/pa.
import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated. Create preference (PA) nodes via POST /api/pa.",
      replacement: "/api/pa",
    },
    { status: 410, headers: NO_STORE },
  );
}
