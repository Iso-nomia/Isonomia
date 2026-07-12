export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/serverutils";
import { emitBus } from "@/lib/server/bus";
import { CitationAnchorType, CitationIntent } from "@prisma/client";
import { onCitationCreated, onCitationDeleted } from "@/lib/triggers/citationTriggers";

const Attach = z.object({
  targetType: z.enum(["argument", "claim", "card", "comment", "move", "proposition"]),
  targetId: z.string().min(1),
  sourceId: z.string().min(1),
  locator: z.string().optional(),
  quote: z.string().max(280).optional(),
  note: z.string().max(500).optional(),
  relevance: z.number().min(1).max(5).optional(),
  // Phase 2.1: Anchor fields for executable references
  anchorType: z.enum(["annotation", "text_range", "timestamp", "page", "coordinates"]).optional(),
  anchorId: z.string().optional(),
  anchorData: z.record(z.unknown()).optional(),
  // Phase 2.3: Citation intent (optional - users can add later)
  intent: z.enum(["supports", "refutes", "context", "defines", "method", "background", "acknowledges", "example"]).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = Attach.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  try {
    // Phase 2.1: If anchorType is annotation, verify and auto-fill from annotation
    let finalLocator = d.locator ?? null;
    let finalQuote = d.quote ?? null;
    let finalAnchorData = d.anchorData ?? null;

    if (d.anchorType === "annotation" && d.anchorId) {
      const annotation = await prisma.annotation.findUnique({
        where: { id: d.anchorId },
        select: { id: true, page: true, rect: true, text: true },
      });

      if (!annotation) {
        return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
      }

      // Auto-fill locator and quote from annotation if not provided
      finalLocator = d.locator || `p. ${annotation.page}`;
      finalQuote = d.quote || annotation.text?.slice(0, 280);
      finalAnchorData = { page: annotation.page, rect: annotation.rect };
    }

    // Create (or fetch existing) + include source so we can enrich the bus event
    const row = await prisma.citation
      .create({
        data: {
          targetType: d.targetType,
          targetId: d.targetId,
          sourceId: d.sourceId,
          locator: finalLocator,
          quote: finalQuote,
          note: d.note ?? null,
          relevance: d.relevance ?? null,
          createdById: String(userId),
          // Phase 2.1: Anchor fields
          anchorType: d.anchorType ? (d.anchorType as CitationAnchorType) : null,
          anchorId: d.anchorId ?? null,
          anchorData: (finalAnchorData ?? undefined) as any,
          // Phase 2.3: Citation intent (optional)
          intent: d.intent ? (d.intent as CitationIntent) : null,
        },
        include: { source: true, annotation: true },
      })
      .catch(async (e: any) => {
        if (e?.code === "P2002") {
          return prisma.citation.findFirst({
            where: {
              targetType: d.targetType,
              targetId: d.targetId,
              sourceId: d.sourceId,
              locator: finalLocator,
            },
            include: { source: true, annotation: true },
          });
        }
        throw e;
      });

    if (!row) throw new Error("citation missing");

    // Best-effort: stack context + preview of the target text
    let stackId: string | null = null;
    let targetPreview: string | null = null;
    let deliberationId: string | null = null;


if (d.targetType === "claim") {
  try {
    const cl = await prisma.claim.findUnique({
      where: { id: d.targetId },
      select: { deliberationId: true },
    });
    deliberationId = cl?.deliberationId ?? null;
  } catch {}
} else if (d.targetType === "proposition") {
  try {
    const prop = await (prisma as any).proposition.findUnique({
      where: { id: d.targetId },
      select: { deliberationId: true },
    });
    deliberationId = prop?.deliberationId ?? null;
  } catch {}
} else if (d.targetType === "comment" && stackId) {
  try {
    const delib = await prisma.deliberation.findFirst({
      where: { hostId: stackId },            // optionally add hostType filter if you want
      select: { id: true },
    });
    deliberationId = delib?.id ?? null;
  } catch {}
}


    // if (d.targetType === "comment") {
    //   try {
    //     const cm = await prisma.feedPost.findUnique({
    //       where: { id: BigInt(d.targetId) },
    //       select: { content: true, parent_id: true },
    //     });
    //     const rootId = cm?.parent_id ?? BigInt(d.targetId);
    //     const root = await prisma.feedPost.findUnique({
    //       where: { id: rootId },
    //       select: { stack_id: true },
    //     });
    //     stackId = root?.stack_id ?? null;
    //     targetPreview = (cm?.content || "").replace(/\s+/g, " ").trim().slice(0, 100);
    //   } catch {}
    // } else if (d.targetType === "claim") {
    //   try {
    //     const c = await prisma.claim.findUnique({ where: { id: d.targetId }, select: { text: true } });
    //     targetPreview = (c?.text || "").replace(/\s+/g, " ").trim().slice(0, 100);
    //   } catch {}
    // }

    // Domain/kind/platform (if you store them on Source)
    const url = row.source?.url ?? null;
    const domain = (() => {
      try { return url ? new URL(url).hostname.replace(/^www\./, "") : null; }
      catch { return null; }
    })();
    const kind = (row.source as any)?.kind ?? null;        // 'pdf' | 'web' | 'dataset' | …
    const platform = (row.source as any)?.platform ?? null; // 'arxiv' | 'library' | …

    // 🔊 Rich payload for Agora
    emitBus("citations:changed", {
      action: "attached",
      targetType: d.targetType,
      targetId: d.targetId,
      stackId,
      deliberationId,             

      sourceId: row.sourceId,
      title: row.source?.title ?? null,
      url,
      domain,
      kind,
      platform,
      locator: row.locator ?? null,
      quote: row.quote ?? null,
      note: row.note ?? null,
      // Phase 2.1: Anchor fields
      anchorType: row.anchorType ?? null,
      anchorId: row.anchorId ?? null,
      anchorData: row.anchorData ?? null,
      // Phase 2.3: Citation intent
      intent: row.intent ?? null,

      targetPreview,
    });

    // Phase 3.3: Trigger source usage aggregation
    onCitationCreated({ id: row.id, sourceId: row.sourceId });

    return NextResponse.json({ citation: row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "attach failed" }, { status: 400 });
  }
}


const DelBody = z.object({ citationId: z.string().min(6) });
export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = DelBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Phase 3.3: Get sourceId before deletion for usage aggregation
  const existing = await prisma.citation.findUnique({
    where: { id: parsed.data.citationId },
    select: { id: true, sourceId: true },
  });

  const row = await prisma.citation.delete({ where: { id: parsed.data.citationId } }).catch(() => null);

  emitBus("citations:changed", { action: "deleted", citationId: parsed.data.citationId });

  // Phase 3.3: Trigger source usage aggregation
  if (existing) {
    onCitationDeleted({ id: existing.id, sourceId: existing.sourceId });
  }

  return NextResponse.json({ ok: true, deleted: !!row });
}