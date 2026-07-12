export const dynamic = "force-dynamic";

// app/api/glossary/terms/[termId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { termId: string } }
) {
  try {
    const { termId } = params;

    const term = await prisma.glossaryTerm.findUnique({
      where: { id: termId },
      include: {
        definitions: {
          include: {
            author: {
              select: {
                auth_id: true,
                name: true,
                username: true,
              },
            },
          },
          orderBy: [
            { isCanonical: "desc" },
            { endorsementCount: "desc" },
          ],
        },
        proposedBy: {
          select: {
            auth_id: true,
            name: true,
            username: true,
          },
        },
        usages: {
          orderBy: { detectedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Term not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ term });
  } catch (error) {
    console.error("Error fetching glossary term:", error);
    return NextResponse.json(
      { error: "Failed to fetch term" },
      { status: 500 }
    );
  }
}
