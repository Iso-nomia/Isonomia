// app/api/cqs/challenge/route.ts
//
// POST /api/cqs/challenge — MCP-aware critical-question CHALLENGE surface for
// the `challenge_critical_question` tool (Dev Spec §11.3). A near-clone of
// /api/cqs/answer: it lets a user (or AI agent over MCP) contest an *answered*
// critical question, materialising a scheme-free objection claim + a typed
// attack edge + a CQAttack provenance row, and flipping the CQ SATISFIED →
// DISPUTED (admissibility-gated, not defeat-gated).
//
// Auth: cookie/Firebase first, then MCP bearer (resolveCitationCallerUserId),
// mirroring the answer write seam.
// Rate limit: dedicated `rl:cq_challenge` budget (20/h) — lower than answers
// (challenges are heavier-touch).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCitationCallerUserId } from "@/lib/citation/mcpAuth";
import { challengeCriticalQuestion } from "@/lib/cqs/challengeCq";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// ─── Rate limiter ────────────────────────────────────────────────────────────
// 20 challenges/hour per caller — heavier-touch than answers (30/h).
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.fixedWindow(20, "1 h"),
  prefix: "rl:cq_challenge",
});

// ─── Input schema (Dev Spec §11.3) ───────────────────────────────────────────
const ChallengeCQSchema = z.object({
  argumentId: z.string().min(1),
  cqKey: z.string().min(1),
  schemeKey: z.string().min(1).optional(),
  attackType: z.enum(["REBUT", "UNDERMINE", "UNDERCUT"]),
  groundsText: z.string().min(10).max(5000),
  evidenceClaimIds: z.array(z.string()).optional().default([]),
  sourceUrls: z.array(z.string().url()).optional().default([]),
  requestId: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  // Auth: cookie/Firebase first, then MCP shared-secret bearer.
  const userId = await resolveCitationCallerUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit.
  const { success: withinLimit } = await ratelimit.limit(userId);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 20 CQ challenges per hour" },
      { status: 429 },
    );
  }

  // Parse body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChallengeCQSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await challengeCriticalQuestion({
    userId,
    ...parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      cqStatusId: result.cqStatusId,
      challengeClaimId: result.challengeClaimId,
      answerClaimId: result.answerClaimId,
      claimEdgeId: result.claimEdgeId,
      cqAttackId: result.cqAttackId,
      cqStatusEnum: result.cqStatusEnum,
      attackType: result.attackType,
      permalink: result.permalink,
      ...(result.idempotentReplay ? { idempotentReplay: true } : {}),
    },
    { status: result.status },
  );
}
