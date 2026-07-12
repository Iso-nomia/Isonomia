/**
 * orchestrator/translators/chain-mint.ts
 *
 * Phase-6 translator: posts a `ChainArchitectPlan` to the platform via
 * the `IsonomiaClient.createArgumentChain` / `addChainNode` /
 * `addChainEdge` APIs. Authentication uses the **methodologist** agent's
 * bearer token (the existing provisioned platform user with the most
 * cross-cutting structural mandate; the synthesist is a logical role
 * with no provisioned platform identity).
 *
 * Per-chain pipeline:
 *   1. POST /api/argument-chains          → chainId
 *   2. For each node: POST /api/argument-chains/{chainId}/nodes
 *      → nodeId; build per-chain `argumentId → nodeId` lookup map.
 *   3. For each edge: resolve sourceNodeId / targetNodeId via the lookup
 *      map; POST /api/argument-chains/{chainId}/edges → edgeId.
 *
 * Soft-degrade: per-node and per-edge failures are caught individually
 * and logged as `chain_mint_node_skip` / `chain_mint_edge_skip` events;
 * the translator continues with the remaining nodes/edges. A summary
 * `MintReport` is returned to the finalizer for inclusion in
 * PHASE_6_COMPLETE.json + CHAINS.md.
 */

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { RoundLogger } from "../log/round-logger";
import type {
  ChainArchitectPlan,
  SingleChainPlan,
} from "../agents/chain-architect-schema";

const CHAIN_AUTHOR_ROLE = "methodologist";

export interface MintedNodeRecord {
  argumentId: string;
  nodeId: string;
  role: string;
  epistemicStatus: string;
  dialecticalRole: string | null;
}

export interface SkippedNodeRecord {
  argumentId: string;
  reason: string;
  errorMessage: string;
}

export interface MintedEdgeRecord {
  edgeId: string;
  sourceArgumentId: string;
  targetArgumentId: string;
  edgeType: string;
  strength: number;
}

export interface SkippedEdgeRecord {
  sourceArgumentId: string;
  targetArgumentId: string;
  edgeType: string;
  reason: string;
  errorMessage: string;
}

export interface MintedChainRecord {
  hingeIndex: number;
  chainId: string;
  name: string;
  chainType: "TREE";
  nodes: MintedNodeRecord[];
  skippedNodes: SkippedNodeRecord[];
  edges: MintedEdgeRecord[];
  skippedEdges: SkippedEdgeRecord[];
}

export interface MintReport {
  deliberationId: string;
  authorRole: string;
  totals: {
    chainsRequested: number;
    chainsMinted: number;
    nodesRequested: number;
    nodesMinted: number;
    nodesSkipped: number;
    edgesRequested: number;
    edgesMinted: number;
    edgesSkipped: number;
  };
  chains: MintedChainRecord[];
  skippedChains: Array<{ hingeIndex: number; name: string; reason: string; errorMessage: string }>;
}

export interface MintArgumentChainsOpts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  deliberationId: string;
  plan: ChainArchitectPlan;
  logger: RoundLogger;
}

