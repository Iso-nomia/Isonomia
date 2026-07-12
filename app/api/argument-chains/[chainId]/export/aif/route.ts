export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { convertChainToAif, validateAifDocument } from "@/lib/utils/chainToAif";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * Export ArgumentChain as AIF (Argument Interchange Format) JSON-LD
 * 
 * POST /api/argument-chains/[chainId]/export/aif
 * 
 * Converts the argument chain to W3C AIF format for interoperability
 * with other argumentation tools (OVA, Carneades, AIFdb).
 * 
 * Authentication: Required (creator or contributor)
 * 
 * Response format:
 * {
 *   "@context": { AIF: "...", ... },
 *   nodes: [...],
 *   edges: [...],
 *   locutions: [...],
 *   participants: [...],
 *   schemeSets: [...],
 *   metadata: { ... }
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    // Authenticate user
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId } = params;

    // Fetch chain with full relations (same as analyze endpoint)
    const chain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        deliberation: {
          select: {
            id: true,
            title: true,
          },
        },
        nodes: {
          include: {
            argument: {
              include: {
                conclusion: {
                  select: {
                    id: true,
                    text: true,
                  },
                },
                argumentSchemes: {
                  include: {
                    scheme: true,
                  },
                },
                schemeNet: {
                  include: {
                    steps: {
                      include: {
                        scheme: true,
                      },
                      orderBy: {
                        stepOrder: "asc",
                      },
                    },
                  },
                },
              },
            },
            contributor: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            nodeOrder: "asc",
          },
        },
        edges: {
          include: {
            sourceNode: {
              include: {
                argument: {
                  select: {
                    id: true,
                    text: true,
                  },
                },
              },
            },
            targetNode: {
              include: {
                argument: {
                  select: {
                    id: true,
                    text: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chain) {
      return NextResponse.json(
        { error: "Chain not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Check permissions (creator or contributor)
    const isCreator = chain.createdBy === BigInt(user.userId);
    const isContributor = chain.nodes.some(
      (node: any) => node.contributor.id === user.userId
    );

    if (!isCreator && !isContributor) {
      return NextResponse.json(
        { error: "You do not have permission to export this chain" },
        { status: 403, ...NO_STORE }
      );
    }

    // Convert to AIF format
    const aifDocument = convertChainToAif(chain as any);

    // Validate AIF document
    const validation = validateAifDocument(aifDocument);
    if (!validation.valid) {
      console.error("AIF validation errors:", validation.errors);
      return NextResponse.json(
        {
          error: "AIF conversion produced invalid document",
          validationErrors: validation.errors,
        },
        { status: 500, ...NO_STORE }
      );
    }

    // Return AIF JSON-LD
    return NextResponse.json(
      aifDocument,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/ld+json",
          "Content-Disposition": `attachment; filename="chain_${chainId}_aif.json"`,
        },
      }
    );
  } catch (error) {
    console.error("Error exporting argument chain to AIF:", error);
    return NextResponse.json(
      {
        error: "Failed to export argument chain to AIF",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, ...NO_STORE }
    );
  }
}
