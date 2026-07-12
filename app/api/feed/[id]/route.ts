export const dynamic = "force-dynamic";

// app/api/feed/[id]/route.ts
import { prisma } from "@/lib/prismaclient";
import { NextResponse } from "next/server";
import { jsonSafe } from "@/lib/bigintjson";

export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
  ) {
    const post = await prisma.feedPost.findUnique({
      where: { id: BigInt(params.id) },
      include: { author: true, productReview: { include: { claims: true } } },
    });
  
    if (!post) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
  
    return NextResponse.json(jsonSafe(post), {
      headers: { "Cache-Control": "no-store" },
    });
  }