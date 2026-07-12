/**
 * POST /api/v3/deliberations/[id]/ecc/propose-warrant
 *
 * Sprint E1 — internal-hom write tool. Materializes a warrant claim
 * `[A,B]` (Ambler §2.4 Λ adjunction) for an existing argument, and
 * attaches it to that argument as an `AssumptionUse` row with
 * `role: "warrant"` and `status: "PROPOSED"`.
 *
 * Per ECC plan §4 row 3: warrants proposed via this endpoint are written
 * with `Argument.authorKind = "AI"` (or `"HYBRID"` when the caller
 * supplies a co-author) and `Argument.aiProvenance` records the calling
 * model. The strict `isLogical` predicate (`lib/argumentation/ecc.ts`
 * §A1.3) refuses to lift these arrows until a HUMAN explicitly ratifies
 * them. The UI surfaces this as an "AI-drafted, awaiting human
 * ratification" pill on the warrant claim.
 *
 * Auth (minimal, MCP-friendly):
 *   - When `MCP_API_TOKEN` is set on the server, an `Authorization:
 *     Bearer <MCP_API_TOKEN>` header is accepted; the createdBy/authorId
 *     fields use `MCP_AUTHOR_USER_ID` (or a documented fallback).
 *   - Otherwise falls back to cookie-based `getCurrentUserId()`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { normalizeCoordinates, writeActProvenance } from "@/lib/provenance/coordinates";
import { getCurrentUserId } from "@/lib/serverutils";
import { mintClaimMoid, canonicalizeClaimText } from "@/lib/ids/mintMoid";
import { bindParticipantToDesign, BindError } from "@/server/ludics/bindParticipantToDesign";

export const dynamic = "force-dynamic";

const ProposeWarrantSchema = z.object({
  argumentId: z.string().min(1),
  warrantText: z.string().min(1).max(2000).transform((s) => s.trim()),
  authorKind: z.enum(["AI", "HYBRID"]).optional().default("AI"),
  aiProvenance: z
    .object({
      model: z.string().optional(),
      promptHash: z.string().optional(),
      sourceUrls: z.array(z.string().url()).optional(),
      hint: z.string().optional(),
    })
    .partial()
    .optional()
    .default({}),
  /** Write-seam hook — when both fields are present, creates a WitnessRecord (I1–I4). */
  ludicMoveId: z.string().optional(),
  dialogueMoveId: z.string().optional(),
  schemeKey: z.string().optional(),
  // Per-session capability token (roadmap S1). Recorded in
  // `aiProvenance.sessionId` so the same MCP session can later
  // self-canonicalise its answers to this warrant argument's critical questions.
  sessionId: z.string().min(1).max(200).optional(),
  // N-1 (decorrelated-gating capture): raw independence coordinates of the
  // authoring agent/harness; persisted as an ActProvenance row on the warrant
  // argument and folded into aiProvenance for continuity.
  coordinates: z.any().optional(),
});

async function resolveCallerUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const expected = process.env.MCP_API_TOKEN;
  if (m && expected && m[1] === expected) {
    return process.env.MCP_AUTHOR_USER_ID || "mcp-bot";
  }
  try {
    return (await getCurrentUserId())?.toString() ?? null;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;

  const userId = await resolveCallerUserId(req);
  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "propose-warrant requires a session cookie or MCP_API_TOKEN bearer token (set MCP_API_TOKEN + MCP_AUTHOR_USER_ID on the server).",
      },
      { status: 401 },
    );
  }

  let body: z.infer<typeof ProposeWarrantSchema>;
  try {
    body = ProposeWarrantSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: `invalid body: ${err?.message ?? "parse error"}` },
      { status: 400 },
    );
  }

  // Verify the host argument belongs to this deliberation.
  const host = await prisma.argument.findUnique({
    where: { id: body.argumentId },
    select: { id: true, deliberationId: true, claimId: true },
  });
  if (!host || host.deliberationId !== deliberationId) {
    return NextResponse.json(
      { ok: false, error: "argumentId does not belong to this deliberation" },
      { status: 404 },
    );
  }

  const moid = mintClaimMoid(body.warrantText);
  const coords = normalizeCoordinates(body.coordinates);
  const aiProvenance = {
    ...body.aiProvenance,
    generatedAt: new Date().toISOString(),
    via: "mcp:propose_warrant",
    ...(body.sessionId ? { sessionId: body.sessionId } : {}),
    // N-1: continuity copy; the ActProvenance row is the queryable source.
    ...(coords ? { coordinates: coords } : {}),
  };

  const warrantClaim = await prisma.claim.upsert({
    where: { moid },
    create: {
      text: body.warrantText,
      moid,
      createdById: userId,
      deliberationId,
      // ECC plan §4 row 3 — provenance hint for the audit view.
      extractedByAI: true,
    },
    update: {},
    select: { id: true },
  });

  // Back the warrant with an AI-authored Argument so it can itself be
  // critiqued, undercut, and (eventually) ratified.
  const warrantArgument = await prisma.argument.create({
    data: {
      deliberationId,
      authorId: userId,
      text: body.warrantText,
      conclusionClaimId: warrantClaim.id,
      ...({
        authorKind: body.authorKind,
        aiProvenance,
      } as any),
    },
    select: { id: true },
  });

  // N-1: capture the author's independence coordinates on the warrant argument
  // (best-effort; the argument is already committed).
  await writeActProvenance(prisma, "argument", warrantArgument.id, {
    ...(coords ?? {}),
    authorKind: body.authorKind === "HYBRID" ? "HYBRID" : "AI",
    capturedVia: "mcp",
  });

  // Attach as an AssumptionUse on the host argument with role 'warrant'.
  // status defaults to PROPOSED — strict isLogical (§A1.3) refuses to lift
  // the host's arrow until a human ACCEPTs it.
  const use = await prisma.assumptionUse.create({
    data: {
      deliberationId,
      argumentId: host.id,
      assumptionClaimId: warrantClaim.id,
      assumptionText: body.warrantText,
      role: "warrant",
      // status defaults to PROPOSED via the schema default
    },
    select: { id: true, status: true },
  });

  // Write-seam hook: bind to LudicMove if caller provided binding context
  if (body.ludicMoveId && body.dialogueMoveId) {
    try {
      await bindParticipantToDesign({
        dialogueMoveId: body.dialogueMoveId,
        ludicMoveId: body.ludicMoveId,
        participantId: userId,
        canonicalText: canonicalizeClaimText(body.warrantText),
        schemeKey: body.schemeKey,
      });
    } catch (err) {
      if (err instanceof BindError) {
        console.warn(`[propose-warrant] bind_participant_to_design skipped: ${err.code} — ${err.message}`);
      } else {
        throw err;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    deliberationId,
    hostArgumentId: host.id,
    warrant: {
      claimId: warrantClaim.id,
      argumentId: warrantArgument.id,
      assumptionUseId: use.id,
      status: use.status,
      authorKind: body.authorKind,
      awaitingHumanRatification: true,
    },
    note:
      "Per ECC plan \u00a74 row 3, this warrant is AI-authored and is NOT logical until a human ratifies it. The host argument's `isLogical` predicate continues to read `false` for this derivation regardless of structural completeness.",
  });
}
