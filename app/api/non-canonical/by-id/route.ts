export const dynamic = "force-dynamic";

// app/api/non-canonical/by-id/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function GET(req: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId().catch(() => null);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    // Fetch NCM by ID
    const ncm = await prisma.nonCanonicalMove.findUnique({
      where: { id },
      include: {
        contributor: {
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
          },
        },
      },
    } as any);

    if (!ncm) {
      return NextResponse.json(
        { error: "Non-canonical move not found" },
        { status: 404 }
      );
    }

    // Serialize BigInt to string
    const serialized = JSON.parse(
      JSON.stringify(
        { ncm },
        (_, v) => (typeof v === "bigint" ? v.toString() : v)
      )
    );

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error("[non-canonical/by-id] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
