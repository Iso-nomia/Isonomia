export const dynamic = "force-dynamic";

/**
 * Export argument chain as essay
 * 
 * Generates a flowing essay narrative from the chain structure,
 * weaving together argumentation schemes, premises, and dialectical relationships.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEssay, EssayOptions } from "@/lib/chains/essayGenerator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { chainId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Parse options from query params
    const tone = searchParams.get("tone") as EssayOptions["tone"] || "deliberative";
    const audienceLevel = searchParams.get("audienceLevel") as EssayOptions["audienceLevel"] || "informed";
    const includeSchemeReferences = searchParams.get("includeSchemeReferences") !== "false";
    const includeCriticalQuestions = searchParams.get("includeCriticalQuestions") !== "false";
    const includePremiseStructure = searchParams.get("includePremiseStructure") !== "false";
    const includeDialectic = searchParams.get("includeDialectic") !== "false";
    const format = searchParams.get("format") || "json"; // json | text | markdown
    
    // Fetch full chain with all relations
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
                premises: {
                  include: {
                    claim: {
                      select: {
                        id: true,
                        text: true,
                      },
                    },
                  },
                },
                argumentSchemes: {
                  include: {
                    scheme: {
                      select: {
                        id: true,
                        key: true,
                        name: true,
                        description: true,
                        summary: true,
                        cq: true,
                        premises: true,
                        conclusion: true,
                        purpose: true,
                        source: true,
                        materialRelation: true,
                        reasoningType: true,
                        ruleForm: true,
                        conclusionType: true,
                        whenToUse: true,
                        examples: true,
                        clusterTag: true,
                        parentSchemeId: true,
                        tags: true,
                      },
                    },
                  },
                },
                schemeNet: {
                  include: {
                    steps: {
                      include: {
                        scheme: {
                          select: {
                            id: true,
                            key: true,
                            name: true,
                            description: true,
                            summary: true,
                            cq: true,
                            premises: true,
                            conclusion: true,
                            purpose: true,
                            source: true,
                            materialRelation: true,
                            reasoningType: true,
                            ruleForm: true,
                            conclusionType: true,
                          },
                        },
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
                    conclusion: {
                      select: {
                        id: true,
                        text: true,
                      },
                    },
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
                    conclusion: {
                      select: {
                        id: true,
                        text: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    
    if (!chain) {
      return NextResponse.json(
        { error: "Chain not found" },
        { status: 404 }
      );
    }
    
    // Generate essay
    const options: EssayOptions = {
      tone,
      audienceLevel,
      includeSchemeReferences,
      includeCriticalQuestions,
      includePremiseStructure,
      includeDialectic,
    };
    
    const essay = generateEssay(chain as any, options);
    
    // Return in requested format
    if (format === "text") {
      return new NextResponse(essay.fullText.replace(/^#+ /gm, "").replace(/\*([^*]+)\*/g, "$1"), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${chain.name || "essay"}.txt"`,
        },
      });
    }
    
    if (format === "markdown") {
      return new NextResponse(essay.fullText, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${chain.name || "essay"}.md"`,
        },
      });
    }
    
    // Default: JSON response
    return NextResponse.json({
      success: true,
      essay,
    });
    
  } catch (error) {
    console.error("[CHAIN_EXPORT_ESSAY] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate essay" },
      { status: 500 }
    );
  }
}
