// lib/client/evidential.ts
export type ClaimScore = { id: string; score?: number; bel?: number; pl?: number; accepted?: boolean };

export async function fetchClaimScores(params: {
  deliberationId: string;
  mode: 'min'|'product'|'logodds';
  tau?: number|null;
  claimIds?: string[]; // optional: to limit the set
}) {
  const q = new URLSearchParams({ deliberationId: params.deliberationId, mode: params.mode });
  if (params.tau != null) q.set('tau', String(params.tau));
  if (params.claimIds?.length) q.set('ids', params.claimIds.join(','));

  const r = await fetch(`/api/evidential/score?${q.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return (Array.isArray(j.items) ? j.items : []) as ClaimScore[];
}

/**
 * Response type for hom-set API (materializes hom-sets with confidence scores)
 */
export type HomSetResponse = {
  ok: boolean;
  deliberationId: string;
  mode: 'min' | 'product' | 'logodds';
  support: Record<string, number>; // claimId → confidence score
  hom: Record<string, { args: string[] }>; // "I|claimId" → list of argument IDs
  nodes: Array<{
    id: string;
    text: string;
    score: number;
    topContributors?: Array<{ argumentId: string; contribution: number }>;
  }>;
  arguments: Array<{
    id: string;
    text: string;
    conclusionClaimId: string;
    base?: number;
  }>;
  meta?: {
    claims: number;
    supports: number;
    edges: number;
    conclusions: number;
  };
};

/**
 * Fetch hom-sets (sets of arguments supporting each claim) with confidence scores.
 * 
 * This API materializes the categorical hom-sets hom(A,B) = {arguments from A to B}
 * and computes confidence scores using the specified accrual mode.
 * 
 * @param params - Configuration for hom-set retrieval
 * @param params.deliberationId - The deliberation/room to query
 * @param params.mode - Confidence accrual mode ('min' = weakest-link, 'product' = probabilistic, 'logodds' = weight-of-evidence corroboration)
 * @param params.imports - How to handle imported arguments ('off' = local only, 'materialized' = copied imports, 'virtual' = read-only view, 'all' = both)
 * 
 * @returns Promise resolving to hom-set structure with confidence scores
 * 
 * @example
 * ```typescript
 * const result = await fetchHomSets({
 *   deliberationId: 'room123',
 *   mode: 'product',
 *   imports: 'all'
 * });
 * 
 * // Access hom-set for claim C:
 * const supportingArgs = result.hom['I|claimC'].args; // ['arg1', 'arg2', ...]
 * const confidence = result.support['claimC']; // 0.85
 * ```
 */
export async function fetchHomSets(params: {
  deliberationId: string;
  mode?: 'min' | 'product' | 'logodds';
  imports?: 'off' | 'materialized' | 'virtual' | 'all';
}): Promise<HomSetResponse> {
  const mode = params.mode ?? 'product';
  const imports = params.imports ?? 'off';
  const q = new URLSearchParams({ mode, imports });

  const r = await fetch(
    `/api/deliberations/${params.deliberationId}/evidential?${q.toString()}`,
    { cache: 'no-store' }
  );
  
  if (!r.ok) {
    throw new Error(`Failed to fetch hom-sets: HTTP ${r.status}`);
  }
  
  return r.json();
}

// ============================================================================
// Gap 4: Per-Derivation Assumption Tracking Client Wrappers
// ============================================================================

/**
 * Response type for derivation assumptions
 */
export type DerivationAssumption = {
  id: string;
  derivationId: string;
  assumptionId: string;
  weight: number;
  status: "ACCEPTED" | "CANDIDATE" | "REJECTED";
  inferredFrom: string | null;
  createdAt: string;
  updatedAt: string;
  assumptionUse?: {
    id: string;
    claimId: string;
    claim: {
      text: string;
    };
  };
};

/**
 * Fetch all assumptions for a specific derivation.
 * 
 * @param derivationId - The ID of the derivation (ArgumentSupport)
 * @param includeAll - If true, includes CANDIDATE and REJECTED assumptions (default: false, only ACCEPTED)
 * @returns Promise resolving to array of assumptions with their metadata
 * 
 * @example
 * ```typescript
 * // Get accepted assumptions only
 * const assumptions = await fetchDerivationAssumptions("deriv123");
 * 
 * // Get all assumptions including candidates
 * const allAssumptions = await fetchDerivationAssumptions("deriv123", true);
 * ```
 */
export async function fetchDerivationAssumptions(
  derivationId: string,
  includeAll?: boolean
): Promise<DerivationAssumption[]> {
  const q = new URLSearchParams();
  if (includeAll) q.set("includeAll", "true");

  const r = await fetch(
    `/api/derivations/${derivationId}/assumptions?${q.toString()}`,
    { cache: "no-store" }
  );

  if (!r.ok) {
    throw new Error(`Failed to fetch derivation assumptions: HTTP ${r.status}`);
  }

  const json = await r.json();
  return json.assumptions || [];
}

/**
 * Link an assumption to a derivation (or update existing link).
 * 
 * This operation is idempotent: calling it multiple times with the same
 * assumption and derivation will update the weight instead of creating duplicates.
 * 
 * @param params - Configuration for linking
 * @param params.assumptionId - The ID of the AssumptionUse to link
 * @param params.derivationId - The ID of the derivation (ArgumentSupport)
 * @param params.weight - Confidence weight for this assumption (0.0 to 1.0)
 * @param params.status - Status of the assumption (default: "ACCEPTED")
 * @param params.inferredFrom - Optional: ID of another assumption this was inferred from
 * 
 * @returns Promise resolving to the created/updated DerivationAssumption
 * 
 * @example
 * ```typescript
 * // Link assumption with high confidence
 * const link = await linkAssumptionToDerivation({
 *   assumptionId: "assump123",
 *   derivationId: "deriv456",
 *   weight: 0.9
 * });
 * 
 * // Link transitive assumption
 * const transitive = await linkAssumptionToDerivation({
 *   assumptionId: "assump789",
 *   derivationId: "deriv456",
 *   weight: 0.7,
 *   inferredFrom: "assump123"
 * });
 * ```
 */
export async function linkAssumptionToDerivation(params: {
  assumptionId: string;
  derivationId: string;
  weight: number;
  status?: "ACCEPTED" | "CANDIDATE" | "REJECTED";
  inferredFrom?: string;
}): Promise<DerivationAssumption> {
  const r = await fetch(`/api/assumptions/${params.assumptionId}/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      derivationId: params.derivationId,
      weight: params.weight,
      status: params.status || "ACCEPTED",
      inferredFrom: params.inferredFrom || null,
    }),
  });

  if (!r.ok) {
    const error = await r.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Failed to link assumption: ${error.error || r.statusText}`);
  }

  const json = await r.json();
  return json.link;
}

/**
 * Response type for minimal assumptions
 */
export type MinimalAssumptionsResponse = {
  ok: boolean;
  argumentId: string;
  minimalSet: Array<{
    assumptionId: string;
    assumptionText: string;
    usedByDerivations: string[];
    criticalityScore: number;
  }>;
  meta: {
    totalDerivations: number;
    uniqueAssumptions: number;
  };
};

/**
 * Compute the minimal set of assumptions for an argument.
 * 
 * This identifies which assumptions are most critical by analyzing how many
 * derivations depend on each assumption. Returns assumptions sorted by
 * criticality score (higher = more critical).
 * 
 * @param argumentId - The ID of the argument
 * @returns Promise resolving to minimal assumption set with criticality scores
 * 
 * @example
 * ```typescript
 * const result = await fetchMinimalAssumptions("arg123");
 * 
 * console.log(`Argument has ${result.meta.totalDerivations} derivations`);
 * console.log(`Uses ${result.meta.uniqueAssumptions} assumptions`);
 * 
 * for (const assump of result.minimalSet) {
 *   console.log(`${assump.assumptionText}: ${assump.criticalityScore.toFixed(2)}`);
 * }
 * ```
 */
export async function fetchMinimalAssumptions(
  argumentId: string
): Promise<MinimalAssumptionsResponse> {
  const r = await fetch(`/api/arguments/${argumentId}/minimal-assumptions`, {
    cache: "no-store",
  });

  if (!r.ok) {
    throw new Error(`Failed to fetch minimal assumptions: HTTP ${r.status}`);
  }

  return r.json();
}

/**
 * Response type for assumption dependency graph
 */
export type AssumptionGraphResponse = {
  ok: boolean;
  deliberationId: string;
  nodes: Array<{
    id: string;
    type: "claim" | "argument" | "derivation" | "assumption";
    text?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: "supports" | "uses" | "inferred";
    weight?: number;
  }>;
  meta: {
    claimNodes: number;
    argumentNodes: number;
    derivationNodes: number;
    assumptionNodes: number;
    totalEdges: number;
  };
};

/**
 * Fetch the complete assumption dependency graph for a deliberation.
 * 
 * This returns a graph structure suitable for D3.js visualization showing:
 * - Claims and their supporting arguments
 * - Arguments and their derivations
 * - Derivations and their assumptions
 * - Transitive assumption relationships
 * 
 * @param deliberationId - The ID of the deliberation
 * @returns Promise resolving to graph with nodes and edges
 * 
 * @example
 * ```typescript
 * const graph = await fetchAssumptionGraph("room123");
 * 
 * // Use with D3.js force simulation
 * const simulation = d3.forceSimulation(graph.nodes)
 *   .force("link", d3.forceLink(graph.edges).id(d => d.id))
 *   .force("charge", d3.forceManyBody())
 *   .force("center", d3.forceCenter());
 * ```
 */
export async function fetchAssumptionGraph(
  deliberationId: string
): Promise<AssumptionGraphResponse> {
  const r = await fetch(
    `/api/deliberations/${deliberationId}/assumption-graph`,
    { cache: "no-store" }
  );

  if (!r.ok) {
    throw new Error(`Failed to fetch assumption graph: HTTP ${r.status}`);
  }

  return r.json();
}
