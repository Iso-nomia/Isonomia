// lib/arguments/diagram-neighborhoods.ts
// Phase 2: Multi-argument neighborhood expansion

import { prisma } from "../prismaclient";
import type { AifSubgraph, AifNode, AifEdge } from './diagram';

// Helper to create AIF node IDs
const I = (claimId: string) => `I:${claimId}`;
const RA = (argId: string) => `RA:${argId}`;
const CA = (caId: string) => `CA:${caId}`;
const PA = (paId: string) => `PA:${paId}`;

/**
 * Build a multi-argument neighborhood graph centered on a given argument.
 * Explores connected arguments up to the specified depth.
 * 
 * @param argumentId - Root argument to start from
 * @param depth - How many hops to explore (0 = just the argument, 1 = immediate neighbors, etc.)
 * @param options - Additional filtering/expansion options
 */
export async function buildAifNeighborhood(
  argumentId: string,
  depth: number = 2,
  options: {
    includeSupporting?: boolean;  // Include arguments that support this one
    includeOpposing?: boolean;    // Include conflicting arguments
    includePreferences?: boolean; // Include preference relations
    maxNodes?: number;            // Stop if graph exceeds this size
  } = {}
): Promise<AifSubgraph | null> {
  const {
    includeSupporting = true,
    includeOpposing = true,
    includePreferences = true,
    maxNodes = 200,
  } = options;

  const visited = new Set<string>();
  const nodes: AifNode[] = [];
  const edges: AifEdge[] = [];
  const nodeMap = new Map<string, AifNode>();
  const edgeMap = new Map<string, AifEdge>();

  // Helper to add unique node
  const addNode = (node: AifNode) => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
      nodes.push(node);
    }
  };

  // Helper to add unique edge
  const addEdge = (edge: AifEdge) => {
    if (!edgeMap.has(edge.id)) {
      edgeMap.set(edge.id, edge);
      edges.push(edge);
    }
  };

  // Recursive exploration function
  async function explore(argId: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(argId)) return;
    if (nodes.length >= maxNodes) {
      console.warn(`Neighborhood expansion stopped: maxNodes (${maxNodes}) exceeded`);
      return;
    }

    visited.add(argId);

    // Fetch the argument
    // @ts-ignore - Schema may need regeneration
    const arg: any = await prisma.argument.findUnique({
      where: { id: argId },
      // @ts-ignore
      select: {
        id: true,
        text: true,
        schemeId: true,
        conclusionClaimId: true,
        deliberationId: true,
        // @ts-ignore
        createdByMoveId: true,
        premises: {
          select: { claimId: true, isImplicit: true }
        }
      }
    });

    if (!arg) return;

    // Fetch scheme metadata separately for cleaner types
    let schemeName: string | null = null;
    let cqStatus: { total: number; answered: number; open: number; keys: string[] } | null = null;
    
    if (arg.schemeId) {
      // @ts-ignore - Schema may need regeneration
      const scheme: any = await prisma.argumentScheme.findUnique({
        where: { id: arg.schemeId },
        // @ts-ignore
        select: {
          name: true,
          cqs: {
            select: {
              cqKey: true,
              text: true,
            }
          }
        }
      });
      
      if (scheme) {
        schemeName = scheme.name;
        
        // Fetch CQ status
        if (scheme.cqs && scheme.cqs.length > 0) {
          const cqKeys = scheme.cqs.map((cq: any) => cq.cqKey).filter(Boolean) as string[];
          if (cqKeys.length > 0) {
            // @ts-ignore - Schema may need regeneration
            const cqStatuses: any[] = await prisma.cQStatus.findMany({
              where: {
                argumentId: argId,
                schemeKey: arg.schemeId,
                cqKey: { in: cqKeys }
              },
              // @ts-ignore
              select: { 
                cqKey: true,
                // @ts-ignore
                statusEnum: true,
              }
            });
            
            const answeredSet = new Set(
              cqStatuses
                .filter((s: any) => s.statusEnum === 'ANSWERED' || s.statusEnum === 'DISMISSED')
                .map((s: any) => s.cqKey)
            );
            const openCQs = scheme.cqs.filter((cq: any) => cq.cqKey && !answeredSet.has(cq.cqKey));
            
            cqStatus = {
              total: scheme.cqs.length,
              answered: answeredSet.size,
              open: openCQs.length,
              keys: openCQs.map((cq: any) => cq.cqKey || cq.text || '').filter(Boolean),
            };
          }
        }
      }
    }

    // Fetch dialogue move metadata
    let locutionType: string | null = null;
    if (arg.createdByMoveId) {
      const move = await prisma.dialogueMove.findUnique({
        where: { id: arg.createdByMoveId },
        select: { kind: true }
      });
      locutionType = move?.kind || null;
    }

    // Build basic argument structure (RA + I-nodes)
    const claimIds = Array.from(new Set([
      ...(arg.conclusionClaimId ? [arg.conclusionClaimId] : []),
      ...arg.premises.map((p: any) => p.claimId),
    ]));

    const claims = claimIds.length
      ? await prisma.claim.findMany({
          where: { id: { in: claimIds } },
          select: { id: true, text: true }
        })
      : [];

    const labelOf = new Map(claims.map(c => [c.id, c.text || c.id]));

    // Add RA-node with enhanced metadata
    addNode({
      id: RA(arg.id),
      kind: 'RA',
      label: arg.text || `Argument ${arg.id.slice(0, 8)}…`,
      schemeKey: arg.schemeId || null,
      schemeName: schemeName,
      cqStatus: cqStatus,
      dialogueMoveId: arg.createdByMoveId || null,
      locutionType: locutionType,
    });

    // Add conclusion I-node
    if (arg.conclusionClaimId) {
      addNode({
        id: I(arg.conclusionClaimId),
        kind: 'I',
        label: labelOf.get(arg.conclusionClaimId) ?? arg.conclusionClaimId,
      });
      addEdge({
        id: `e:${arg.id}:concl`,
        from: RA(arg.id),
        to: I(arg.conclusionClaimId),
        role: 'conclusion',
      });
    }

    // Add premise I-nodes
    for (const p of arg.premises) {
      addNode({
        id: I(p.claimId),
        kind: 'I',
        label: labelOf.get(p.claimId) ?? p.claimId,
      });
      addEdge({
        id: `e:${arg.id}:prem:${p.claimId}`,
        from: I(p.claimId),
        to: RA(arg.id),
        role: 'premise',
      });
    }

    // Find connected arguments via ArgumentEdges
    const connectedArgs = new Set<string>();

    if (includeSupporting || includeOpposing) {
      const edges = await prisma.argumentEdge.findMany({
        where: {
          deliberationId: arg.deliberationId,
          OR: [
            { fromArgumentId: argId },
            { toArgumentId: argId },
          ]
        },
        select: {
          id: true,
          fromArgumentId: true,
          toArgumentId: true,
          type: true,
        }
      });

      for (const edge of edges) {
        const isOutgoing = edge.fromArgumentId === argId;
        const connectedId = isOutgoing ? edge.toArgumentId : edge.fromArgumentId;
        const edgeType = String(edge.type).toLowerCase();

        // Filter by type
        if (edgeType === 'support' && includeSupporting) {
          connectedArgs.add(connectedId);
        } else if (['rebut', 'undercut', 'undermine'].includes(edgeType) && includeOpposing) {
          connectedArgs.add(connectedId);
        }
      }
    }

    // Add conflicts (CA-nodes)
    if (includeOpposing) {
      // @ts-ignore - Schema types may need regeneration
      const conflicts = await prisma.conflictApplication.findMany({
        where: {
          deliberationId: arg.deliberationId,
          OR: [
            { conflictedArgumentId: argId },
            { conflictingArgumentId: argId },
            { conflictedClaimId: { in: claimIds } },
            { conflictingClaimId: { in: claimIds } },
          ]
        },
        select: {
          id: true,
          schemeId: true,
          conflictingArgumentId: true,
          conflictingClaimId: true,
          conflictedArgumentId: true,
          conflictedClaimId: true,
          legacyAttackType: true,
        }
      });

      for (const c of conflicts) {
        const caId = CA(c.id);
        addNode({
          id: caId,
          kind: 'CA',
          label: c.legacyAttackType ?? 'CA',
          schemeKey: c.legacyAttackType ?? null,
        });

        // Left side (conflicting)
        if (c.conflictingArgumentId) {
          if (!nodeMap.has(RA(c.conflictingArgumentId))) {
            addNode({
              id: RA(c.conflictingArgumentId),
              kind: 'RA',
              label: `Argument ${c.conflictingArgumentId.slice(0, 8)}…`,
            });
          }
          addEdge({
            id: `e:${c.id}:confA`,
            from: RA(c.conflictingArgumentId),
            to: caId,
            role: 'conflictingElement',
          });
          connectedArgs.add(c.conflictingArgumentId);
        } else if (c.conflictingClaimId) {
          if (!nodeMap.has(I(c.conflictingClaimId))) {
            const claim = await prisma.claim.findUnique({
              where: { id: c.conflictingClaimId },
              select: { id: true, text: true }
            });
            if (claim) {
              addNode({
                id: I(claim.id),
                kind: 'I',
                label: claim.text || claim.id,
              });
            }
          }
          addEdge({
            id: `e:${c.id}:confI`,
            from: I(c.conflictingClaimId),
            to: caId,
            role: 'conflictingElement',
          });
        }

        // Right side (conflicted)
        if (c.conflictedArgumentId) {
          addEdge({
            id: `e:${c.id}:tgtA`,
            from: caId,
            to: RA(c.conflictedArgumentId),
            role: 'conflictedElement',
          });
          connectedArgs.add(c.conflictedArgumentId);
        } else if (c.conflictedClaimId) {
          if (!nodeMap.has(I(c.conflictedClaimId))) {
            const claim = await prisma.claim.findUnique({
              where: { id: c.conflictedClaimId },
              select: { id: true, text: true }
            });
            if (claim) {
              addNode({
                id: I(claim.id),
                kind: 'I',
                label: claim.text || claim.id,
              });
            }
          }
          addEdge({
            id: `e:${c.id}:tgtI`,
            from: caId,
            to: I(c.conflictedClaimId),
            role: 'conflictedElement',
          });
        }
      }
    }

    // Add preferences (PA-nodes)
    if (includePreferences) {
      // @ts-ignore - Schema types may need regeneration
      const preferences = await prisma.preferenceApplication.findMany({
        where: {
          deliberationId: arg.deliberationId,
          OR: [
            { preferredArgumentId: argId },
            { dispreferredArgumentId: argId },
            { preferredClaimId: { in: claimIds } },
            { dispreferredClaimId: { in: claimIds } },
          ]
        },
        select: {
          id: true,
          schemeId: true,
          preferredArgumentId: true,
          preferredClaimId: true,
          dispreferredArgumentId: true,
          dispreferredClaimId: true,
        }
      });

      for (const p of preferences) {
        const paId = PA(p.id);
        addNode({
          id: paId,
          kind: 'PA',
          label: 'PA',
          schemeKey: p.schemeId || null,
        });

        // Preferred element
        if (p.preferredArgumentId) {
          if (!nodeMap.has(RA(p.preferredArgumentId))) {
            addNode({
              id: RA(p.preferredArgumentId),
              kind: 'RA',
              label: `Argument ${p.preferredArgumentId.slice(0, 8)}…`,
            });
          }
          addEdge({
            id: `e:${p.id}:prefA`,
            from: RA(p.preferredArgumentId),
            to: paId,
            role: 'preferredElement',
          });
          connectedArgs.add(p.preferredArgumentId);
        } else if (p.preferredClaimId) {
          if (!nodeMap.has(I(p.preferredClaimId))) {
            const claim = await prisma.claim.findUnique({
              where: { id: p.preferredClaimId },
              select: { id: true, text: true }
            });
            if (claim) {
              addNode({
                id: I(claim.id),
                kind: 'I',
                label: claim.text || claim.id,
              });
            }
          }
          addEdge({
            id: `e:${p.id}:prefI`,
            from: I(p.preferredClaimId),
            to: paId,
            role: 'preferredElement',
          });
        }

        // Dispreferred element
        if (p.dispreferredArgumentId) {
          if (!nodeMap.has(RA(p.dispreferredArgumentId))) {
            addNode({
              id: RA(p.dispreferredArgumentId),
              kind: 'RA',
              label: `Argument ${p.dispreferredArgumentId.slice(0, 8)}…`,
            });
          }
          addEdge({
            id: `e:${p.id}:dispA`,
            from: paId,
            to: RA(p.dispreferredArgumentId),
            role: 'dispreferredElement',
          });
          connectedArgs.add(p.dispreferredArgumentId);
        } else if (p.dispreferredClaimId) {
          if (!nodeMap.has(I(p.dispreferredClaimId))) {
            const claim = await prisma.claim.findUnique({
              where: { id: p.dispreferredClaimId },
              select: { id: true, text: true }
            });
            if (claim) {
              addNode({
                id: I(claim.id),
                kind: 'I',
                label: claim.text || claim.id,
              });
            }
          }
          addEdge({
            id: `e:${p.id}:dispI`,
            from: paId,
            to: I(p.dispreferredClaimId),
            role: 'dispreferredElement',
          });
        }
      }
    }

    // Recursively explore connected arguments
    if (currentDepth < depth) {
      for (const nextId of connectedArgs) {
        await explore(nextId, currentDepth + 1);
      }
    }
  }

  // Start exploration from root
  await explore(argumentId, 0);

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

