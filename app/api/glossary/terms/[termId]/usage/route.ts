export const dynamic = "force-dynamic";

// app/api/glossary/terms/[termId]/usage/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { termId: string } }
) {
  try {
    const { termId } = params;

    // Get all usage entries for this term
    const usages = await prisma.glossaryTermUsage.findMany({
      where: { termId },
      orderBy: { detectedAt: "desc" },
    });

    return NextResponse.json({ usages });
  } catch (error) {
    console.error("Error fetching term usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 }
    );
  }
}
