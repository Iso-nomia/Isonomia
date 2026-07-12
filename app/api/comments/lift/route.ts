export const dynamic = "force-dynamic";

// app/api/comments/lift/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { createDialogueMove } from "@/lib/ludics/createDialogueMove";
import { getCurrentUserId } from "@/lib/serverutils";
import { emitBus } from "@/lib/server/bus";
import { DeliberationHostType } from "@prisma/client";
import { onCitationCreated } from "@/lib/triggers/citationTriggers";

function normalizeHostType(input: string): DeliberationHostType {
  // happy path
  if (Object.values(DeliberationHostType).includes(input as DeliberationHostType)) {
    return input as DeliberationHostType;
  }
  // aliases
  if (input === "stack" || input === "stacks" || input === "library") {
    return DeliberationHostType.library_stack; // ← adjust if your enum literal differs
  }
  // last-resort default
  return DeliberationHostType.library_stack;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { commentId, hostType, hostId, as = "claim" } = await req.json();
    if (!commentId || !hostType || !hostId) {
      return NextResponse.json({ error: "commentId, hostType, hostId required" }, { status: 400 });
    }
    if (as !== "claim") return NextResponse.json({ error: "Unsupported lift type" }, { status: 400 });

    const hostTypeEnum = normalizeHostType(String(hostType));
    const hostIdStr = String(hostId);

    // find-or-create (works even before you add/clean the unique)
    let d = await prisma.deliberation.findFirst({
      where: { hostType: hostTypeEnum, hostId: hostIdStr },
      select: { id: true },
    });
    if (!d) {
      d = await prisma.deliberation.create({
        data: { hostType: hostTypeEnum, hostId: hostIdStr, createdById: String(userId) },
        select: { id: true },
      });
    }

    const post = await prisma.feedPost.findUnique({
      where: { id: BigInt(commentId) },
      select: { content: true },
    });
    if (!post) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const text = (post.content ?? "").trim();
    if (!text) return NextResponse.json({ error: "Cannot lift an empty comment" }, { status: 400 });

    const claim = await prisma.claim.create({
      data: {
        text: text.slice(0, 4000),
        createdById: String(userId),
        moid: `cm-${commentId}-${Date.now()}`,
        deliberationId: d.id,
      },
      select: { id: true, text: true },
    });

    const seamResult = await createDialogueMove({
      deliberationId: d.id,
      targetType: "claim",
      targetId: claim.id,
      kind: "ASSERT",
      payload: { text: claim.text, locusPath: "0" },
      actorId: String(userId),
      signature: `lift:${commentId}:${Date.now()}`,
      locusPath: "0",
    });
    const move = seamResult.move;

    // ─────────────────────────────────────────────────────────────
    // Phase 2.2: Copy citations from comment to claim
    // ─────────────────────────────────────────────────────────────
    const commentCitations = await prisma.citation.findMany({
      where: {
        targetType: "comment",
        targetId: String(commentId),
      },
      select: {
        id: true,
        sourceId: true,
        locator: true,
        quote: true,
        note: true,
        relevance: true,
        anchorType: true,
        anchorId: true,
        anchorData: true,
        createdById: true,
      },
    });

    const copiedCitations = [];
    for (const citation of commentCitations) {
      try {
        const newCitation = await prisma.citation.create({
          data: {
            targetType: "claim",
            targetId: claim.id,
            sourceId: citation.sourceId,
            locator: citation.locator,
            quote: citation.quote,
            note: citation.note,
            relevance: citation.relevance,
            anchorType: citation.anchorType,
            anchorId: citation.anchorId,
            anchorData: citation.anchorData ?? undefined,
            createdById: String(userId), // Lifter becomes creator of new citation
          },
          select: { id: true, sourceId: true },
        });
        copiedCitations.push(newCitation);
        
        // Phase 3.3: Trigger source usage aggregation for copied citation
        onCitationCreated({ id: newCitation.id, sourceId: newCitation.sourceId });
      } catch (copyErr) {
        // Skip duplicates (unique constraint) but continue
        console.warn("Citation copy skipped (likely duplicate):", copyErr);
      }
    }

    // if you've added the XRef model, you can safely enable this:
    // await prisma.xRef.create({ data: { fromType: "comment", fromId: String(commentId), toType: "claim", toId: claim.id, relation: "originates-from" } });

    emitBus("deliberations:created", { id: d.id, deliberationId: d.id, hostType: hostTypeEnum, hostId: hostIdStr, source: "lift" });
    emitBus("dialogue:moves:refresh", { moveId: move.id, deliberationId: d.id, kind: "ASSERT" });

    // Phase 2.2: Emit event for lifted citations
    if (copiedCitations.length > 0) {
      emitBus("citations:changed", {
        claimId: claim.id,
        citationCount: copiedCitations.length,
        fromCommentId: String(commentId),
        deliberationId: d.id,
      });
    }

    return NextResponse.json({ 
      deliberationId: d.id, 
      claimId: claim.id,
      citationsCopied: copiedCitations.length,
    });
  } catch (e) {
    console.error("lift error", e);
    return NextResponse.json({ error: "Lift failed" }, { status: 500 });
  }
}
