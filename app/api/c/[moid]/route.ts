/**
 * GET /api/c/[moid]
 *
 * Track B.2 — Public claim lookup by MOID.
 *
 * Returns the claim text + supporting/attacking argument permalinks.
 * This is the read-only surface MCP's `get_claim` tool calls.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export async function GET(
  _req: NextRequest,
  { params }: { params: { moid: string } }
) {
  const moid = (params.moid || "").trim();
  if (!moid) {
    return NextResponse.json({ ok: false, error: "missing moid" }, { status: 400 });
  }

  const claim = await prisma.claim.findFirst({
    where: { moid },
    select: {
      id: true,
      text: true,
      moid: true,
      createdAt: true,
      ClaimEvidence: {
        select: {
          id: true,
          uri: true,
          title: true,
          citation: true,
          contentSha256: true,
          archivedUrl: true,
        } as any,
        take: 25,
      },
    },
  });

  if (!claim) {
    return NextResponse.json({ ok: false, error: "claim not found" }, { status: 404 });
  }

  // Arguments whose conclusion is this claim (i.e. "arguments for")
  const supportingArgs = await prisma.argument.findMany({
    where: { conclusionClaimId: claim.id },
    select: {
      id: true,
      text: true,
      createdAt: true,
      permalink: { select: { shortCode: true, version: true } },
    },
    take: 25,
    orderBy: { createdAt: "desc" },
  });

  const supporting = supportingArgs
    .filter((a) => a.permalink?.shortCode)
    .map((a) => ({
      argumentId: a.id,
      permalink: `${BASE_URL}/a/${a.permalink!.shortCode}`,
      shortCode: a.permalink!.shortCode,
      version: a.permalink!.version,
      text: a.text,
      createdAt: a.createdAt?.toISOString() ?? null,
      // Citation hop: lets a model fetch the attestation envelope (with
      // contentHash, immutable permalink, dialectical status, standingState)
      // in one extra call rather than re-resolving via /api/a/{shortCode}/aif.
      attestationUrl: `${BASE_URL}/api/a/${a.permalink!.shortCode}/aif?format=attestation`,
    }));

  return NextResponse.json(
    {
      ok: true,
      claim: {
        id: claim.id,
        moid: claim.moid,
        text: claim.text,
        createdAt: claim.createdAt?.toISOString() ?? null,
        evidence: (claim.ClaimEvidence ?? []).map((e: any) => ({
          uri: e.uri,
          title: e.title,
          citation: e.citation,
          contentSha256: e.contentSha256 ?? null,
          archivedUrl: e.archivedUrl ?? null,
        })),
      },
      arguments: {
        supporting,
        // Note: counter-arguments live as ConflictApplication / ArgumentEdge
        // rows. Surfaced separately via /api/v3/search/arguments?against=moid.
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
