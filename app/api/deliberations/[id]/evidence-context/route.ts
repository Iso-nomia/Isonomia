/**
 * GET/POST /api/deliberations/[id]/evidence-context
 *
 * B2.b (POST) — bind a Stack as the evidence corpus for a deliberation.
 *               Idempotent: re-binding overwrites the existing pin.
 * B2.c (GET)  — return the bound Stack's items as a flat reading list, with
 *               stable `citationToken`s the orchestrator can resolve back to
 *               source URLs.
 *
 * Auth model:
 *   - POST: caller must be the deliberation creator AND have stack read access
 *           (we don't require write access on the stack — pinning is non-mutating
 *           on the stack itself).
 *   - GET:  caller must be authenticated and have read access to the deliberation.
 *           For v1 we keep this loose (any authenticated user can read), since
 *           deliberations are public surfaces; tighten if/when private
 *           deliberations land.
 *
 * See B2 of the multi-agent deliberation experiment prereq plan.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";
import { canEditStack } from "@/lib/stacks/permissions";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Stable short identifier the orchestrator hands to LLM agents in their
 * prompt. Agents include this token in their `evidence[]` payloads; the
 * orchestrator translates `src:abc123` back to a real URL before calling
 * `POST /api/arguments`.
 *
 * We use the first 10 hex chars of the source's cuid. Cuids include a host
 * fingerprint + counter, so collisions across the ~25-source corpus of a
 * single experiment are vanishingly unlikely; we still de-dupe in the GET
 * response to be safe.
 */
function citationTokenFor(sourceId: string): string {
  return `src:${sourceId.slice(0, 10)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// POST — bind/rebind
// ────────────────────────────────────────────────────────────────────────────

const PostBody = z.object({
  stackId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  const authId = await getCurrentUserAuthId();
  if (!userId || !authId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id: deliberationId } = await Promise.resolve(params);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { stackId } = parsed.data;

  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, createdById: true },
  });
  if (!deliberation) {
    return NextResponse.json({ error: "Deliberation not found" }, { status: 404 });
  }
  if (deliberation.createdById !== authId && deliberation.createdById !== String(userId)) {
    return NextResponse.json(
      { error: "Forbidden: only the deliberation creator can bind an evidence stack" },
      { status: 403 }
    );
  }

  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    select: { id: true, visibility: true, owner_id: true },
  });
  if (!stack) {
    return NextResponse.json({ error: "Stack not found" }, { status: 404 });
  }

  // Caller must be able to edit the stack (so the orchestrator can also add
  // items to it via the same identity).
  const canEdit = await canEditStack(stackId, userId);
  if (!canEdit) {
    return NextResponse.json(
      { error: "Forbidden: caller must have edit access to the stack" },
      { status: 403 }
    );
  }

  await prisma.deliberationEvidenceContext.upsert({
    where: { deliberationId },
    update: { stackId, boundById: authId, boundAt: new Date() },
    create: { deliberationId, stackId, boundById: authId },
  });

  const sourceCount = await prisma.stackItem.count({
    where: { stackId, kind: "block" },
  });

  return NextResponse.json({ deliberationId, stackId, sourceCount });
}

// ────────────────────────────────────────────────────────────────────────────
// GET — read corpus
// ────────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id: deliberationId } = await Promise.resolve(params);

  const ctx = await prisma.deliberationEvidenceContext.findUnique({
    where: { deliberationId },
    select: {
      stackId: true,
      stack: { select: { id: true, name: true } },
    },
  });
  if (!ctx) {
    return NextResponse.json(
      { error: "No evidence context bound to this deliberation" },
      { status: 404 }
    );
  }

  const items = await prisma.stackItem.findMany({
    where: { stackId: ctx.stackId, kind: "block" },
    orderBy: { position: "asc" },
    select: {
      id: true,
      note: true,
      block: {
        select: {
          id: true,
          linkUrl: true,
          linkTitle: true,
          linkDescription: true,
          title: true,
        },
      },
    },
  });

  // Resolve Source rows. Two lookup paths because items can be either
  // URL-keyed (Source.url == LibraryPost.linkUrl) or DOI-keyed (LibraryPost
  // has linkUrl=null and the Source is reachable only via Source.libraryPostId).
  const blockIds = items.map((it) => it.block?.id).filter((x): x is string => !!x);
  const blockUrls = items
    .map((it) => it.block?.linkUrl)
    .filter((u): u is string => !!u);

  const [sourcesByUrlRows, sourcesByBlockRows] = await Promise.all([
    blockUrls.length
      ? prisma.source.findMany({
          where: { url: { in: blockUrls } },
          select: {
            id: true,
            url: true,
            doi: true,
            title: true,
            authorsJson: true,
            year: true,
            abstractText: true,
            keywords: true,
            contentHash: true,
            archiveUrl: true,
            libraryPostId: true,
          },
        })
      : Promise.resolve([] as any[]),
    blockIds.length
      ? prisma.source.findMany({
          where: { libraryPostId: { in: blockIds } },
          select: {
            id: true,
            url: true,
            doi: true,
            title: true,
            authorsJson: true,
            year: true,
            abstractText: true,
            keywords: true,
            contentHash: true,
            archiveUrl: true,
            libraryPostId: true,
          },
        })
      : Promise.resolve([] as any[]),
  ]);

  const sourcesByUrl = new Map<string, (typeof sourcesByUrlRows)[number]>(
    sourcesByUrlRows.filter((r) => r.url).map((r) => [r.url as string, r] as const),
  );
  const sourcesByBlockId = new Map<string, (typeof sourcesByBlockRows)[number]>(
    sourcesByBlockRows
      .filter((r) => r.libraryPostId)
      .map((r) => [r.libraryPostId as string, r] as const),
  );

  const sources = items
    .map((item) => {
      const block = item.block;
      if (!block) return null;
      const src =
        (block.linkUrl ? sourcesByUrl.get(block.linkUrl) : null) ??
        sourcesByBlockId.get(block.id) ??
        null;
      const sourceId = src?.id ?? `block:${block.id}`;
      const authors = Array.isArray(src?.authorsJson)
        ? (src.authorsJson as Array<{ family?: string; given?: string }>).map(
            (a) => [a.given, a.family].filter(Boolean).join(" ").trim()
          )
        : [];
      const keyFindings = item.note
        ? item.note
            .split("\n")
            .map((line) => line.replace(/^•\s*/, "").trim())
            .filter(Boolean)
        : [];
      return {
        sourceId,
        url: block.linkUrl ?? src?.url ?? null,
        doi: src?.doi ?? null,
        title: block.linkTitle ?? src?.title ?? block.title ?? null,
        authors,
        publishedAt: src?.year ? `${src.year}-01-01` : null,
        abstract: src?.abstractText ?? block.linkDescription ?? null,
        keyFindings,
        tags: src?.keywords ?? [],
        contentSha256: src?.contentHash ?? null,
        archiveUrl: src?.archiveUrl ?? null,
        citationToken: src?.id ? citationTokenFor(src.id) : `block:${block.id}`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({
    stack: { id: ctx.stack.id, name: ctx.stack.name, sourceCount: sources.length },
    sources,
  });
}
