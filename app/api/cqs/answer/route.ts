// app/api/cqs/answer/route.ts
//
// POST /api/cqs/answer — MCP-aware critical-question answer surface for the
// `answer_critical_question` tool (Roadmap S3). Unlike the cookie-only web
// routes (responses/submit, status/canonical), this endpoint accepts the MCP
// shared-secret bearer and performs the whole upsert-CQStatus → submit →
// (conditional) self-canonical sequence in one transaction.
//
// Auth: cookie/Firebase first, then MCP bearer (resolveCitationCallerUserId +
// isMcpBearer), mirroring the quick-structured write seam.
// Rate limit: dedicated `rl:cq_answer` budget (30/h) — not shared with writes.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCitationCallerUserId } from "@/lib/citation/mcpAuth";
import { answerCriticalQuestionOverMcp } from "@/lib/cqs/answerOverMcp";
import { normalizeCoordinates } from "@/lib/provenance/coordinates";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// ─── Rate limiter ────────────────────────────────────────────────────────────
// A CQ answer is cheaper than a chain; it does NOT share the `rl:quick_arg`
// budget. 30 answers/hour per caller.
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.fixedWindow(30, "1 h"),
  prefix: "rl:cq_answer",
});

// ─── Input schema (Roadmap S3 §4.2) ──────────────────────────────────────────
const AnswerCQSchema = z.object({
  argumentId: z.string().min(1),
  cqKey: z.string().min(1),
  schemeKey: z.string().min(1).optional(),
  groundsText: z.string().min(10).max(5000),
  evidenceClaimIds: z.array(z.string()).optional().default([]),
  sourceUrls: z.array(z.string().url()).optional().default([]),
  sessionId: z.string().min(1).max(200).optional(),
  promoteToCanonical: z.boolean().optional().default(true),
  requestId: z.string().min(1).max(200).optional(),
  // N-1 (decorrelated-gating capture): raw independence coordinates of the
  // answering agent/harness. Persisted as ActProvenance on the CQResponse.
  coordinates: z.any().optional(),
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
      { error: "Rate limit exceeded — max 30 CQ answers per hour" },
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

  const parsed = AnswerCQSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await answerCriticalQuestionOverMcp({
    userId,
    ...parsed.data,
    coordinates: normalizeCoordinates(parsed.data.coordinates),
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
      responseId: result.responseId,
      responseStatus: result.responseStatus,
      canonical: result.canonical,
      cqStatusEnum: result.cqStatusEnum,
      permalink: result.permalink,
      warnings: result.warnings,
      ...(result.idempotentReplay ? { idempotentReplay: true } : {}),
    },
    { status: result.status },
  );
}
