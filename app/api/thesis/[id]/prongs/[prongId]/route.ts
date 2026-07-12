export const dynamic = "force-dynamic";

// app/api/thesis/[id]/prongs/[prongId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; prongId: string } }
) {
  try {
    const prong = await prisma.thesisProng.findFirst({
      where: { id: params.prongId, thesisId: params.id },
      include: {
        mainClaim: { select: { id: true, text: true } },
        arguments: {
          include: {
            argument: {
              select: {
                id: true,
                text: true,
                conclusion: { select: { id: true, text: true } },
                premises: {
                  include: {
                    claim: { select: { id: true, text: true } },
                  },
                },
                scheme: { select: { id: true, key: true, name: true } },
                // D4 Week 3: include scheme instances so EnablerPanel can extract enablers.
                argumentSchemes: {
                  include: {
                    scheme: {
                      select: {
                        id: true,
                        key: true,
                        name: true,
                        title: true,
                        description: true,
                        premises: true,
                      },
                    },
                  },
                  orderBy: [{ role: "asc" }, { order: "asc" }],
                },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!prong) {
      return NextResponse.json({ error: "Prong not found" }, { status: 404, ...NO_STORE });
    }

    return NextResponse.json({ ok: true, prong }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/prongs/:prongId GET] failed", err);
    return NextResponse.json({ error: err?.message ?? "Query failed" }, { status: 500, ...NO_STORE });
  }
}

const UpdateProngSchema = z.object({
  title: z.string().min(3).optional(),
  mainClaimId: z.string().optional(),
  role: z.enum(["SUPPORT", "REBUT", "PREEMPT"]).optional(),
  introduction: z.string().optional(),
  conclusion: z.string().optional(),
});

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
    const parsed = UpdateProngSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    const prong = await prisma.thesisProng.update({
      where: { id: params.prongId },
      data: parsed.data,
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
    console.error("[thesis/:id/prongs/:prongId PATCH] failed", err);
    return NextResponse.json({ error: err?.message ?? "Update failed" }, { status: 500, ...NO_STORE });
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

    await prisma.thesisProng.delete({
      where: { id: params.prongId },
    });

    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id/prongs/:prongId DELETE] failed", err);
    return NextResponse.json({ error: err?.message ?? "Delete failed" }, { status: 500, ...NO_STORE });
  }
}
