export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const net = await prisma.schemeNet.findUnique({
      where: { id: params.id },
      include: {
        steps: { include: { scheme: true } },
      },
    });

    if (!net) {
      return NextResponse.json({ error: "Net not found" }, { status: 404 });
    }

    return NextResponse.json({ net });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch net" },
      { status: 500 }
    );
  }
}
