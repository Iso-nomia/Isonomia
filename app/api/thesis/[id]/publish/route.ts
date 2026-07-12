export const dynamic = "force-dynamic";

// app/api/thesis/[id]/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import {
  extractDraftObjects,
  validateDraftObjects,
  replaceAllDraftsWithReal,
  type DraftType,
} from "@/lib/thesis/draft-utils";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { mintUrn } from "@/lib/ids/urn";
import type { EntityCode } from "@/lib/ids/urn";
import { JSONContent } from "@tiptap/core";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorId = await getCurrentUserAuthId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    // Fetch thesis with content
    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: {
        authorId: true,
        status: true,
        content: true,
        deliberationId: true,
        meta: true,
        thesisClaimId: true,
        prongs: {
          select: { id: true },
        },
      },
    });

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }

    if (thesis.authorId !== authorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, ...NO_STORE });
    }

    if (thesis.status === "PUBLISHED") {
      return NextResponse.json({ error: "Already published" }, { status: 400, ...NO_STORE });
    }

    if (!thesis.deliberationId) {
      return NextResponse.json(
        { error: "Thesis must be associated with a deliberation to publish" },
        { status: 400, ...NO_STORE }
      );
    }

    // Extract draft objects from content
    const content = thesis.content as JSONContent | null;
    if (!content) {
      // No content - just publish as-is
      const updated = await prisma.thesis.update({
        where: { id: params.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          slug: true,
          status: true,
          publishedAt: true,
        },
      });

      return NextResponse.json({ ok: true, thesis: updated, published: { total: 0 } }, NO_STORE);
    }

    const inventory = extractDraftObjects(content);

    // If no drafts, just publish
    if (inventory.total === 0) {
      const updated = await prisma.thesis.update({
        where: { id: params.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          slug: true,
          status: true,
          publishedAt: true,
        },
      });

      return NextResponse.json({ ok: true, thesis: updated, published: { total: 0 } }, NO_STORE);
    }

    // Validate all draft objects
    const validation = validateDraftObjects(inventory);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          validationErrors: validation.errors,
        },
        { status: 400, ...NO_STORE }
      );
    }

    // Create real deliberation objects from drafts
    const draftToRealMapping: Record<string, { realId: string; type: DraftType }> = {};

    // Create propositions (promoted to claims)
    for (const prop of inventory.propositions) {
      const moid = mintClaimMoid(prop.text);
      const urnValue = mintUrn("claim" as EntityCode, moid);

      const claim = await prisma.claim.create({
        data: {
          text: prop.text,
          createdById: authorId,
          moid,
          deliberation: { connect: { id: thesis.deliberationId } },
          urns: {
            create: {
              entityType: "claim",
              urn: urnValue,
            },
          },
        },
        select: { id: true },
      });

      draftToRealMapping[prop.draftId] = { realId: claim.id, type: "proposition" };
    }

    // Create claims
    for (const claimData of inventory.claims) {
      const moid = mintClaimMoid(claimData.text);
      const urnValue = mintUrn("claim" as EntityCode, moid);

      const claim = await prisma.claim.create({
        data: {
          text: claimData.text,
          createdById: authorId,
          moid,
          deliberation: { connect: { id: thesis.deliberationId } },
          urns: {
            create: {
              entityType: "claim",
              urn: urnValue,
            },
          },
        },
        select: { id: true },
      });

      draftToRealMapping[claimData.draftId] = { realId: claim.id, type: "claim" };
    }

    // TODO: Handle arguments in future (Phase 0.3)
    // Arguments require more complex setup with ArgumentPremise, ArgumentEdges, etc.
    // For now, we skip draft arguments and log a warning
    if (inventory.arguments.length > 0) {
      console.warn(
        `[thesis/${params.id}/publish] Skipping ${inventory.arguments.length} draft arguments - not yet implemented`
      );
    }

    // Replace draft nodes with real object references in content
    const updatedContent = replaceAllDraftsWithReal(content, draftToRealMapping);

    // Update thesis with new content and publish
    const updated = await prisma.thesis.update({
      where: { id: params.id },
      data: {
        content: updatedContent as any,
        status: "PUBLISHED",
        publishedAt: new Date(),
        updatedAt: new Date(),
        meta: {
          ...(thesis.meta as object),
          publishedObjectsCount: inventory.total - inventory.arguments.length,
          publishedObjects: draftToRealMapping,
        },
      },
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        content: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        thesis: updated,
        published: {
          propositions: inventory.propositions.length,
          claims: inventory.claims.length,
          arguments: 0, // Not yet supported
          total: inventory.propositions.length + inventory.claims.length,
        },
      },
      NO_STORE
    );
  } catch (err: any) {
    console.error("[thesis/:id/publish POST] failed", err);
    return NextResponse.json({ error: err?.message ?? "Publish failed" }, { status: 500, ...NO_STORE });
  }
}
