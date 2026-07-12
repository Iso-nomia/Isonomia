export const dynamic = "force-dynamic";

/**
 * Annotations API
 * 
 * Phase 2.1 of Stacks Improvement Roadmap
 * 
 * Create and retrieve PDF annotations for citation anchoring.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { z } from "zod";

const CreateAnnotation = z.object({
  post_id: z.string().min(1),
  page: z.number().int().min(1),
  rect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  text: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateAnnotation.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { post_id, page, rect, text } = parsed.data;

  // Verify the library post exists
  const post = await prisma.libraryPost.findUnique({
    where: { id: post_id },
    select: { id: true },
  });

  if (!post) {
    return NextResponse.json(
      { error: "Library post not found" },
      { status: 404 }
    );
  }

  // Create the annotation
  const annotation = await prisma.annotation.create({
    data: {
      post_id,
      page,
      rect,
      text,
      author_id: BigInt(userId),
    },
    select: {
      id: true,
      post_id: true,
      page: true,
      rect: true,
      text: true,
      created_at: true,
    },
  });

  return NextResponse.json({ annotation });
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("post_id");

  if (!postId) {
    return NextResponse.json(
      { error: "post_id query parameter required" },
      { status: 400 }
    );
  }

  const annotations = await prisma.annotation.findMany({
    where: { post_id: postId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      post_id: true,
      page: true,
      rect: true,
      text: true,
      created_at: true,
      author: {
        select: {
          id: true,
          username: true,
          image: true,
        },
      },
    },
  });

  // Serialize BigInt author ids
  const serialized = annotations.map((a) => ({
    ...a,
    author: a.author ? {
      ...a.author,
      id: String(a.author.id),
    } : null,
  }));

  return NextResponse.json({ annotations: serialized });
}
