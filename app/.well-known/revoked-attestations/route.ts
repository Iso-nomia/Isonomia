/**
 * GET /.well-known/revoked-attestations
 *
 * Track AI-EPI Pt. 5 §3 (Item 3, D.5) — the append-only revocation list a
 * verifier consults after checking a `?signed=1` attestation signature. Each
 * line is `"{shortCode}@{contentHash} {reason} {revokedAt}"`; the body is
 * terminated by a single witness-signed root line
 * `"# root sig: <ed25519 over sha256(body)> kid:<keyId>"` so the list itself is
 * tamper-evident. Verify the root against `/.well-known/issuer-keys`.
 *
 * NOTE: this surface exists so `?signed=1` is safe to rely on; the signing
 * endpoint stays internal (not advertised in the discovery block) until this and
 * the revoke flow are exercised.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { loadPlatformWitnessKey } from "@/lib/keys/keyService";
import {
  revocationListBody,
  signRevocationRoot,
  type RevocationRecord,
} from "@/lib/citations/revocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.revokedAttestation.findMany({
    select: { shortCode: true, contentHash: true, reason: true, revokedAt: true },
    orderBy: { revokedAt: "asc" },
  });

  const records: RevocationRecord[] = rows.map((r) => ({
    shortCode: r.shortCode,
    contentHash: r.contentHash,
    reason: r.reason,
    revokedAt: r.revokedAt.toISOString(),
  }));

  const body = revocationListBody(records);

  // Deterministic root: sign over the list body, pinning signedAt to the latest
  // revocation (or the epoch for an empty list) so identical lists yield an
  // identical root. The platform-witness key must exist before any revoke, so
  // signedAt is always within its validity window.
  let out = body;
  try {
    const key = await loadPlatformWitnessKey();
    const signedAt =
      records.length > 0
        ? records[records.length - 1].revokedAt
        : new Date(0).toISOString();
    const { rootLine } = signRevocationRoot(body, key, signedAt);
    out = body + rootLine + "\n";
  } catch {
    // Signing not configured on this host — serve the unsigned list rather than
    // 500. A verifier that requires the root will notice its absence.
    out = body + "# root sig: unavailable (signing not configured)\n";
  }

  return new NextResponse(out, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "X-Isonomia-Signature-Policy": "ed25519-detached-jcs",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
