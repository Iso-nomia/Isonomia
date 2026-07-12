export const dynamic = "force-dynamic";

/**
 * Widget Embed Code Generator API
 *
 * Generates embed codes for stacks, evidence lists, sources, and health badges.
 * Returns iframe, script, and oEmbed URLs.
 *
 * @route GET /api/widgets/embed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";

type WidgetType = "stack" | "evidence" | "source" | "health" | "argument" | "claim";
type Theme = "light" | "dark" | "auto";

interface EmbedResponse {
  widgetUrl: string;
  embedCodes: {
    iframe: string;
    script: string;
    oembed: string;
  };
  preview: string;
  metadata: {
    title: string;
    description?: string;
    itemCount?: number;
  };
}

const DEFAULT_HEIGHTS: Record<WidgetType, number> = {
  stack: 400,
  evidence: 500,
  source: 150,
  health: 60,
  argument: 400,
  claim: 280,
};

const DEFAULT_WIDTHS: Record<WidgetType, number> = {
  stack: 600,
  evidence: 500,
  source: 400,
  health: 150,
  argument: 600,
  claim: 600,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const widgetType = searchParams.get("type") as WidgetType | null;
  const targetId = searchParams.get("id");
  const theme = (searchParams.get("theme") || "auto") as Theme;
  const width = searchParams.get("width")
    ? parseInt(searchParams.get("width")!, 10)
    : undefined;
  const compact = searchParams.get("compact") === "true";

  if (!widgetType || !["stack", "evidence", "source", "health", "argument", "claim"].includes(widgetType)) {
    return NextResponse.json(
      { error: "Valid type required: stack, evidence, source, health, argument, or claim" },
      { status: 400 }
    );
  }

  if (!targetId) {
    return NextResponse.json(
      { error: "id parameter required" },
      { status: 400 }
    );
  }

  // Verify target exists and is public
  const accessCheck = await verifyPublicAccess(widgetType, targetId);
  if (!accessCheck.allowed) {
    return NextResponse.json(
      { error: "Target not found or not public" },
      { status: 404 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";
  const widgetUrl = `${baseUrl}/embed/${widgetType}/${targetId}`;

  // Build query params for the embed
  const params = new URLSearchParams();
  if (theme !== "auto") params.set("theme", theme);
  if (width) params.set("width", String(width));
  if (compact) params.set("compact", "true");

  const fullUrl = params.toString() ? `${widgetUrl}?${params}` : widgetUrl;

  // Generate embed codes
  const w = width || DEFAULT_WIDTHS[widgetType];
  const h = DEFAULT_HEIGHTS[widgetType];

  const iframeCode = generateIframeCode(fullUrl, widgetType, w, h);
  const scriptCode = generateScriptCode(targetId, widgetType, theme, compact);
  const oembedUrl = `${baseUrl}/api/oembed?url=${encodeURIComponent(fullUrl)}`;

  const response: EmbedResponse = {
    widgetUrl: fullUrl,
    embedCodes: {
      iframe: iframeCode,
      script: scriptCode,
      oembed: oembedUrl,
    },
    preview: `${fullUrl}&preview=true`,
    metadata: accessCheck.metadata,
  };

  return NextResponse.json(response);
}

async function verifyPublicAccess(
  widgetType: WidgetType,
  targetId: string
): Promise<{ allowed: boolean; metadata: { title: string; description?: string; itemCount?: number } }> {
  switch (widgetType) {
    case "stack": {
      const stack = await prisma.stack.findUnique({
        where: { id: targetId },
        select: {
          name: true,
          description: true,
          visibility: true,
          _count: { select: { items: true } },
        },
      });

      if (!stack) {
        return { allowed: false, metadata: { title: "" } };
      }

      const isPublic = stack.visibility === "public_open" ||
                       stack.visibility === "public_closed" ||
                       stack.visibility === "unlisted";

      return {
        allowed: isPublic,
        metadata: {
          title: stack.name,
          description: stack.description || undefined,
          itemCount: stack._count.items,
        },
      };
    }

    case "source": {
      const source = await prisma.source.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          title: true,
          container: true,
        },
      });

      if (!source) {
        return { allowed: false, metadata: { title: "" } };
      }

      // Sources are always embeddable (they're references)
      return {
        allowed: true,
        metadata: {
          title: source.title || "Untitled Source",
          description: source.container || undefined,
        },
      };
    }

    case "evidence": {
      // Evidence embeds need citations to exist for the target
      const citationCount = await prisma.citation.count({
        where: { targetId },
      });

      if (citationCount === 0) {
        return { allowed: false, metadata: { title: "" } };
      }

      return {
        allowed: true,
        metadata: {
          title: "Evidence",
          itemCount: citationCount,
        },
      };
    }

    case "health": {
      // Health badges are for deliberations
      const deliberation = await prisma.deliberation.findUnique({
        where: { id: targetId },
        select: { id: true, title: true },
      });

      if (!deliberation) {
        return { allowed: false, metadata: { title: "" } };
      }

      return {
        allowed: true,
        metadata: {
          title: resolveDeliberationName(deliberation, { fallback: "Deliberation" }),
        },
      };
    }

    case "argument": {
      // targetId is the ArgumentPermalink shortCode
      const permalink = await prisma.argumentPermalink.findFirst({
        where: { OR: [{ shortCode: targetId }, { slug: targetId }] },
        select: {
          argumentId: true,
          argument: {
            select: {
              text: true,
              conclusion: { select: { text: true } },
            },
          },
        },
      });

      if (!permalink) {
        return { allowed: false, metadata: { title: "" } };
      }

      const { argument } = permalink;
      const title = argument.conclusion?.text
        ? argument.conclusion.text.slice(0, 80)
        : argument.text.slice(0, 80);

      return {
        allowed: true,
        metadata: {
          title,
          description: argument.text.slice(0, 200),
        },
      };
    }

    case "claim": {
      // targetId is the claim moid
      const claim = await prisma.claim.findUnique({
        where: { moid: targetId },
        select: { text: true, moid: true },
      });

      if (!claim) {
        return { allowed: false, metadata: { title: "" } };
      }

      return {
        allowed: true,
        metadata: {
          title: claim.text.slice(0, 80),
          description: claim.text.slice(0, 200),
        },
      };
    }

    default:
      return { allowed: false, metadata: { title: "" } };
  }
}

function generateIframeCode(
  url: string,
  type: WidgetType,
  width: number,
  height: number
): string {
  return `<iframe
  src="${url}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="Mesh ${type} widget"
  loading="lazy"
></iframe>`;
}

function generateScriptCode(
  id: string,
  type: WidgetType,
  theme: Theme,
  compact: boolean
): string {
  const dataAttrs = [
    `data-mesh-type="${type}"`,
    `data-mesh-id="${id}"`,
  ];

  if (theme !== "auto") {
    dataAttrs.push(`data-mesh-theme="${theme}"`);
  }
  if (compact) {
    dataAttrs.push(`data-mesh-compact="true"`);
  }

  return `<div class="mesh-widget" ${dataAttrs.join(" ")}></div>
<script src="https://mesh.app/embed.js" async></script>`;
}