export async function mintArgumentChains(
  opts: MintArgumentChainsOpts,
): Promise<MintReport> {
  const ctx = { role: CHAIN_AUTHOR_ROLE, logger: opts.logger };

  const chains: MintedChainRecord[] = [];
  const skippedChains: MintReport["skippedChains"] = [];

  let nodesRequested = 0;
  let nodesMinted = 0;
  let nodesSkipped = 0;
  let edgesRequested = 0;
  let edgesMinted = 0;
  let edgesSkipped = 0;

  for (const chainPlan of opts.plan.chains) {
    nodesRequested += chainPlan.nodes.length;
    edgesRequested += chainPlan.edges.length;

    let chainId: string;
    try {
      const created = await opts.iso.createArgumentChain(
        {
          deliberationId: opts.deliberationId,
          name: chainPlan.name,
          description: chainPlan.description,
          purpose: chainPlan.purpose,
          chainType: chainPlan.chainType,
          // Orchestrator-minted chains are read-fixtures: every member of the
          // deliberation must be able to load them in the Brief / Essay /
          // Thread views, which gate on `isCreator || isPublic`. The author
          // is a service-agent (methodologist) so we publish-by-default and
          // keep them non-editable to preserve the dialectical record.
          isPublic: true,
          isEditable: false,
        },
        ctx,
      );
      chainId = created.chainId;
      opts.logger.event("chain_mint_chain_created", {
        step: "chain-mint",
        chainId,
        hingeIndex: chainPlan.hingeIndex,
        chainType: chainPlan.chainType,
        plannedNodes: chainPlan.nodes.length,
        plannedEdges: chainPlan.edges.length,
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      opts.logger.event("chain_mint_chain_skip", {
        step: "chain-mint",
        hingeIndex: chainPlan.hingeIndex,
        name: chainPlan.name,
        error: msg,
      });
      skippedChains.push({
        hingeIndex: chainPlan.hingeIndex,
        name: chainPlan.name,
        reason: "createArgumentChain failed",
        errorMessage: msg.slice(0, 500),
      });
      // No chainId → cannot mint nodes/edges. Account for them as skipped.
      nodesSkipped += chainPlan.nodes.length;
      edgesSkipped += chainPlan.edges.length;
      continue;
    }

    // 2. Mint nodes; build argumentId → nodeId map.
    const nodeIdByArgumentId = new Map<string, string>();
    const mintedNodes: MintedNodeRecord[] = [];
    const skippedNodes: SkippedNodeRecord[] = [];

    for (const node of chainPlan.nodes) {
      try {
        const { nodeId } = await opts.iso.addChainNode(
          chainId,
          {
            argumentId: node.argumentId,
            role: node.role,
            epistemicStatus: node.epistemicStatus,
            dialecticalRole: node.dialecticalRole,
          },
          ctx,
        );
        nodeIdByArgumentId.set(node.argumentId, nodeId);
        mintedNodes.push({
          argumentId: node.argumentId,
          nodeId,
          role: node.role,
          epistemicStatus: node.epistemicStatus,
          dialecticalRole: node.dialecticalRole ?? null,
        });
        nodesMinted++;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        opts.logger.event("chain_mint_node_skip", {
          step: "chain-mint",
          chainId,
          hingeIndex: chainPlan.hingeIndex,
          argumentId: node.argumentId,
          role: node.role,
          epistemicStatus: node.epistemicStatus,
          error: msg,
        });
        skippedNodes.push({
          argumentId: node.argumentId,
          reason: "addChainNode failed",
          errorMessage: msg.slice(0, 500),
        });
        nodesSkipped++;
      }
    }

    // 3. Mint edges using the lookup map.
    const mintedEdges: MintedEdgeRecord[] = [];
    const skippedEdges: SkippedEdgeRecord[] = [];

    for (const edge of chainPlan.edges) {
      const sourceNodeId = nodeIdByArgumentId.get(edge.sourceArgumentId);
      const targetNodeId = nodeIdByArgumentId.get(edge.targetArgumentId);
      if (!sourceNodeId || !targetNodeId) {
        const reason = !sourceNodeId
          ? `source argumentId ${edge.sourceArgumentId} was not minted`
          : `target argumentId ${edge.targetArgumentId} was not minted`;
        opts.logger.event("chain_mint_edge_skip", {
          step: "chain-mint",
          chainId,
          hingeIndex: chainPlan.hingeIndex,
          sourceArgumentId: edge.sourceArgumentId,
          targetArgumentId: edge.targetArgumentId,
          edgeType: edge.edgeType,
          reason: "missing-node",
          error: reason,
        });
        skippedEdges.push({
          sourceArgumentId: edge.sourceArgumentId,
          targetArgumentId: edge.targetArgumentId,
          edgeType: edge.edgeType,
          reason: "missing-node",
          errorMessage: reason,
        });
        edgesSkipped++;
        continue;
      }
      try {
        const { edgeId } = await opts.iso.addChainEdge(
          chainId,
          {
            sourceNodeId,
            targetNodeId,
            edgeType: edge.edgeType,
            strength: edge.strength,
            description: edge.description,
          },
          ctx,
        );
        mintedEdges.push({
          edgeId,
          sourceArgumentId: edge.sourceArgumentId,
          targetArgumentId: edge.targetArgumentId,
          edgeType: edge.edgeType,
          strength: edge.strength,
        });
        edgesMinted++;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        opts.logger.event("chain_mint_edge_skip", {
          step: "chain-mint",
          chainId,
          hingeIndex: chainPlan.hingeIndex,
          sourceArgumentId: edge.sourceArgumentId,
          targetArgumentId: edge.targetArgumentId,
          edgeType: edge.edgeType,
          reason: "addChainEdge failed",
          error: msg,
        });
        skippedEdges.push({
          sourceArgumentId: edge.sourceArgumentId,
          targetArgumentId: edge.targetArgumentId,
          edgeType: edge.edgeType,
          reason: "addChainEdge failed",
          errorMessage: msg.slice(0, 500),
        });
        edgesSkipped++;
      }
    }

    chains.push({
      hingeIndex: chainPlan.hingeIndex,
      chainId,
      name: chainPlan.name,
      chainType: chainPlan.chainType,
      nodes: mintedNodes,
      skippedNodes,
      edges: mintedEdges,
      skippedEdges,
    });
  }

  return {
    deliberationId: opts.deliberationId,
    authorRole: CHAIN_AUTHOR_ROLE,
    totals: {
      chainsRequested: opts.plan.chains.length,
      chainsMinted: chains.length,
      nodesRequested,
      nodesMinted,
      nodesSkipped,
      edgesRequested,
      edgesMinted,
      edgesSkipped,
    },
    chains,
    skippedChains,
  };
}

/** Convenience used by CHAINS.md renderer. */
export function summarizePlan(plan: ChainArchitectPlan): {
  perChain: Array<{
    hingeIndex: number;
    name: string;
    nodeCount: number;
    edgeCount: number;
    statusBreakdown: Record<string, number>;
    edgeTypeBreakdown: Record<string, number>;
  }>;
  totals: { nodes: number; edges: number };
} {
  const perChain = plan.chains.map((c: SingleChainPlan) => {
    const statusBreakdown: Record<string, number> = {};
    for (const n of c.nodes) {
      statusBreakdown[n.epistemicStatus] = (statusBreakdown[n.epistemicStatus] ?? 0) + 1;
    }
    const edgeTypeBreakdown: Record<string, number> = {};
    for (const e of c.edges) {
      edgeTypeBreakdown[e.edgeType] = (edgeTypeBreakdown[e.edgeType] ?? 0) + 1;
    }
    return {
      hingeIndex: c.hingeIndex,
      name: c.name,
      nodeCount: c.nodes.length,
      edgeCount: c.edges.length,
      statusBreakdown,
      edgeTypeBreakdown,
    };
  });
  return {
    perChain,
    totals: {
      nodes: plan.chains.reduce((s, c) => s + c.nodes.length, 0),
      edges: plan.chains.reduce((s, c) => s + c.edges.length, 0),
    },
  };
}