/**
 * Get a summary of the neighborhood without full expansion
 * Useful for showing "X more arguments connected" hints
 */
export async function getNeighborhoodSummary(argumentId: string) {
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { deliberationId: true }
  });

  if (!arg) return null;

  const [supportCount, conflictCount, preferenceCount] = await Promise.all([
    prisma.argumentEdge.count({
      where: {
        deliberationId: arg.deliberationId,
        OR: [
          { fromArgumentId: argumentId, type: 'support' },
          { toArgumentId: argumentId, type: 'support' },
        ]
      }
    }),
    // @ts-ignore - Schema types may need regeneration
    prisma.conflictApplication.count({
      where: {
        deliberationId: arg.deliberationId,
        OR: [
          { conflictingArgumentId: argumentId },
          { conflictedArgumentId: argumentId },
        ]
      }
    // @ts-ignore - Schema types may need regeneration
    }),
    // @ts-ignore - Schema types may need regeneration
    prisma.preferenceApplication.count({
      where: {
        deliberationId: arg.deliberationId,
        OR: [
          { preferredArgumentId: argumentId },
          { dispreferredArgumentId: argumentId },
        ]
      }
    }),
  ]);

  return {
    supportCount,
    conflictCount,
    preferenceCount,
    totalConnections: supportCount + conflictCount + preferenceCount,
  };
}
