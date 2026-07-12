// app/api/glossary/definitions/[definitionId]/endorse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/glossary/definitions/[definitionId]/endorse
 * 
 * Toggle endorsement for a definition
 * - If user hasn't endorsed: creates endorsement
 * - If user has endorsed: removes endorsement
 * 
 * Returns: { endorsed: boolean, endorsementCount: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { definitionId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid; // auth_id
    const { definitionId } = params;

    // Check if definition exists
    const definition = await prisma.glossaryDefinition.findUnique({
      where: { id: definitionId },
      include: {
        term: {
          select: {
            id: true,
            deliberationId: true,
          },
        },
      },
    });

    if (!definition) {
      return NextResponse.json(
        { error: "Definition not found" },
        { status: 404 }
      );
    }

    // Check if already endorsed
    const existing = await prisma.glossaryEndorsement.findUnique({
      where: {
        definitionId_userId: {
          definitionId,
          userId,
        },
      },
    });

    if (existing) {
      // Remove endorsement
      await prisma.$transaction([
        prisma.glossaryEndorsement.delete({
          where: { id: existing.id },
        }),
        prisma.glossaryDefinition.update({
          where: { id: definitionId },
          data: {
            endorsementCount: { decrement: 1 },
            updatedAt: new Date(),
          },
        }),
      ]);

      const updated = await prisma.glossaryDefinition.findUnique({
        where: { id: definitionId },
        select: { endorsementCount: true },
      });

      return NextResponse.json({
        endorsed: false,
        endorsementCount: updated?.endorsementCount || 0,
      });
    } else {
      // Add endorsement
      await prisma.glossaryEndorsement.create({
        data: {
          definitionId,
          userId,
        },
      });

      const updated = await prisma.glossaryDefinition.update({
        where: { id: definitionId },
        data: {
          endorsementCount: { increment: 1 },
          updatedAt: new Date(),
        },
        include: {
          term: {
            select: {
              id: true,
              deliberationId: true,
              definitions: {
                select: {
                  id: true,
                  endorsementCount: true,
                  isCanonical: true,
                },
              },
            },
          },
        },
      });

      // Check if this definition should become canonical
      await checkAndPromoteToCanonical(updated);

      return NextResponse.json({
        endorsed: true,
        endorsementCount: updated.endorsementCount,
      });
    }
  } catch (error) {
    console.error("[POST /api/glossary/definitions/[definitionId]/endorse] Error:", error);
    return NextResponse.json(
      { error: "Failed to toggle endorsement" },
      { status: 500 }
    );
  }
}

/**
 * Helper: Promote definition to canonical if endorsement threshold is met
 * 
 * Threshold: 50% of deliberation participants (minimum 3 endorsements)
 */
async function checkAndPromoteToCanonical(
  definition: any
): Promise<void> {
  try {
    const term = definition.term;
    const deliberationId = term.deliberationId;

    // Get participant count for the deliberation
    const participantCount = await getDeliberationParticipantCount(deliberationId);

    // Threshold: 50% of participants (minimum 3)
    const threshold = Math.max(3, Math.ceil(participantCount * 0.5));

    if (definition.endorsementCount >= threshold) {
      // Check if another definition is already canonical
      const currentCanonical = term.definitions.find(
        (d: any) => d.isCanonical && d.id !== definition.id
      );

      // Only promote if this definition has more endorsements than current canonical
      // OR if there's no canonical definition yet
      if (
        !currentCanonical ||
        definition.endorsementCount > currentCanonical.endorsementCount
      ) {
        await prisma.$transaction([
          // Remove canonical status from all other definitions
          prisma.glossaryDefinition.updateMany({
            where: {
              termId: term.id,
              id: { not: definition.id },
            },
            data: { isCanonical: false },
          }),

          // Set this as canonical
          prisma.glossaryDefinition.update({
            where: { id: definition.id },
            data: { isCanonical: true },
          }),

          // Update term status to CONSENSUS
          prisma.glossaryTerm.update({
            where: { id: term.id },
            data: { status: "CONSENSUS", updatedAt: new Date() },
          }),
        ]);

        console.log(
          `[Glossary] Definition ${definition.id} promoted to canonical for term ${term.id}`
        );
      }
    }
  } catch (error) {
    console.error("[checkAndPromoteToCanonical] Error:", error);
    // Don't throw - this is a background operation
  }
}

/**
 * Get the number of active participants in a deliberation
 * 
 * For now, count users who have created claims or arguments
 * TODO: Consider using a more sophisticated participant tracking system
 */
async function getDeliberationParticipantCount(
  deliberationId: string
): Promise<number> {
  try {
    const [claimAuthors, argumentAuthors] = await Promise.all([
      prisma.claim.findMany({
        where: { deliberationId },
        select: { createdById: true },
        distinct: ["createdById"],
      }),
      prisma.argument.findMany({
        where: { deliberationId },
        select: { authorId: true },
        distinct: ["authorId"],
      }),
    ]);

    const uniqueParticipants = new Set([
      ...claimAuthors.map((c) => c.createdById),
      ...argumentAuthors.map((a) => a.authorId),
    ]);

    return uniqueParticipants.size || 1; // Minimum 1 to avoid division by zero
  } catch (error) {
    console.error("[getDeliberationParticipantCount] Error:", error);
    return 10; // Fallback default
  }
}
