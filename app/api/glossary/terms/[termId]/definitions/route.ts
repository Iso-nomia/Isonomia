// app/api/glossary/terms/[termId]/definitions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/glossary/terms/[termId]/definitions
 * 
 * Propose an alternative definition for an existing term
 * 
 * Body:
 * - definition: string (required) - The alternative definition text
 * - examples: string (optional) - Usage examples
 * - sources: object[] (optional) - References/citations
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { termId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid; // auth_id
    const { termId } = params;
    const { definition, examples, sources } = await req.json();

    // Validation
    if (!definition || typeof definition !== "string" || definition.trim().length === 0) {
      return NextResponse.json(
        { error: "Definition is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (definition.length > 2000) {
      return NextResponse.json(
        { error: "Definition must be less than 2000 characters" },
        { status: 400 }
      );
    }

    // Check if term exists
    const term = await prisma.glossaryTerm.findUnique({
      where: { id: termId },
      include: {
        definitions: {
          select: { id: true },
        },
      },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Glossary term not found" },
        { status: 404 }
      );
    }

    // Create alternative definition in a transaction
    const [newDefinition, updatedTerm] = await prisma.$transaction([
      // Create the new definition
      prisma.glossaryDefinition.create({
        data: {
          termId,
          definition: definition.trim(),
          examples: examples?.trim() || null,
          sources: sources || null,
          authorId: userId,
          isCanonical: false,
          endorsementCount: 1, // Self-endorsement
          endorsements: {
            create: {
              userId,
            },
          },
        },
        include: {
          author: {
            select: {
              auth_id: true,
              username: true,
              name: true,
              image: true,
            },
          },
          endorsements: {
            include: {
              user: {
                select: {
                  auth_id: true,
                  username: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      }),

      // Update term status to CONTESTED (if not already)
      prisma.glossaryTerm.update({
        where: { id: termId },
        data: {
          status: term.definitions.length >= 1 ? "CONTESTED" : "PENDING",
          updatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json(
      {
        definition: newDefinition,
        termStatus: updatedTerm.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/glossary/terms/[termId]/definitions] Error:", error);
    return NextResponse.json(
      { error: "Failed to create alternative definition" },
      { status: 500 }
    );
  }
}
