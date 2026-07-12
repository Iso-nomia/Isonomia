/**
 * POST /api/v3/ludics/retract-witness
 *
 * Phase 2d — manual operator retract. Fossilizes a single WitnessRecord
 * without triggering a full argument deletion.
 *
 * Auth: scoped JWT (`scripts/mintMcpToken.ts`) or session cookie.
 *
 * Request body:
 *   witnessId  string  — id of the WitnessRecord to fossilize
 *
 * Success 200 (fresh retract):
 *   { ok: true, fossilizedAt: string (ISO-8601), alreadyFossilized: false }
 *
 * Success 200 (idempotent — already fossilized):
 *   { ok: true, fossilizedAt: string (ISO-8601), alreadyFossilized: true }
 *
 * Errors:
 *   404  — witnessId not found
 *   400  — bad input shape
 *   401  — unauthenticated
 *
 * Spec: LUDICS_SESSION_2_DEV_SPEC.md §4.5 [CORRECTED post-review].
 *   - Idempotence: 409 dropped; both fresh and repeat retracts return 200 with
 *     `alreadyFossilized` distinguishing the two (resolves §4.6 incoherence).
 *   - Announcement-discipline integration (A11.3 / OQ-4): on a fresh retract
 *     the endpoint publishes a `witness_rescinded` event via the A1–A4
 *     announcement bus (`lib/ludics/announcementBus.ts`). The interim v0
 *     `console.info` dual-emit was removed in the v2.5 cutover sprint per
 *     LUDICS_ANNOUNCEMENT_BUS_PROTOCOL.md §7.0
 *     (TODO[BUS.AUDIT-CONSOLE-REMOVAL]).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { fossilize } from "@/server/ludics/witnessRecord";
import { resolveLudicsCaller, LudicsAuthError } from "@/server/ludics/auth";
import { publishAnnouncement } from "@/lib/ludics/announcementBus";

export const dynamic = "force-dynamic";

// ── Input schema ──────────────────────────────────────────────────────────────

const RetractWitnessSchema = z.object({
  witnessId: z.string().min(1),
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
      { status: 400 },
    );
  }

  const parsed = RetractWitnessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { witnessId } = parsed.data;

  // Verify existence and current state
  const witness = await prisma.witnessRecord.findUnique({
    where: { id: witnessId },
    select: {
      id: true,
      fossilizedAt: true,
      // WS-5b: lift scopeId for the announcement envelope.
      ludicMove: { select: { deliberationId: true } },
    },
  });

  if (!witness) {
    return NextResponse.json(
      { ok: false, error: `WitnessRecord "${witnessId}" not found` },
      { status: 404 },
    );
  }

  if (witness.fossilizedAt !== null) {
    // Idempotent success — spec §4.5 [CORRECTED post-review].
    // No announcement event on a repeat call: the rescission already fired
    // on the original retract (or on whatever layer event fossilized it).
    return NextResponse.json({
      ok: true,
      fossilizedAt: witness.fossilizedAt.toISOString(),
      alreadyFossilized: true,
    });
  }

  const result = await fossilize(witnessId, "manual_retract");

  // Announcement-discipline integration — spec §4.5 [ADDED post-review].
  // A11.3 / OQ-4: WS-5b A4 emit. The v0 `console.info` dual-emit was removed
  // in the v2.5 cutover sprint per LUDICS_ANNOUNCEMENT_BUS_PROTOCOL.md §7.0
  // (TODO[BUS.AUDIT-CONSOLE-REMOVAL]). Bus failures MUST NOT fail the
  // user-facing retract.
  const scopeId = witness.ludicMove?.deliberationId ?? null;
  if (scopeId) {
    try {
      await publishAnnouncement({
        eventType: "witness_rescinded",
        version: 1,
        scopeId,
        actorParticipantId: caller.callerId ?? null,
        subjectId: witnessId,
        occurredAt: result.fossilizedAt!.toISOString(),
        payload: {
          witnessId,
          retractLayer: "manual_retract",
          retractReason: "manual_retract",
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[retract-witness] announcement publish failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    fossilizedAt: result.fossilizedAt!.toISOString(),
    alreadyFossilized: false,
  });
}
