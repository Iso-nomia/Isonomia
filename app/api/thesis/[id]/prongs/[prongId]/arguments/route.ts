export const dynamic = "force-dynamic";

// app/api/thesis/[id]/prongs/[prongId]/arguments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const AddArgumentSchema = z.object({
  argumentId: z.string(),
  role: z.enum(["PREMISE", "INFERENCE", "COUNTER_RESPONSE"]).optional(),
  note: z.string().optional(),
});

const ReorderArgumentsSchema = z.object({
  argumentIds: z.array(z.string()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; prongId: string } }
) {
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
    const parsed = AddArgumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    const { argumentId, role, note } = parsed.data;

    // Verify argument exists
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { id: true },
    });
    if (!argument) {
      return NextResponse.json({ error: "Argument not found" }, { status: 404, ...NO_STORE });
    }

    // Get next order number
    const lastArg = await prisma.thesisProngArgument.findFirst({
      where: { prongId: params.prongId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastArg?.order ?? 0) + 1;

    const prongArg = await prisma.thesisProngArgument.create({
      data: {
        prongId: params.prongId,
        argumentId,
        order: nextOrder,
        role: role ?? "PREMISE",
        note: note ?? null,
      },
      include: {
        argument: {
          select: {
            id: true,
            text: true,
            conclusion: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, prongArg }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/prongs/:prongId/arguments POST] failed", err);
    return NextResponse.json({ error: err?.message ?? "Add argument failed" }, { status: 500, ...NO_STORE });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; prongId: string } }
) {
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
    const parsed = ReorderArgumentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    // Reorder arguments
    await prisma.$transaction(
      parsed.data.argumentIds.map((argId, index) =>
        prisma.thesisProngArgument.updateMany({
          where: {
            prongId: params.prongId,
            argumentId: argId,
          },
          data: { order: index + 1 },
        })
      )
    );

    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/prongs/:prongId/arguments PATCH] failed", err);
    return NextResponse.json({ error: err?.message ?? "Reorder failed" }, { status: 500, ...NO_STORE });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; prongId: string } }
) {
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
    const argumentId = searchParams.get("argumentId");

    if (!argumentId) {
      return NextResponse.json({ error: "argumentId required" }, { status: 400, ...NO_STORE });
    }

    await prisma.thesisProngArgument.deleteMany({
      where: {
        prongId: params.prongId,
        argumentId,
      },
    });

    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/prongs/:prongId/arguments DELETE] failed", err);
    return NextResponse.json({ error: err?.message ?? "Delete failed" }, { status: 500, ...NO_STORE });
  }
}
