// packages/ludics-engine/scopeTraces.ts
/**
 * Scope-Level Trace Computation
 * 
 * Computes interaction traces independently for each scope,
 * detecting cross-scope interactions and independent convergence.
 */

import { prisma } from '@/lib/prismaclient';
import { stepInteraction } from './stepper';
import type { StepResult } from 'packages/ludics-core/types';

export interface ScopeTraceResult {
  scope: string | null;
  scopeType: string | null;
  scopeMetadata: any;
  proponentDesignId: string;
  opponentDesignId: string;
  trace: StepResult;
  convergenceStatus: 'CONVERGENT' | 'DIVERGENT' | 'STUCK' | 'INCOMPLETE';
  interactionDepth: number;
  crossScopeRefs: string[]; // Other scopes referenced in this trace
  decisivePairs: number; // Count of pairs in explain-why chain
}

export interface ForestTraceResult {
  deliberationId: string;
  scopingStrategy: string;
  scopes: Map<string, ScopeTraceResult>;
  globalMetrics: {
    totalScopes: number;
    convergentScopes: number;
    divergentScopes: number;
    stuckScopes: number;
    incompleteScopes: number;
    crossScopeInteractions: number;
  };
}

/**
 * Compute trace for a single scope
 */
export async function computeScopeTrace(
  deliberationId: string,
  proponentDesignId: string,
  opponentDesignId: string
): Promise<ScopeTraceResult> {
  // Fetch design info
  const [pDesign, oDesign] = await Promise.all([
    prisma.ludicDesign.findUnique({
      where: { id: proponentDesignId },
      select: {
        id: true,
        scope: true,
        scopeType: true,
        scopeMetadata: true,
        referencedScopes: true
      }
    }),
    prisma.ludicDesign.findUnique({
      where: { id: opponentDesignId },
      select: {
        id: true,
        scope: true,
        scopeType: true,
        scopeMetadata: true,
        referencedScopes: true
      }
    })
  ]);
  
  if (!pDesign || !oDesign) {
    throw new Error(`Designs not found: P=${proponentDesignId}, O=${opponentDesignId}`);
  }
  
  // Run stepper to get interaction trace
  const trace = await stepInteraction({
    dialogueId: deliberationId,
    posDesignId: proponentDesignId,
    negDesignId: opponentDesignId,
    maxPairs: 10000,
    phase: 'neutral'
  });
  
  // Determine convergence status
  let convergenceStatus: ScopeTraceResult['convergenceStatus'] = 'INCOMPLETE';
  
  if (trace.status === 'CONVERGENT') {
    convergenceStatus = 'CONVERGENT';
  } else if (trace.status === 'DIVERGENT') {
    convergenceStatus = 'DIVERGENT';
  } else if (trace.status === 'STUCK') {
    convergenceStatus = 'STUCK';
  }
  
  // Calculate interaction depth (max locus depth in trace)
  const interactionDepth = trace.pairs
    ? Math.max(...trace.pairs.map((p: any) => {
        const locusPath = p.locusPath ?? '0';
        return locusPath.split('.').length - 1;
      }), 0)
    : 0;
  
  // Identify cross-scope references
  const crossScopeRefs = Array.from(new Set([
    ...(pDesign.referencedScopes || []),
    ...(oDesign.referencedScopes || [])
  ]));
  
  // Count decisive pairs
  const decisivePairs = trace.decisiveIndices?.length ?? 0;
  
  return {
    scope: pDesign.scope,
    scopeType: pDesign.scopeType,
    scopeMetadata: pDesign.scopeMetadata,
    proponentDesignId: pDesign.id,
    opponentDesignId: oDesign.id,
    trace,
    convergenceStatus,
    interactionDepth,
    crossScopeRefs,
    decisivePairs
  };
}

/**
 * Compute traces for all scopes in a deliberation (forest view)
 */
