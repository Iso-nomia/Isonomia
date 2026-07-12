export const dynamic = "force-dynamic";

// app/api/challenge/decline/route.ts
//
// N-3 (decorrelated-gating capture): record that an agent was exposed to an
// argument/claim and DECLINED to challenge it. Challenger silence leaves no
// trace by default, so the "assigned-but-didn't-attack" denominator that R-C
// needs is unreconstructable unless captured here at write time. This route is
// the explicit decline signal; without it the denominator never materialises.
//
// It writes a single CONTEST/DECLINED CheckExposure and nothing else — it does
// NOT touch the argument graph, standing, or commitments. Declining is not a
// dialogue move; it is a provenance fact about coverage.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  resolveCitationCallerUserId,
  isMcpBearer,
  namespaceForSpeakAs,
} from "@/lib/citation/mcpAuth";
import { normalizeCoordinates, writeCheckExposure } from "@/lib/provenance/coordinates";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const DeclineSchema = z.object({
  deliberationId: z.string().min(1).optional(),
  subjectType: z.enum(["argument", "claim", "dialogue_move"]),
  subjectId: z.string().min(1),
  declineReason: z.string().max(2000).optional(),
  speakAs: z.string().min(1).max(64).optional(),
  // N-1: raw independence coordinates of the declining challenger.
  coordinates: z.any().optional(),
});

export async function POST(req: NextRequest) {
  const baseUserId = await resolveCitationCallerUserId(req);
  if (!baseUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
  }

  const parsed = DeclineSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, ...NO_STORE },
    );
  }
  const d = parsed.data;

  const mcp = isMcpBearer(req);
  const userId = namespaceForSpeakAs({
    isMcpBearer: mcp,
    baseUserId,
    speakAs: d.speakAs,
  });

  await writeCheckExposure(prisma, {
    deliberationId: d.deliberationId ?? null,
    subjectType: d.subjectType,
    subjectId: d.subjectId,
    lane: "CONTEST",
    outcome: "DECLINED",
    agentId: String(userId),
    coords: {
      ...(normalizeCoordinates(d.coordinates) ?? {}),
      capturedVia: mcp ? "mcp" : "ui",
    },
    declineReason: d.declineReason ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 200, ...NO_STORE });
}
