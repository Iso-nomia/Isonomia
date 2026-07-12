import { Prisma } from "@prisma/client";

/**
 * Canonical Prisma `include` tree for hydrating a full
 * {@link ArgumentChainWithRelations}. Shared by:
 *  - the authed route `GET /api/argument-chains/[chainId]`,
 *  - the public page `app/chains/[identifier]/page.tsx`,
 *  - the machine-citable route `GET /api/chains/[identifier]/jsonld`,
 * so all three agree on exactly one hydrated shape.
 */
export const CHAIN_PAGE_INCLUDE = {
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
        select: {
          id: true,
          text: true,
          authorId: true,
          createdAt: true,
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
          implicitWarrant: true,
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
                      materialRelation: true,
                      reasoningType: true,
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
      scope: {
        select: {
          id: true,
          scopeType: true,
          assumption: true,
          color: true,
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
  scopes: {
    select: {
      id: true,
      scopeType: true,
      assumption: true,
      color: true,
      parentScopeId: true,
      createdBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.ArgumentChainInclude;
