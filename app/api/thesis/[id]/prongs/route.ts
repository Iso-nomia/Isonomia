export const dynamic = "force-dynamic";

// app/api/thesis/[id]/prongs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const CreateProngSchema = z.object({
  title: z.string().min(3),
  mainClaimId: z.string(),
  role: z.enum(["SUPPORT", "REBUT", "PREEMPT"]).optional(),
  introduction: z.string().optional(),
  conclusion: z.string().optional(),
});

const ReorderProngsSchema = z.object({
  prongIds: z.array(z.string()),
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
    const parsed = CreateProngSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    const { title, mainClaimId, role, introduction, conclusion } = parsed.data;

    // Verify claim exists
    const claim = await prisma.claim.findUnique({
      where: { id: mainClaimId },
      select: { id: true },
    });
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404, ...NO_STORE });
    }

    // Get next order number
    const lastProng = await prisma.thesisProng.findFirst({
      where: { thesisId: params.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastProng?.order ?? 0) + 1;

    const prong = await prisma.thesisProng.create({
      data: {
        thesisId: params.id,
        title,
        mainClaimId,
        order: nextOrder,
        role: role ?? "SUPPORT",
        introduction: introduction ?? undefined,
        conclusion: conclusion ?? undefined,
      },
      include: {
        mainClaim: {
          select: {
            id: true,
            text: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, prong }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/prongs POST] failed", err);
    return NextResponse.json({ error: err?.message ?? "Create prong failed" }, { status: 500, ...NO_STORE });
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
    const parsed = ReorderProngsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    // Reorder prongs
    await prisma.$transaction(
      parsed.data.prongIds.map((prongId, index) =>
        prisma.thesisProng.update({
          where: { id: prongId },
          data: { order: index + 1 },
        })
      )
    );

    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/prongs PATCH] failed", err);
    return NextResponse.json({ error: err?.message ?? "Reorder failed" }, { status: 500, ...NO_STORE });
  }
}
