export const dynamic = "force-dynamic";

/**
 * oEmbed Endpoint
 *
 * Implements oEmbed 1.0 spec for rich preview discovery.
 * Supports stacks, evidence lists, and sources.
 *
 * @route GET /api/oembed
 * @see https://oembed.com/
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";

interface OEmbedResponse {
  type: "rich";
  version: "1.0";
  title: string;
  author_name?: string;
  author_url?: string;
  provider_name: string;
  provider_url: string;
  cache_age?: number;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html: string;
  width: number;
  height: number;
}

const PROVIDER_NAME = "Mesh";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const url = searchParams.get("url");
  const format = searchParams.get("format") || "json";
  const maxWidth = searchParams.get("maxwidth")
    ? parseInt(searchParams.get("maxwidth")!, 10)
    : 600;
  const maxHeight = searchParams.get("maxheight")
    ? parseInt(searchParams.get("maxheight")!, 10)
    : 400;

  if (!url) {
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 }
    );
  }

  if (format !== "json") {
    return NextResponse.json(
      { error: "Only JSON format is supported" },
      { status: 501 }
    );
  }

  // Parse the URL to determine widget type and ID
  const parsed = parseEmbedUrl(url);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid or unsupported URL" },
      { status: 404 }
    );
  }

  const { type, id, theme, compact } = parsed;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

  // Fetch metadata based on type
  const metadata = await getMetadata(type, id);
  if (!metadata) {
    return NextResponse.json(
      { error: "Resource not found or not public" },
      { status: 404 }
    );
  }

  // Calculate dimensions
  const { width, height } = calculateDimensions(type, maxWidth, maxHeight);

  // Build embed URL with any passed-through params
  const embedParams = new URLSearchParams();
  if (theme) embedParams.set("theme", theme);
  if (compact) embedParams.set("compact", "true");

  const embedUrl = `${baseUrl}/embed/${type}/${id}${embedParams.toString() ? "?" + embedParams : ""}`;

  // Build iframe HTML
  const iframeHtml = `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;" title="${escapeHtml(metadata.title)}" loading="lazy"></iframe>`;

  const response: OEmbedResponse = {
    type: "rich",
    version: "1.0",
    title: metadata.title,
    provider_name: PROVIDER_NAME,
    provider_url: baseUrl,
    cache_age: 3600, // 1 hour
    html: iframeHtml,
    width,
    height,
  };

  if (metadata.authorName) {
    response.author_name = metadata.authorName;
    if (metadata.authorUrl) {
      response.author_url = metadata.authorUrl;
    }
  }

  if (metadata.thumbnailUrl) {
    response.thumbnail_url = metadata.thumbnailUrl;
    response.thumbnail_width = 1200;
    response.thumbnail_height = 630;
  }

  // Add oEmbed discovery headers
  const headers = new Headers();
  headers.set("Content-Type", "application/json+oembed");
  headers.set("Cache-Control", "public, max-age=3600");

  return NextResponse.json(response, { headers });
}

interface ParsedUrl {
  type: "stack" | "evidence" | "source" | "health" | "argument" | "claim";
  id: string;
  theme?: string;
  compact?: boolean;
}

function parseEmbedUrl(url: string): ParsedUrl | null {
  try {
    const parsed = new URL(url);

    // Match /embed/{type}/{id} pattern
    const embedMatch = parsed.pathname.match(
      /\/embed\/(stack|evidence|source|health|argument|claim)\/([^\/\?]+)/
    );

    if (embedMatch) {
      return {
        type: embedMatch[1] as ParsedUrl["type"],
        id: embedMatch[2],
        theme: parsed.searchParams.get("theme") || undefined,
        compact: parsed.searchParams.get("compact") === "true",
      };
    }

    // Also match direct resource URLs like /stacks/{id}
    const stackMatch = parsed.pathname.match(/\/stacks\/([^\/\?]+)/);
    if (stackMatch) {
      return {
        type: "stack",
        id: stackMatch[1],
      };
    }

    const sourceMatch = parsed.pathname.match(/\/sources\/([^\/\?]+)/);
    if (sourceMatch) {
      return {
        type: "source",
        id: sourceMatch[1],
      };
    }

    // Match /a/{shortCode} (argument permalink pages)
    const argPageMatch = parsed.pathname.match(/^\/a\/([^\/\?]+)$/);
    if (argPageMatch) {
      return {
        type: "argument",
        id: argPageMatch[1],
        theme: parsed.searchParams.get("theme") || undefined,
        compact: parsed.searchParams.get("compact") === "true",
      };
    }

    // Match /c/{moid} (claim permalink pages)
    const claimPageMatch = parsed.pathname.match(/^\/c\/([^\/\?]+)$/);
    if (claimPageMatch) {
      return {
        type: "claim",
        id: claimPageMatch[1],
        theme: parsed.searchParams.get("theme") || undefined,
        compact: parsed.searchParams.get("compact") === "true",
      };
    }

    return null;
  } catch {
    return null;
  }
}

interface Metadata {
  title: string;
  description?: string;
  authorName?: string;
  authorUrl?: string;
  itemCount?: number;
  thumbnailUrl?: string;
}

async function getMetadata(
  type: string,
  id: string
): Promise<Metadata | null> {
  switch (type) {
    case "stack": {
      const stack = await prisma.stack.findUnique({
        where: { id },
        select: {
          name: true,
          description: true,
          visibility: true,
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          _count: { select: { items: true } },
        },
      });

      if (!stack) return null;

      const isPublic =
        stack.visibility === "public_open" ||
        stack.visibility === "public_closed" ||
        stack.visibility === "unlisted";

      if (!isPublic) return null;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

      return {
        title: stack.name,
        description: stack.description || undefined,
        authorName: stack.owner.name || stack.owner.username || undefined,
        authorUrl: stack.owner.id ? `${baseUrl}/profile/${stack.owner.id.toString()}` : undefined,
        itemCount: stack._count.items,
      };
    }

    case "source": {
      const source = await prisma.source.findUnique({
        where: { id },
        select: {
          title: true,
          authorsJson: true,
          container: true,
        },
      });

      if (!source) return null;

      // Parse authorsJson for author_name
      let authorName: string | undefined;
      if (source.authorsJson) {
        try {
          const parsed = source.authorsJson as unknown[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = parsed[0];
            authorName = typeof first === "string" ? first : (first as { name?: string; given?: string; family?: string }).name || undefined;
          }
        } catch {
          // authorsJson was not parseable; skip author
        }
      }

      return {
        title: source.title || "Untitled Source",
        description: source.container || undefined,
        authorName,
      };
    }

    case "evidence": {
      const count = await prisma.citation.count({
        where: { targetId: id },
      });

      if (count === 0) return null;

      return {
        title: `Evidence (${count} citations)`,
        itemCount: count,
      };
    }

    case "health": {
      const deliberation = await prisma.deliberation.findUnique({
        where: { id },
        select: { title: true },
      });

      if (!deliberation) return null;

      return {
        title: resolveDeliberationName(deliberation, { fallback: "Deliberation Health" }),
      };
    }

    case "argument": {
      // id is the ArgumentPermalink shortCode or slug
      const permalink = await prisma.argumentPermalink.findFirst({
        where: { OR: [{ shortCode: id }, { slug: id }] },
        select: {
          argumentId: true,
          argument: {
            select: {
              text: true,
              conclusion: { select: { text: true } },
              deliberation: { select: { title: true } },
            },
          },
        },
      });

      if (!permalink) return null;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";
      const { argument } = permalink;
      const title = argument.conclusion?.text
        ? argument.conclusion.text.slice(0, 100)
        : argument.text.slice(0, 100);

      return {
        title,
        description: argument.text.slice(0, 200),
        thumbnailUrl: `${baseUrl}/api/og/argument/${id}`,
      };
    }

    case "claim": {
      // id is the claim moid
      const claim = await prisma.claim.findUnique({
        where: { moid: id },
        select: { text: true, moid: true },
      });

      if (!claim) return null;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

      return {
        title: claim.text.slice(0, 100),
        description: claim.text.slice(0, 200),
        thumbnailUrl: `${baseUrl}/api/og/claim/${id}`,
      };
    }

    default:
      return null;
  }
}

function calculateDimensions(
  type: string,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const defaults: Record<string, { width: number; height: number }> = {
    stack: { width: 600, height: 400 },
    evidence: { width: 500, height: 500 },
    source: { width: 400, height: 150 },
    health: { width: 150, height: 60 },
    argument: { width: 600, height: 400 },
    claim: { width: 600, height: 280 },
  };

  const { width: defWidth, height: defHeight } = defaults[type] || {
    width: 400,
    height: 300,
  };

  return {
    width: Math.min(defWidth, maxWidth),
    height: Math.min(defHeight, maxHeight),
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
