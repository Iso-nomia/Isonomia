// packages/ludics-engine/defenseTree.ts
/**
 * Defense Tree Analysis for Scoped Ludics Designs
 * 
 * Computes argument structure, depth, and justification chains within a scope.
 * Each scope gets independent defense metrics.
 */

import { prisma } from '@/lib/prismaclient';

export interface DefenseTreeNode {
  actId: string;
  locus: string;
  kind: string;
  polarity: string | null;
  expression: string | null;
  depth: number;
  children: DefenseTreeNode[];
  isJustified: boolean;
  justifiedBy: string[]; // Array of act IDs that justify this node
  challenges: string[]; // Array of act IDs that challenge this node
  metadata: {
    faxed?: boolean;
    hypothetical?: boolean;
    [key: string]: any;
  };
}

export interface DefenseTreeMetrics {
  designId: string;
  scope: string | null;
  maxDepth: number;
  totalActs: number;
  proponentActs: number;
  opponentActs: number;
  justifiedActs: number;
  unjustifiedActs: number;
  faxedActs: number;
  challengeCount: number;
  defenseCount: number;
  convergenceScore: number; // 0-1, based on justified/total ratio
  tree: DefenseTreeNode[];
}

/**
 * Compute defense tree for a single design
 */
export async function computeDefenseTree(designId: string): Promise<DefenseTreeMetrics> {
  const design = await prisma.ludicDesign.findUnique({
    where: { id: designId },
    select: {
      id: true,
      scope: true,
      participantId: true,
      acts: {
        include: { locus: true },
        orderBy: { orderInDesign: 'asc' }
      }
    }
  });
  
  if (!design) {
    throw new Error(`Design ${designId} not found`);
  }
  
  const acts = design.acts;
  
  // Build locus hierarchy
  const actsByLocus = new Map<string, typeof acts[0]>();
  const childrenByLocus = new Map<string, string[]>();
  
  for (const act of acts) {
    const locusPath = act.locus?.path ?? '0';
    actsByLocus.set(locusPath, act);
    
    // Determine parent locus
    const parentLocus = getParentLocus(locusPath);
    if (parentLocus) {
      if (!childrenByLocus.has(parentLocus)) {
        childrenByLocus.set(parentLocus, []);
      }
      childrenByLocus.get(parentLocus)!.push(locusPath);
    }
  }
  
  // Build tree recursively
  const tree: DefenseTreeNode[] = [];
  const justificationMap = new Map<string, string[]>(); // actId -> [justifyingActIds]
  const challengeMap = new Map<string, string[]>(); // actId -> [challengingActIds]
  
  // Analyze justification relationships
  for (const act of acts) {
    const meta = act.metaJson as any;
    
    // Check for justification metadata
    if (meta?.justifiedByLocus) {
      const justifiedBy = actsByLocus.get(meta.justifiedByLocus);
      if (justifiedBy) {
        if (!justificationMap.has(act.id)) {
          justificationMap.set(act.id, []);
        }
        justificationMap.get(act.id)!.push(justifiedBy.id);
      }
    }
    
    // Opponent acts (O polarity) are challenges
    if (act.polarity === 'O') {
      const parentLocus = getParentLocus(act.locus?.path ?? '0');
      if (parentLocus) {
        const parentAct = actsByLocus.get(parentLocus);
        if (parentAct) {
          if (!challengeMap.has(parentAct.id)) {
            challengeMap.set(parentAct.id, []);
          }
          challengeMap.get(parentAct.id)!.push(act.id);
        }
      }
    }
  }
  
  // Build nodes
  const buildNode = (locus: string, depth: number): DefenseTreeNode | null => {
    const act = actsByLocus.get(locus);
    if (!act) return null;
    
    const children = (childrenByLocus.get(locus) ?? [])
      .map(childLocus => buildNode(childLocus, depth + 1))
      .filter((n): n is DefenseTreeNode => n !== null);
    
    const justifiedBy = justificationMap.get(act.id) ?? [];
    const challenges = challengeMap.get(act.id) ?? [];
    const isJustified = justifiedBy.length > 0 || challenges.length === 0;
    
    const meta = act.metaJson as any;
    
    return {
      actId: act.id,
      locus,
      kind: act.kind,
      polarity: act.polarity,
      expression: act.expression,
      depth,
      children,
      isJustified,
      justifiedBy,
      challenges,
      metadata: {
        faxed: meta?.faxed ?? false,
        hypothetical: meta?.hypothetical ?? false,
        ...meta
      }
    };
  };
  
  // Start from root acts (depth 0)
  const rootLoci = acts
    .map(a => a.locus?.path ?? '0')
    .filter(path => !getParentLocus(path) || path === '0')
    .filter((path, idx, arr) => arr.indexOf(path) === idx); // unique
  
  for (const rootLocus of rootLoci) {
    const node = buildNode(rootLocus, 0);
    if (node) tree.push(node);
  }
  
  // Compute metrics
  const maxDepth = Math.max(...acts.map(a => {
    const path = a.locus?.path ?? '0';
    return path.split('.').length - 1;
  }), 0);
  
  const proponentActs = acts.filter(a => a.polarity === 'P').length;
  const opponentActs = acts.filter(a => a.polarity === 'O').length;
  const faxedActs = acts.filter(a => (a.metaJson as any)?.faxed).length;
  
  const justifiedActs = Array.from(justificationMap.keys()).length;
  const unjustifiedActs = acts.length - justifiedActs;
  
  const challengeCount = Array.from(challengeMap.values())
    .reduce((sum, challenges) => sum + challenges.length, 0);
  
  const defenseCount = justifiedActs;
  
  const convergenceScore = acts.length > 0 
    ? justifiedActs / acts.length 
    : 0;
  
  return {
    designId: design.id,
    scope: design.scope,
    maxDepth,
    totalActs: acts.length,
    proponentActs,
    opponentActs,
    justifiedActs,
    unjustifiedActs,
    faxedActs,
    challengeCount,
    defenseCount,
    convergenceScore,
    tree
  };
}

