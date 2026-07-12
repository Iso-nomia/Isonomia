/**
 * POST /api/a/:identifier/revoke
 *
 * Track AI-EPI Pt. 5 §3 (Item 3). Revoke the signed attestation for an argument
 * at its *current* contentHash. Writes an append-only `RevokedAttestation` row
 * with a platform-witness signature over (shortCode, contentHash, reason,
 * revokedAt); the row then surfaces in `/.well-known/revoked-attestations` and
 * stamps `signature.status="revoked"` on future `?signed=1` responses.
 *
 * Auth (v1): the argument's **author** only. Platform-admin "abuse-takedown" is a
 * deliberate follow-up (needs the admin-role check), so the accepted reasons here
 * are the author-driven ones.
 *
 * Hard invariant: revocation never deletes the envelope — `?signed=1` keeps
 * serving it, flagged revoked. Append-only: re-revoking keeps the first record.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { resolvePermalink } from "@/lib/citations/permalinkService";
import { buildArgumentAttestation } from "@/lib/citations/argumentAttestation";
import { loadPlatformWitnessKey } from "@/lib/keys/keyService";
import { signRevocationRecord, type RevocationRecord } from "@/lib/citations/revocation";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

// Author-driven reasons only in v1; "abuse-takedown" is gated behind the
// (not-yet-wired) platform-admin check.
const AUTHOR_REASONS = new Set(["author-retraction", "superseded", "key-rotation"]);

export async function POST(
  req: NextRequest,
  { params }: { params: { identifier: string } },
) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason || "").trim();
  if (!AUTHOR_REASONS.has(reason)) {
    return NextResponse.json(
      { ok: false, error: `reason must be one of: ${[...AUTHOR_REASONS].join(", ")}` },
      { status: 400, headers: NO_STORE },
    );
  }

  const identifier = params.identifier;
  const resolved = await resolvePermalink(identifier);
  const argumentId = resolved?.argumentId ?? identifier;
  const att = await buildArgumentAttestation(argumentId, identifier);
  if (!att) {
    return NextResponse.json({ ok: false, error: "Argument not found" }, { status: 404, headers: NO_STORE });
  }

  // Author-only authz (v1).
  if (!att.author?.id || att.author.id !== String(userId)) {
    return NextResponse.json(
      { ok: false, error: "Only the argument's author may revoke it" },
      { status: 403, headers: NO_STORE },
    );
  }

  // Append-only: if this (shortCode, contentHash) is already revoked, keep the
  // original record and report it.
  const existing = await prisma.revokedAttestation.findUnique({
    where: { shortCode_contentHash: { shortCode: att.identifier, contentHash: att.contentHash } },
  });
  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        alreadyRevoked: true,
        revocation: {
          shortCode: existing.shortCode,
          contentHash: existing.contentHash,
          reason: existing.reason,
          revokedAt: existing.revokedAt.toISOString(),
        },
      },
      { headers: NO_STORE },
    );
  }

  const revokedAt = new Date();
  const record: RevocationRecord = {
    shortCode: att.identifier,
    contentHash: att.contentHash,
    reason,
    revokedAt: revokedAt.toISOString(),
  };

  let witnessSig: string;
  try {
    const key = await loadPlatformWitnessKey();
    witnessSig = signRevocationRecord(record, key).sig;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: `Signing not configured: ${err?.message || "no witness key"}` },
      { status: 501, headers: NO_STORE },
    );
  }

  await prisma.revokedAttestation.create({
    data: {
      shortCode: att.identifier,
      contentHash: att.contentHash,
      reason,
      revokedBy: String(userId),
      witnessSig,
      revokedAt,
    },
  });

  return NextResponse.json(
    { ok: true, revocation: record },
    { status: 201, headers: NO_STORE },
  );
}