export async function computeForestTraces(
  deliberationId: string
): Promise<ForestTraceResult> {
  // Fetch all designs for this deliberation
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    select: {
      id: true,
      participantId: true,
      scope: true,
      scopeType: true,
      scopeMetadata: true,
      referencedScopes: true
    },
    orderBy: [
      { scope: 'asc' },
      { participantId: 'asc' }
    ]
  });
  
  if (designs.length === 0) {
    throw new Error(`No designs found for deliberation ${deliberationId}`);
  }
  
  // Determine scoping strategy from first design
  const scopingStrategy = designs[0].scopeType ?? 'legacy';
  
  // Group by scope
  const designsByScope = new Map<string, typeof designs>();
  for (const design of designs) {
    const scopeKey = design.scope ?? 'legacy';
    if (!designsByScope.has(scopeKey)) {
      designsByScope.set(scopeKey, []);
    }
    designsByScope.get(scopeKey)!.push(design);
  }
  
  // Compute traces for each scope
  const scopes = new Map<string, ScopeTraceResult>();
  
  for (const [scopeKey, scopeDesigns] of designsByScope.entries()) {
    const P = scopeDesigns.find(d => d.participantId === 'Proponent');
    const O = scopeDesigns.find(d => d.participantId === 'Opponent');
    
    if (P && O) {
      try {
        const scopeTrace = await computeScopeTrace(deliberationId, P.id, O.id);
        scopes.set(scopeKey, scopeTrace);
      } catch (err) {
        console.error(`[scopeTraces] Failed to compute trace for scope ${scopeKey}:`, err);
        // Add error scope result
        scopes.set(scopeKey, {
          scope: P.scope,
          scopeType: P.scopeType,
          scopeMetadata: P.scopeMetadata,
          proponentDesignId: P.id,
          opponentDesignId: O.id,
          trace: { status: 'ERROR', pairs: [], message: String(err) } as any,
          convergenceStatus: 'STUCK',
          interactionDepth: 0,
          crossScopeRefs: [],
          decisivePairs: 0
        });
      }
    }
  }
  
  // Compute global metrics
  const totalScopes = scopes.size;
  let convergentScopes = 0;
  let divergentScopes = 0;
  let stuckScopes = 0;
  let incompleteScopes = 0;
  const crossScopeInteractionSet = new Set<string>();
  
  for (const scopeTrace of scopes.values()) {
    switch (scopeTrace.convergenceStatus) {
      case 'CONVERGENT':
        convergentScopes++;
        break;
      case 'DIVERGENT':
        divergentScopes++;
        break;
      case 'STUCK':
        stuckScopes++;
        break;
      case 'INCOMPLETE':
        incompleteScopes++;
        break;
    }
    
    // Track cross-scope interactions
    for (const refScope of scopeTrace.crossScopeRefs) {
      const key = [scopeTrace.scope, refScope].sort().join('→');
      crossScopeInteractionSet.add(key);
    }
  }
  
  return {
    deliberationId,
    scopingStrategy,
    scopes,
    globalMetrics: {
      totalScopes,
      convergentScopes,
      divergentScopes,
      stuckScopes,
      incompleteScopes,
      crossScopeInteractions: crossScopeInteractionSet.size
    }
  };
}

/**
 * Find cross-scope interaction chains
 * Returns pairs of scopes that reference each other
 */
export function findCrossScopeChains(
  forest: ForestTraceResult
): Array<{ from: string; to: string; bidirectional: boolean }> {
  const chains: Array<{ from: string; to: string; bidirectional: boolean }> = [];
  const seen = new Set<string>();
  
  for (const [scopeKey, scopeTrace] of forest.scopes.entries()) {
    for (const refScope of scopeTrace.crossScopeRefs) {
      const key = [scopeKey, refScope].sort().join('→');
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Check if bidirectional
      const reverseTrace = forest.scopes.get(refScope);
      const bidirectional = reverseTrace?.crossScopeRefs.includes(scopeKey) ?? false;
      
      chains.push({
        from: scopeKey,
        to: refScope,
        bidirectional
      });
    }
  }
  
  return chains;
}

/**
 * Get convergence summary by scope
 */
export function getScopeSummaries(forest: ForestTraceResult): Map<string, {
  scope: string | null;
  label: string;
  status: string;
  depth: number;
  pairsCount: number;
  decisivePairs: number;
  crossRefs: number;
}> {
  const summaries = new Map();
  
  for (const [scopeKey, scopeTrace] of forest.scopes.entries()) {
    const metadata = scopeTrace.scopeMetadata as any;
    const label = metadata?.label ?? scopeKey;
    
    summaries.set(scopeKey, {
      scope: scopeTrace.scope,
      label,
      status: scopeTrace.convergenceStatus,
      depth: scopeTrace.interactionDepth,
      pairsCount: scopeTrace.trace.pairs?.length ?? 0,
      decisivePairs: scopeTrace.decisivePairs,
      crossRefs: scopeTrace.crossScopeRefs.length
    });
  }
  
  return summaries;
}
