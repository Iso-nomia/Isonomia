export const dynamic = "force-dynamic";

// app/api/glossary/terms/[termId]/history/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { termId: string } }
) {
  try {
    const { termId } = params;

    // Get all definitions for this term
    const definitions = await prisma.glossaryDefinition.findMany({
      where: { termId },
      select: { id: true },
    });

    if (definitions.length === 0) {
      return NextResponse.json({ history: [] });
    }

    const definitionIds = definitions.map(d => d.id);

    // Get all history entries for these definitions
    const history = await prisma.glossaryDefinitionHistory.findMany({
      where: {
        definitionId: { in: definitionIds },
      },
      include: {
        changedBy: {
          select: {
            auth_id: true,
            name: true,
            username: true,
          },
        },
        definition: {
          select: {
            id: true,
            definition: true,
            isCanonical: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching definition history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
