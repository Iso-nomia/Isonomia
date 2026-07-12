/**
 * POST /api/v3/ludics/bind-witness
 *
 * Iota write seam — creates a WitnessRecord after enforcing
 * invariants S1–S4 via the bindParticipantToDesign service.
 * (S1–S4 are the per-call spec-side gate checks, renamed post-review
 * from I1–I4 to avoid collision with Girard's substrate I1–I4 labels;
 * see bindParticipantToDesign.ts for the mapping.)
 *
 * Auth (WS-3 / v2.5): scoped JWT or session cookie.
 *   (Legacy MCP_API_TOKEN bearer fallback was removed in the v2.5 cutover.)
 *
 * Request body:
 *   dialogueMoveId  string   — id of the source DialogueMove
 *   ludicMoveId     string   — id of the target LudicMove (S1/S2)
 *   participantId   string   — participant being bound
 *   canonicalText   string   — JSON.stringify({text:…}) from canonicalizeClaimText (S3)
 *   schemeKey?      string   — ArgumentScheme.key (S4; required for daimon moves)
 *
 * Success 200:
 *   { ok: true, result: BindResult }
 *
 * Errors:
 *   409 DELOCATION_REQUIRED — ludicMoveId not found / locus absent
 *   422 CANON_GATE_FAILED   — canonicalText failed pipeline validation
 *   422 SCHEME_REQUIRED     — schemeKey invalid or required-but-absent for daimon move
 *   400                     — bad input shape
 *   401                     — unauthenticated
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  bindParticipantToDesign,
  BindError,
} from "@/server/ludics/bindParticipantToDesign";
import {
  resolveLudicsCaller,
  enforceTokenScope,
  LudicsAuthError,
} from "@/server/ludics/auth";

export const dynamic = "force-dynamic";

// ── Input schema ──────────────────────────────────────────────────────────────

const BindWitnessSchema = z.object({
  dialogueMoveId: z.string().min(1),
  ludicMoveId: z.string().min(1),
  participantId: z.string().min(1),
  canonicalText: z.string().min(1),
  schemeKey: z.string().optional(),
  /** Phase 2d: optional argumentId back-reference stored on LudicMove. */
  argumentId: z.string().optional(),
  /**
   * WS-3: optional deliberationId for explicit JWT scope assertion. When the
   * caller authenticated via scoped JWT and this field is present, the
   * token's scope.deliberationId must match. The bindParticipantToDesign
   * service still derives the canonical deliberationId from ludicMoveId.
   */
  deliberationId: z.string().optional(),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = BindWitnessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // WS-3: optional explicit JWT scope assertion against body.deliberationId.
  if (parsed.data.deliberationId) {
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
  }

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await bindParticipantToDesign({ ...parsed.data, ip });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof BindError) {
      const headers: Record<string, string> = {};
      if (err.code === "RATE_LIMITED" && typeof err.retryAfter === "number") {
        headers["Retry-After"] = String(err.retryAfter);
      }
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          code: err.code,
          ...(err.code === "RATE_LIMITED" && typeof err.retryAfter === "number"
            ? { retryAfter: err.retryAfter }
            : {}),
        },
        { status: err.status, headers }
      );
    }
    // Unique constraint: this dialogueMoveId was already witnessed
    if (
      typeof (err as any)?.code === "string" &&
      (err as any).code === "P2002"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "dialogueMoveId already has a WitnessRecord — each dialogue move may only witness once",
          code: "ALREADY_WITNESSED",
        },
        { status: 409 }
      );
    }
    console.error("[bind-witness] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
