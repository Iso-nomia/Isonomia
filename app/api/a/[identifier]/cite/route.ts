/**
 * GET /api/a/:identifier/cite
 *
 * Track AI-EPI E.1 — citation export endpoint.
 *
 * Renders an argument's citation in any of the six supported formats
 * (CSL-JSON / BibTeX / RIS / APA 7 / MLA 9 / Chicago 17 author-date) so
 * citation managers, scholarly tooling, and direct downloads can fetch
 * the canonical reference without parsing the page UI.
 *
 * Format selection (via `?format=`, default `csl`):
 *   - `csl` | `csljson`            → CSL-JSON   (application/vnd.citationstyles.csl+json)
 *   - `bibtex` | `bib`             → BibTeX     (application/x-bibtex)
 *   - `ris`                        → RIS        (application/x-research-info-systems)
 *   - `apa`                        → APA 7      (text/plain)
 *   - `mla`                        → MLA 9      (text/plain)
 *   - `chicago`                    → Chicago 17 (text/plain)
 *
 * Headers (mirrors the AIF endpoint so caching primitives line up):
 *   - `ETag: "<contentHash>"`        — citation derives from the same
 *                                       canonical payload as the
 *                                       attestation envelope, so the
 *                                       hash is a sufficient cache key.
 *   - `X-Isonomia-Content-Hash`
 *   - `X-Isonomia-Permalink-Version`
 *   - `X-Isonomia-Iso-Id`            — the URN identifier for this argument
 *   - `Link: <permalink>; rel="canonical"`
 *   - `Content-Disposition`           when `?download=1` is set, prompts a
 *                                     file save with the right extension.
 *
 * Conditional GET (If-None-Match) is honoured.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolvePermalink } from "@/lib/citations/permalinkService";
import { buildArgumentAttestation } from "@/lib/citations/argumentAttestation";
import {
  renderCitation,
  isCitationFormat,
  FORMAT_DESCRIPTORS,
  CITATION_FORMATS,
  type CitationFormat,
} from "@/lib/citation/formats";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

function pickFormat(req: NextRequest): CitationFormat {
  const raw = (req.nextUrl.searchParams.get("format") || "csl").toLowerCase();
  // Common aliases that don't match the canonical names.
  const aliased = raw === "csljson" || raw === "json" ? "csl" : raw === "bib" ? "bibtex" : raw;
  return isCitationFormat(aliased) ? aliased : "csl";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { identifier: string } }
) {
  const identifier = params.identifier;
  const format = pickFormat(req);
  const wantDownload = req.nextUrl.searchParams.get("download") === "1";

  try {
    const resolved = await resolvePermalink(identifier);
    const argumentId = resolved?.argumentId ?? identifier;

    const att = await buildArgumentAttestation(argumentId, identifier);
    if (!att) {
      return NextResponse.json(
        { ok: false, error: "Argument not found", availableFormats: CITATION_FORMATS },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const etag = `"${att.contentHash}::${format}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "X-Isonomia-Content-Hash": att.contentHash,
          "X-Isonomia-Permalink-Version": String(att.version),
          "X-Isonomia-Iso-Id": att.isoId,
        },
      });
    }

    const { body, contentType } = renderCitation(att, format);
    const desc = FORMAT_DESCRIPTORS[format];

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      ETag: etag,
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      Vary: "Accept",
      "X-Isonomia-Content-Hash": att.contentHash,
      "X-Isonomia-Permalink-Version": String(att.version),
      "X-Isonomia-Iso-Id": att.isoId,
      Link: `<${BASE_URL}/a/${identifier}>; rel="canonical"`,
    };

    if (wantDownload) {
      const fname = `${att.identifier}.${desc.fileExtension}`;
      headers["Content-Disposition"] = `attachment; filename="${fname}"`;
    }

    return new NextResponse(body, { status: 200, headers });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
