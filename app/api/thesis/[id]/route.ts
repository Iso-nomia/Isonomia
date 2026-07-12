export const dynamic = "force-dynamic";

// app/api/thesis/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { syncThesisChainReferences } from "@/lib/thesis/chain-references";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const UpdateThesisSchema = z.object({
  title: z.string().min(1).optional(),
  thesisClaimId: z.string().optional(),
  abstract: z.string().optional(),
  template: z.enum(["LEGAL_DEFENSE", "POLICY_CASE", "ACADEMIC_THESIS", "GENERAL"]).optional(),
  content: z.any().optional(), // TipTap JSONContent
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      include: {
        thesisClaim: {
          select: {
            id: true,
            text: true,
            ClaimLabel: true,
          },
        },
        prongs: {
          include: {
            mainClaim: {
              select: {
                id: true,
                text: true,
                ClaimLabel: true,
              },
            },
            arguments: {
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
                    premises: {
                      include: {
                        claim: {
                          select: {
                            id: true,
                            text: true,
                          },
                        },
                      },
                    },
                    scheme: {
                      select: {
                        id: true,
                        key: true,
                        name: true,
                      },
                    },
                    // Phase D4 Week 3: include scheme instances (with premises + justification)
                    // so the EnablerPanel can extract inference assumptions in ProngEditor /
                    // ThesisComposer surfaces.
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
          orderBy: { order: "asc" },
        },
        sections: {
          orderBy: { order: "asc" },
        },
        deliberation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }

    return NextResponse.json({ ok: true, thesis }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id GET] failed", err);
    return NextResponse.json({ error: err?.message ?? "Query failed" }, { status: 500, ...NO_STORE });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorId = await getCurrentUserAuthId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = UpdateThesisSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    // Verify ownership
    const existing = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: { authorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }

    if (existing.authorId !== authorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, ...NO_STORE });
    }

    const thesis = await prisma.thesis.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });

    // D4 Week 1–2: keep ThesisChainReference rows in sync with embedded
    // `argumentChainNode` atoms. Best-effort — we log + continue on failure
    // so a transient DB hiccup never blocks the user's save.
    if (parsed.data.content !== undefined) {
      try {
        await syncThesisChainReferences(
          params.id,
          parsed.data.content as any,
        );
      } catch (refErr) {
        console.error(
          "[thesis/:id PATCH] syncThesisChainReferences failed",
          refErr,
        );
      }
    }

    return NextResponse.json({ ok: true, thesis }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id PATCH] failed", err);
    return NextResponse.json({ error: err?.message ?? "Update failed" }, { status: 500, ...NO_STORE });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorId = await getCurrentUserAuthId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    // Verify ownership
    const existing = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: { authorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }

    if (existing.authorId !== authorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, ...NO_STORE });
    }

    await prisma.thesis.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis/:id DELETE] failed", err);
    return NextResponse.json({ error: err?.message ?? "Delete failed" }, { status: 500, ...NO_STORE });
  }
}
