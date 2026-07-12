export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { CHAIN_PAGE_INCLUDE } from "@/lib/chains/chainInclude";
import { serializeChain } from "@/lib/chains/serializeChain";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * Machine-citable representation of a public argument chain.
 *
 * `?format=jsonld` (default) → schema.org `Collection` describing the chain,
 * with one `hasPart` `CreativeWork` per node (conclusion text), `about` the
 * deliberation, and `author`. Only `isPublic` chains are exposed; a private
 * (or missing) chain returns 404 so we never leak a private chain's structure.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { identifier: string } },
) {
  const { identifier } = params;
  const format = (req.nextUrl.searchParams.get("format") || "jsonld").toLowerCase();

  const raw = await prisma.argumentChain.findUnique({
    where: { id: identifier },
    include: CHAIN_PAGE_INCLUDE,
  });

  if (!raw || !raw.isPublic) {
    return NextResponse.json(
      { error: "Chain not found" },
      { status: 404, ...NO_STORE },
    );
  }

  if (format === "aif") {
    // Deferred (spec §9). Signal not-yet-implemented rather than guessing.
    return NextResponse.json(
      { error: "AIF representation not yet available for chains" },
      { status: 406, ...NO_STORE },
    );
  }

  const chain = serializeChain(raw);
  const canonicalUrl = `${BASE_URL}/chains/${identifier}`;

  const hasPart = chain.nodes.map((node, i) => {
    const conclusionText =
      node.argument?.conclusion?.text ?? node.argument?.text ?? null;
    return {
      "@type": "CreativeWork",
      position: i + 1,
      identifier: node.id,
      ...(conclusionText ? { name: conclusionText.slice(0, 200) } : {}),
      ...(node.argument?.text ? { text: node.argument.text } : {}),
    };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Collection",
    "@id": canonicalUrl,
    url: canonicalUrl,
    name: chain.name,
    ...(chain.description ? { description: chain.description } : {}),
    dateCreated: chain.createdAt,
    dateModified: chain.updatedAt,
    ...(chain.creator?.name
      ? { author: { "@type": "Person", name: chain.creator.name } }
      : {}),
    ...(chain.deliberation
      ? {
          about: {
            "@type": "CreativeWork",
            "@id": `${BASE_URL}/deliberations/${chain.deliberation.id}`,
            name: chain.deliberation.title ?? "Deliberation",
          },
        }
      : {}),
    numberOfItems: hasPart.length,
    hasPart,
  };

  return NextResponse.json(jsonLd, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/ld+json",
    },
  });
}
