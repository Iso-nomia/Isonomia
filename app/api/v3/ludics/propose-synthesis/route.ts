/**
 * POST /api/v3/ludics/propose-synthesis
 *
 * Phase 2c write seam — computes the articulation join of two Design rows
 * within a behaviour's incarnation lattice. Returns a discriminated result
 * (`same-cone-join` | `same-cone-delocation-required` | `cross-cone-rejected`)
 * per LUDICS_SESSION_2_DEV_SPEC.md §3.3.
 *
 * Auth (WS-3 / v2.5): scoped JWT or session cookie.
 *   (Legacy MCP_API_TOKEN bearer fallback was removed in the v2.5 cutover.)
 *
 * Request body:
 *   deliberationId  string          — id of the deliberation
 *   designIds       [string,string] — pair of Design row ids to join
 *   canonicalText   string (≥1)     — synthesis statement text
 *
 * Success 200 (always — the three substrate outcomes are returned as values):
 *   { ok: true, result: SynthesisProposalResult }
 *     where result.kind is one of:
 *       "same-cone-join"               — WitnessRecord committed
 *       "same-cone-delocation-required" — within-cone negative-branch
 *                                        extension required; no WitnessRecord
 *       "cross-cone-rejected"          — inputs span disjoint cones; ∨_⊥⊥
 *                                        undefined in B (Phase 2e)
 *
 * Errors (true error conditions only):
 *   409 ROOT_LOCUS_MISSING       — root locus ⊢A.0 absent from D_P
 *   422 EMPTY_CANONICAL_TEXT     — canonicalText is blank
 *   422 CLOSURE_STEPS_INVARIANT  — articulationLattice returned closureSteps != 0
 *   404 DESIGNS_NOT_FOUND        — one or both designIds missing
 *   400                          — bad input shape
 *   401                          — unauthenticated
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  proposeSynthesis,
  SynthesisError,
} from "@/server/ludics/synthesisProposalAgent";
import { compoundRateLimit } from "@/lib/rateLimit";
import {
  resolveLudicsCaller,
  enforceTokenScope,
  LudicsAuthError,
} from "@/server/ludics/auth";

export const dynamic = "force-dynamic";

// ── Input schema ──────────────────────────────────────────────────────────────

const ProposeSynthesisSchema = z.object({
  deliberationId: z.string().min(1),
  designIds: z.tuple([z.string().min(1), z.string().min(1)]),
  canonicalText: z.string().min(1).max(2000),
});

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let caller;
  try {
    caller = await resolveLudicsCaller(request);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const callerId = caller.callerId;

  // ── Phase 2f §6.1 (B11 v2 / WS-2) compound rate limit ──────────────────────
  // Scope = deliberationId (per WS-0 tenant-scope audit, 2026-05-22 — repo
  // has no tenant axis). Bucket 1: (scope, participant, "propose_synthesis").
  // Bucket 2: (scope, ip, "propose_synthesis") when IP supplied. Either
  // exhausted ⇒ 429 with Retry-After.

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = ProposeSynthesisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // WS-3: enforce JWT scope against body deliberationId.
  try {
    enforceTokenScope(caller, parsed.data.deliberationId);
  } catch (err) {
    if (err instanceof LudicsAuthError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    throw err;
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rl = await compoundRateLimit(
    {
      scopeId: parsed.data.deliberationId,
      participantId: callerId,
      ip,
      action: "propose_synthesis",
    },
    {
      perParticipant: { max: 10, window: "1 m" },
      perIp:          { max: 30, window: "1 m" },
    },
  );
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", code: "RATE_LIMITED", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const result = await proposeSynthesis({
      ...parsed.data,
      participantId: callerId,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof SynthesisError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("[propose-synthesis] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
