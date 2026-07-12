// app/api/deliberations/[id]/glossary/terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/deliberations/[id]/glossary/terms
 * 
 * Fetch all glossary terms for a deliberation with their definitions
 * 
 * Query params:
 * - status: Filter by status ("PENDING" | "CONSENSUS" | "CONTESTED" | "ARCHIVED" | "all")
 * - search: Search terms by name (case-insensitive)
 * - sort: Sort order ("usage" | "alphabetical" | "recent")
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const { searchParams } = new URL(req.url);
    
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "usage";

    // Build where clause
    const where: any = {
      deliberationId,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.termNormalized = {
        contains: search.toLowerCase(),
      };
    }

    // Fetch terms with all related data
    const terms = await prisma.glossaryTerm.findMany({
      where,
      include: {
        proposedBy: {
          select: {
            auth_id: true,
            username: true,
            name: true,
            image: true,
          },
        },
        definitions: {
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
            _count: {
              select: {
                endorsements: true,
                votes: true,
              },
            },
          },
          orderBy: [
            { isCanonical: "desc" }, // Canonical first
            { endorsementCount: "desc" }, // Then by popularity
          ],
        },
        usages: {
          select: {
            id: true,
            targetType: true,
            targetId: true,
            contextText: true,
          },
        },
        _count: {
          select: {
            definitions: true,
            usages: true,
          },
        },
      },
      orderBy:
        sort === "alphabetical"
          ? { termNormalized: "asc" }
          : sort === "recent"
          ? { createdAt: "desc" }
          : { usages: { _count: "desc" } }, // Default: usage count
    });

    return NextResponse.json({ terms });
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/glossary/terms] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch glossary terms" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deliberations/[id]/glossary/terms
 * 
 * Create a new glossary term with initial definition
 * 
 * Body:
 * - term: string (required) - The term to define
 * - definition: string (required) - The definition text
 * - examples: string (optional) - Usage examples
 * - sources: object[] (optional) - References/citations
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid; // auth_id, not the BigInt id

    const deliberationId = params.id;
    const { term, definition, examples, sources } = await req.json();

    // Validation
    if (!term || typeof term !== "string" || term.trim().length === 0) {
      return NextResponse.json(
        { error: "Term is required and must be a non-empty string" },
        { status: 400 }
      );
    }

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

    // Normalize term for uniqueness check
    const termNormalized = term.toLowerCase().trim();

    // Check if term already exists
    const existing = await prisma.glossaryTerm.findUnique({
      where: {
        deliberationId_termNormalized: {
          deliberationId,
          termNormalized,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "Term already exists in this deliberation glossary",
          existingTermId: existing.id,
          suggestion: "You can propose an alternative definition instead",
        },
        { status: 409 }
      );
    }

    // Create term with initial definition
    const newTerm = await prisma.glossaryTerm.create({
      data: {
        deliberationId,
        term: term.trim(),
        termNormalized,
        status: "PENDING",
        proposedById: userId,
        definitions: {
          create: {
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
        },
      },
      include: {
        proposedBy: {
          select: {
            auth_id: true,
            username: true,
            name: true,
            image: true,
          },
        },
        definitions: {
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
        },
      },
    });

    return NextResponse.json({ term: newTerm }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deliberations/[id]/glossary/terms] Error:", error);
    return NextResponse.json(
      { error: "Failed to create glossary term" },
      { status: 500 }
    );
  }
}
