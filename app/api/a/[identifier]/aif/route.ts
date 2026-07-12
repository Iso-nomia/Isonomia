/**
 * GET /api/a/:identifier/aif
 *
 * Track A.1 of the AI-Epistemic-Infrastructure Roadmap — the
 * content-negotiated, machine-citable representation of an argument
 * permalink.
 *
 * Format selection (via `?format=` query, AIF is the default):
 *   - `aif`         → full AIF-JSON-LD subgraph (Walton/ARG-tech vocabulary,
 *                     includes CQs and inbound conflict/preference nodes)
 *   - `jsonld`      → rich composite Schema.org + AIF JSON-LD object
 *                     (matches the JSON-LD embedded in /a/[identifier])
 *   - `attestation` → compact attestation envelope only (no AIF graph)
 *
 * Always emits headers that let downstream caches and verifiers reason
 * about freshness without re-fetching the body:
 *   - `ETag: "<contentHash>"`
 *   - `X-Isonomia-Content-Hash`
 *   - `X-Isonomia-Permalink-Version`
 *   - `Link: <permalink>; rel="canonical", <aif>; rel="alternate"`
 */

import { NextRequest, NextResponse } from "next/server";
import { resolvePermalink } from "@/lib/citations/permalinkService";
import {
  buildArgumentAttestation,
  toAttestationSummary,
  buildSignedAttestationEnvelope,
} from "@/lib/citations/argumentAttestation";
import { buildArgumentJsonLd } from "@/lib/citations/argumentJsonLd";
import { buildAifGraphJSONLD } from "@/lib/aif/jsonld";
import { computeRoundTripSoundness } from "@/lib/aif/roundTripSoundness";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

type Format = "aif" | "jsonld" | "attestation";

function pickFormat(req: NextRequest): Format {
  const q = (req.nextUrl.searchParams.get("format") || "").toLowerCase();
  if (q === "jsonld" || q === "json-ld" || q === "rich") return "jsonld";
  if (q === "attestation" || q === "envelope") return "attestation";
  return "aif";
}

function aifContentType(format: Format) {
  if (format === "attestation") return "application/json; charset=utf-8";
  // application/ld+json is correct for both AIF and rich composite JSON-LD;
  // the AIF profile parameter signals to AIF-aware consumers what vocabulary
  // to expect.
  if (format === "aif") {
    return 'application/ld+json; profile="http://www.arg.dundee.ac.uk/aif"; charset=utf-8';
  }
  return "application/ld+json; charset=utf-8";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { identifier: string } }
) {
  const identifier = params.identifier;
  const format = pickFormat(req);

  try {
    const resolved = await resolvePermalink(identifier);
    const argumentId = resolved?.argumentId ?? identifier;

    const att = await buildArgumentAttestation(argumentId, identifier);
    if (!att) {
      return NextResponse.json(
        { ok: false, error: "Argument not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Signed envelope (Track AI-EPI Pt. 5 §1). Opt-in via `?signed=1`; the
    // default `?format=attestation` stays unsigned (roadmap Decision #5), so no
    // existing consumer changes. Signing is deliberately NOT advertised in the
    // discovery block yet — it stays internal until the revocation surface
    // (Item 3) lands. `signedAt` is fetch-time, so signed responses are
    // `no-store` and skip the contentHash ETag (a deterministic-signedAt
    // caching optimization is a follow-up).
    const wantSigned = ["1", "true", "yes"].includes(
      (req.nextUrl.searchParams.get("signed") || "").toLowerCase()
    );
    if (wantSigned) {
      let signedBody: unknown;
      try {
        signedBody = await buildSignedAttestationEnvelope(att);
      } catch (err: any) {
        return NextResponse.json(
          {
            ok: false,
            error: `Signing not configured: ${err?.message || "no signing key available"}`,
          },
          { status: 501, headers: { "Cache-Control": "no-store" } }
        );
      }
      return new NextResponse(JSON.stringify(signedBody, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Isonomia-Content-Hash": att.contentHash,
          "X-Isonomia-Permalink-Version": String(att.version),
          "X-Isonomia-Signature-Policy": "ed25519-detached-jcs",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers":
            "X-Isonomia-Content-Hash, X-Isonomia-Permalink-Version, X-Isonomia-Signature-Policy",
        },
      });
    }

    // Conditional GET support — let clients revalidate cheaply.
    const etag = `"${att.contentHash}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "X-Isonomia-Content-Hash": att.contentHash,
          "X-Isonomia-Permalink-Version": String(att.version),
        },
      });
    }

    let body: unknown;
    if (format === "jsonld") {
      body = buildArgumentJsonLd(att);
    } else if (format === "attestation") {
      body = toAttestationSummary(att);
    } else {
      const aif = await buildAifGraphJSONLD({
        argumentIds: [att.argumentId],
        includeCQs: true,
      });
      // Layer the attestation envelope on top of the AIF graph so a single
      // fetch gives both the structural graph and the citation primitive.
      body = {
        ...aif,
        "iso:attestation": toAttestationSummary(att),
        "mesh:roundTripSoundness": computeRoundTripSoundness(att, aif as any),
      };
    }

    const aifEndpoint = `${BASE_URL}/api/a/${identifier}/aif`;
    const linkHeader = [
      `<${att.permalink}>; rel="canonical"`,
      `<${aifEndpoint}?format=aif>; rel="alternate"; type="application/ld+json"; title="AIF-JSON-LD"`,
      `<${aifEndpoint}?format=jsonld>; rel="alternate"; type="application/ld+json"; title="Rich JSON-LD"`,
      `<${aifEndpoint}?format=attestation>; rel="alternate"; type="application/json"; title="Attestation envelope"`,
      `<${aifEndpoint}?format=attestation&signed=1>; rel="alternate"; type="application/json"; title="Signed attestation envelope (Ed25519/JCS)"`,
    ].join(", ");

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        "Content-Type": aifContentType(format),
        ETag: etag,
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        Vary: "Accept, Accept-Encoding",
        Link: linkHeader,
        "X-Isonomia-Content-Hash": att.contentHash,
        "X-Isonomia-Permalink-Version": String(att.version),
        "X-Isonomia-Permalink": att.permalink,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers":
          "ETag, Link, X-Isonomia-Content-Hash, X-Isonomia-Permalink-Version, X-Isonomia-Permalink",
      },
    });
  } catch (error: any) {
    console.error("[GET /api/a/[identifier]/aif] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to build AIF representation" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function HEAD(
  req: NextRequest,
  { params }: { params: { identifier: string } }
) {
  // Cheap probe: clients can `HEAD` to discover the current contentHash
  // without paying for graph assembly.
  try {
    const identifier = params.identifier;
    const resolved = await resolvePermalink(identifier);
    const argumentId = resolved?.argumentId ?? identifier;
    const att = await buildArgumentAttestation(argumentId, identifier);
    if (!att) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(null, {
      status: 200,
      headers: {
        ETag: `"${att.contentHash}"`,
        "X-Isonomia-Content-Hash": att.contentHash,
        "X-Isonomia-Permalink-Version": String(att.version),
        "X-Isonomia-Permalink": att.permalink,
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
