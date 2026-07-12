export const dynamic = "force-dynamic";

// app/api/thesis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const CreateThesisSchema = z.object({
  deliberationId: z.string(),
  title: z.string().min(1).optional().default("Untitled Thesis"),
  abstract: z.string().optional(),
  thesisClaimId: z.string().optional(),
  template: z.enum(["LEGAL_DEFENSE", "POLICY_CASE", "ACADEMIC_THESIS", "GENERAL"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authorId = await getCurrentUserAuthId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { auth_id: authorId },
      select: { auth_id: true },
    });
    if (!user) {
      console.error("[thesis POST] User not found for auth_id:", authorId);
      return NextResponse.json({ error: "User not found" }, { status: 404, ...NO_STORE });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateThesisSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }

    const { deliberationId, title, abstract, thesisClaimId, template } = parsed.data;

    // Verify deliberation exists
    const delib = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true },
    });
    if (!delib) {
      return NextResponse.json({ error: "Deliberation not found" }, { status: 404, ...NO_STORE });
    }

    // If thesisClaimId provided, verify it exists
    if (thesisClaimId) {
      const claim = await prisma.claim.findUnique({
        where: { id: thesisClaimId },
        select: { id: true },
      });
      if (!claim) {
        return NextResponse.json({ error: "Thesis claim not found" }, { status: 404, ...NO_STORE });
      }
    }

    // Generate unique slug
    let slug = slugify(title);
    const clash = await prisma.thesis.findUnique({ where: { slug } });
    if (clash) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const thesis = await prisma.thesis.create({
      data: {
        deliberationId,
        authorId: authorId, // Now using auth_id string directly
        title,
        slug,
        abstract: abstract ?? null,
        thesisClaimId: thesisClaimId ?? null,
        status: "DRAFT",
        template: template ?? "GENERAL",
        content: undefined, // Empty document to start
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, thesis }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis POST] failed", err);
    return NextResponse.json({ error: err?.message ?? "Create failed" }, { status: 500, ...NO_STORE });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");
    const authorId = searchParams.get("authorId");
    const status = searchParams.get("status");

    const where: any = {};
    if (deliberationId) where.deliberationId = deliberationId;
    if (authorId) where.authorId = authorId;
    if (status) where.status = status;

    const theses = await prisma.thesis.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        template: true,
        abstract: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            auth_id: true,
            name: true,
          },
        },
        _count: {
          select: {
            prongs: true,
            sections: true,
          },
        },
        thesisClaim: {
          select: {
            id: true,
            text: true,
          },
        },
        prongs: {
          select: {
            id: true,
            title: true,
            order: true,
            role: true,
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, theses }, NO_STORE);
  } catch (err: any) {
    console.error("[thesis GET] failed", err);
    return NextResponse.json({ error: err?.message ?? "Query failed" }, { status: 500, ...NO_STORE });
  }
}