/**
 * Compute defense trees for all designs in a deliberation
 * Grouped by scope
 */
export async function computeDefenseForest(
  deliberationId: string
): Promise<Map<string, { P: DefenseTreeMetrics; O: DefenseTreeMetrics }>> {
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    select: { id: true, scope: true, participantId: true }
  });
  
  const forest = new Map<string, { P: DefenseTreeMetrics; O: DefenseTreeMetrics }>();
  
  // Group by scope
  const designsByScope = new Map<string, typeof designs>();
  for (const design of designs) {
    const scopeKey = design.scope ?? 'legacy';
    if (!designsByScope.has(scopeKey)) {
      designsByScope.set(scopeKey, []);
    }
    designsByScope.get(scopeKey)!.push(design);
  }
  
  // Compute trees for each scope
  for (const [scopeKey, scopeDesigns] of designsByScope.entries()) {
    const P = scopeDesigns.find(d => d.participantId === 'Proponent');
    const O = scopeDesigns.find(d => d.participantId === 'Opponent');
    
    if (P && O) {
      const pTree = await computeDefenseTree(P.id);
      const oTree = await computeDefenseTree(O.id);
      
      forest.set(scopeKey, { P: pTree, O: oTree });
    }
  }
  
  return forest;
}

/**
 * Get parent locus for a given locus path
 * e.g., "0.1.2" -> "0.1", "0.1" -> "0", "0" -> null
 */
function getParentLocus(locus: string): string | null {
  if (locus === '0') return null;
  
  const parts = locus.split('.');
  if (parts.length === 1) return null;
  
  parts.pop();
  return parts.join('.');
}

/**
 * Find critical defense paths - traces from root to justified leaf nodes
 */
export function findCriticalPaths(tree: DefenseTreeNode[]): DefenseTreeNode[][] {
  const paths: DefenseTreeNode[][] = [];
  
  const traverse = (node: DefenseTreeNode, path: DefenseTreeNode[]) => {
    const currentPath = [...path, node];
    
    if (node.children.length === 0) {
      // Leaf node
      if (node.isJustified) {
        paths.push(currentPath);
      }
    } else {
      // Continue to children
      for (const child of node.children) {
        traverse(child, currentPath);
      }
    }
  };
  
  for (const root of tree) {
    traverse(root, []);
  }
  
  return paths;
}

/**
 * Compare defense trees between P and O to find unmatched challenges
 */
export function findUnmatchedChallenges(
  pMetrics: DefenseTreeMetrics,
  oMetrics: DefenseTreeMetrics
): { unopposedP: string[]; unopposedO: string[] } {
  const unopposedP: string[] = [];
  const unopposedO: string[] = [];
  
  // Find P acts with no O challenges
  const traverse = (nodes: DefenseTreeNode[], unopposed: string[]) => {
    for (const node of nodes) {
      if (node.challenges.length === 0 && node.polarity === 'P') {
        unopposed.push(node.actId);
      }
      traverse(node.children, unopposed);
    }
  };
  
  traverse(pMetrics.tree, unopposedP);
  traverse(oMetrics.tree, unopposedO);
  
  return { unopposedP, unopposedO };
}
