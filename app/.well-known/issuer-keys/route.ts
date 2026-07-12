/**
 * GET /.well-known/issuer-keys
 *
 * Track AI-EPI Pt. 5 §2 (D.2) — public JWK Set for verifying Ed25519
 * signatures on AIF/citation attestation envelopes (`?signed=1` and
 * `?format=vc`). Includes the platform-witness key and every
 * non-revoked author key whose `notAfter` is either NULL or within the
 * verification grace window.
 *
 * Cache: public, max-age=300, stale-while-revalidate=3600. Verifiers
 * should respect ETag and re-fetch on miss.
 */
import { NextResponse } from "next/server";
import { buildPublicJwks } from "@/lib/keys/keyService";
import { canonicalize } from "@/lib/canonical/jcs";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jwks = await buildPublicJwks();
  const body = canonicalize(jwks as unknown as Record<string, unknown>);
  const etag = `"${crypto.createHash("sha256").update(body).digest("hex").slice(0, 32)}"`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/jwk-set+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      ETag: etag,
      "X-Isonomia-Signature-Policy": "ed25519-detached-jcs",
      // Verifiers (browser extension, third-party tools) fetch this cross-origin
      // to check `?signed=1` attestation signatures offline.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "ETag, X-Isonomia-Signature-Policy",
    },
  });
}
