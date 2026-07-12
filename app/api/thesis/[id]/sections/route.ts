export const dynamic = "force-dynamic";

// app/api/thesis/[id]/sections/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const CreateSectionSchema = z.object({
  sectionType: z.enum(["INTRODUCTION", "BACKGROUND", "LEGAL_STANDARD", "CONCLUSION", "APPENDIX"]),
  title: z.string().min(1),
  content: z.string(),
});

const UpdateSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});

const ReorderSectionsSchema = z.object({
  sectionIds: z.array(z.string()),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorId = await getCurrentUserId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    // Verify ownership
    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: { authorId: true },
    });

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }

    if (thesis.authorId !== String(authorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, ...NO_STORE });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    const { sectionType, title, content } = parsed.data;

    // Get next order number
    const lastSection = await prisma.thesisSection.findFirst({
      where: { thesisId: params.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastSection?.order ?? 0) + 1;

    const section = await prisma.thesisSection.create({
      data: {
        thesisId: params.id,
        sectionType,
        title,
        content,
        order: nextOrder,
      },
    });

    return NextResponse.json({ ok: true, section }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/sections POST] failed", err);
    return NextResponse.json({ error: err?.message ?? "Create section failed" }, { status: 500, ...NO_STORE });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorId = await getCurrentUserId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    // Verify ownership
    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: { authorId: true },
    });

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }

    if (thesis.authorId !== String(authorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, ...NO_STORE });
    }

    const body = await req.json().catch(() => ({}));

    // Check if this is a reorder or update operation
    const reorderParsed = ReorderSectionsSchema.safeParse(body);
    if (reorderParsed.success) {
      // Reorder sections
      await prisma.$transaction(
        reorderParsed.data.sectionIds.map((sectionId, index) =>
          prisma.thesisSection.update({
            where: { id: sectionId },
            data: { order: index + 1 },
          })
        )
      );
      return NextResponse.json({ ok: true }, NO_STORE);
    }

    const updateParsed = UpdateSectionSchema.safeParse(body);
    if (!updateParsed.success) {
      return NextResponse.json({ error: updateParsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    const { id, title, content } = updateParsed.data;

    const section = await prisma.thesisSection.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
      },
    });

    return NextResponse.json({ ok: true, section }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/sections PATCH] failed", err);
    return NextResponse.json({ error: err?.message ?? "Update failed" }, { status: 500, ...NO_STORE });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorId = await getCurrentUserId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    // Verify ownership
    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: { authorId: true },
    });

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }

    if (thesis.authorId !== String(authorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, ...NO_STORE });
    }

    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("sectionId");

    if (!sectionId) {
      return NextResponse.json({ error: "sectionId required" }, { status: 400, ...NO_STORE });
    }

    await prisma.thesisSection.delete({
      where: { id: sectionId },
    });

    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/sections DELETE] failed", err);
    return NextResponse.json({ error: err?.message ?? "Delete failed" }, { status: 500, ...NO_STORE });
  }
}
