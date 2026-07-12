export const dynamic = "force-dynamic";

/**
 * Get Single Annotation API
 * 
 * Phase 2.1 of Stacks Improvement Roadmap
 * 
 * Retrieve a specific annotation by ID for citation navigation.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = params;

  const annotation = await prisma.annotation.findUnique({
    where: { id },
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
      post: {
        select: {
          id: true,
          title: true,
          file_url: true,
        },
      },
    },
  });

  if (!annotation) {
    return NextResponse.json(
      { error: "Annotation not found" },
      { status: 404 }
    );
  }

  // Serialize BigInt
  const serialized = {
    ...annotation,
    author: annotation.author ? {
      ...annotation.author,
      id: String(annotation.author.id),
    } : null,
  };

  return NextResponse.json({ annotation: serialized });
}
