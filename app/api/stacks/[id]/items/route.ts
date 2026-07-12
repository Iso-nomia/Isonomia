/**
 * POST /api/stacks/[id]/items
 *
 * Add an evidence item (URL or DOI) to a Stack. Used by the multi-agent
 * deliberation experiment orchestrator (B2.a) to pre-seed the evidence
 * corpus for a deliberation.
 *
 * Flow:
 *   1. Validate URL with `isSafePublicUrl` (SSRF guard)
 *   2. Find-or-create a `Source` row keyed on doi/url/fingerprint
 *   3. Find-or-create a link-block `LibraryPost` for the URL
 *   4. Connect the block to the stack via `addBlockToStack`
 *   5. Trigger background source provenance enrichment (sha256 + archive.org)
 *
 * Auth: requires Stack write permission (owner or editor collaborator).
 *
 * Response: { stackItemId, sourceId, contentSha256?, archive?: { url, capturedAt } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId, getCurrentUserAuthId } from "@/lib/serverutils";
import { canAddToStack } from "@/lib/stacks/permissions";
import { addBlockToStack, isBlockInStack } from "@/lib/stacks/stackItemWriter";
import { isSafePublicUrl } from "@/lib/unfurl";
import { upsertSourceFromUrlOrDoi } from "@/lib/sources/upsertSource";
import { enrichSourceProvenanceInBackground } from "@/lib/sources/sourceProvenance";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    itemKind: z.enum(["url", "doi"]),
    url: z.string().url().optional(),
    doi: z.string().min(1).optional(),
    title: z.string().optional(),
    authors: z.array(z.string()).optional(),
    publishedAt: z.string().datetime().optional(),
    abstract: z.string().optional(),
    keyFindings: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((b) => (b.itemKind === "url" ? !!b.url : !!b.doi), {
    message: "Body must include `url` when itemKind=url, or `doi` when itemKind=doi",
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

  const resolvedParams = await Promise.resolve(params);
  const stackId = resolvedParams.id;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // SSRF guard for URL ingestion. DOI-only entries skip this since the URL
  // is resolved later via the DOI registry.
  if (input.itemKind === "url" && input.url && !isSafePublicUrl(input.url)) {
    return NextResponse.json(
      { error: "URL is not a safe public URL" },
      { status: 400 }
    );
  }

  // Auth: must be able to add items to the target stack. For public_open
  // stacks, any logged-in user qualifies; for other visibilities only the
  // owner / EDITOR collaborators do.
  const canAdd = await canAddToStack(stackId, userId);
  if (!canAdd) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    select: { id: true },
  });
  if (!stack) {
    return NextResponse.json({ error: "Stack not found" }, { status: 404 });
  }

  // 1. Find-or-create the Source row (idempotent on DOI/URL/fingerprint).
  const { source, created: sourceCreated } = await upsertSourceFromUrlOrDoi({
    url: input.url ?? null,
    doi: input.doi ?? null,
    title: input.title ?? null,
    authors: input.authors ?? null,
    publishedAt: input.publishedAt ?? null,
    abstract: input.abstract ?? null,
    keywords: input.tags ?? null,
    createdById: authId,
  });

  // 2. Find-or-create a link-block LibraryPost for this URL. We key by
  //    `linkUrl` to keep one block per URL per uploader. (Multi-uploader
  //    blocks for the same URL are fine — dedup happens at the Source level.)
  const blockUrl = input.url ?? source.url;
  let block = blockUrl
    ? await prisma.libraryPost.findFirst({
        where: { uploader_id: userId, linkUrl: blockUrl },
        select: { id: true },
      })
    : null;
  if (!block) {
    block = await prisma.libraryPost.create({
      data: {
        uploader_id: userId,
        title: input.title ?? source.title ?? blockUrl ?? "Untitled source",
        blockType: "link",
        linkUrl: blockUrl ?? undefined,
        linkTitle: input.title ?? source.title ?? undefined,
        linkDescription: input.abstract ?? undefined,
      },
      select: { id: true },
    });
  }

  // 3. Backfill Source.libraryPostId so future fetches can navigate Source→Block.
  if (sourceCreated || !source.url) {
    await prisma.source
      .update({ where: { id: source.id }, data: { libraryPostId: block.id } })
      .catch(() => {});
  }

  // 4. Connect the block to the stack (idempotent).
  const alreadyConnected = await isBlockInStack(stackId, block.id);
  let stackItemId: string | null = null;
  if (alreadyConnected) {
    const existing = await prisma.stackItem.findFirst({
      where: { stackId, blockId: block.id },
      select: { id: true },
    });
    stackItemId = existing?.id ?? null;
  } else {
    const note = input.keyFindings?.length
      ? input.keyFindings.map((f) => `• ${f}`).join("\n")
      : undefined;
    const item = await addBlockToStack({
      stackId,
      blockId: block.id,
      addedById: userId,
      note,
    });
    stackItemId = item.id;
  }

  // 5. Trigger background provenance enrichment (sha256 + archive.org).
  //    Skip when the source already has a contentHash (idempotent re-add).
  if (!source.contentHash) {
    enrichSourceProvenanceInBackground([source.id]);
  }

  return NextResponse.json({
    stackItemId,
    sourceId: source.id,
    contentSha256: source.contentHash,
    archive: source.archiveUrl
      ? { url: source.archiveUrl, capturedAt: null }
      : null,
  });
}
