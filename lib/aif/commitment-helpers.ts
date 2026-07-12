// lib/aif/commitment-helpers.ts
/**
 * Helper functions for commitment visualization and indicators
 */

import type { AifNodeWithDialogue } from "@/types/aif-dialogue";

export interface CommitmentIndicator {
  claimId: string;
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
  totalActive: number;
  totalRetracted: number;
}

/**
 * Enrich AIF nodes with commitment indicators
 * Maps which claims have commitments and from which participants
 * 
 * @param nodes - AIF nodes to enrich
 * @param commitmentStores - Commitment stores from getCommitmentStores()
 * @returns Nodes with commitment metadata attached
 */
export function enrichNodesWithCommitments(
  nodes: AifNodeWithDialogue[],
  commitmentStores: Array<{
    participantId: string;
    participantName: string;
    commitments: Array<{
      claimId: string;
      claimText: string;
      isActive: boolean;
    }>;
  }>
): Array<AifNodeWithDialogue & { commitmentIndicator?: CommitmentIndicator }> {
  // Guard: If commitmentStores is null, undefined, or not an array, return nodes unchanged
  if (!commitmentStores || !Array.isArray(commitmentStores)) {
    console.warn("[enrichNodesWithCommitments] Invalid commitmentStores, returning nodes unchanged");
    return nodes;
  }

  // Build map: claimId -> participants who committed
  const commitmentMap = new Map<string, CommitmentIndicator>();

  for (const store of commitmentStores) {
    for (const commitment of store.commitments) {
      if (!commitmentMap.has(commitment.claimId)) {
        commitmentMap.set(commitment.claimId, {
          claimId: commitment.claimId,
          participantCount: 0,
          participants: [],
          totalActive: 0,
          totalRetracted: 0,
        });
      }

      const indicator = commitmentMap.get(commitment.claimId)!;
      
      // Check if participant already in list
      const existingParticipant = indicator.participants.find(
        p => p.id === store.participantId
      );

      if (!existingParticipant) {
        indicator.participants.push({
          id: store.participantId,
          name: store.participantName,
          isActive: commitment.isActive,
        });
        indicator.participantCount++;
      } else {
        // Update active status (a participant may have multiple commitments to same claim)
        existingParticipant.isActive = existingParticipant.isActive || commitment.isActive;
      }

      if (commitment.isActive) {
        indicator.totalActive++;
      } else {
        indicator.totalRetracted++;
      }
    }
  }

  // Attach indicators to nodes
  return nodes.map(node => {
    // Extract claim ID from node ID (format: "I:claimId" for I-nodes)
    const claimId = node.nodeKind === "I" && node.id.startsWith("I:")
      ? node.id.substring(2)
      : null;

    if (claimId && commitmentMap.has(claimId)) {
      return {
        ...node,
        commitmentIndicator: commitmentMap.get(claimId),
      };
    }

    return node;
  });
}

/**
 * Get summary of commitment indicators for a deliberation
 * Useful for showing aggregate statistics
 */
export function getCommitmentSummary(
  nodes: Array<AifNodeWithDialogue & { commitmentIndicator?: CommitmentIndicator }>
) {
  const nodesWithCommitments = nodes.filter(n => n.commitmentIndicator);
  const totalCommitments = nodesWithCommitments.reduce(
    (sum, n) => sum + (n.commitmentIndicator?.totalActive || 0),
    0
  );
  const totalParticipants = new Set(
    nodesWithCommitments.flatMap(
      n => n.commitmentIndicator?.participants.map(p => p.id) || []
    )
  ).size;

  return {
    nodesWithCommitments: nodesWithCommitments.length,
    totalCommitments,
    totalParticipants,
    mostCommittedClaim: nodesWithCommitments.sort(
      (a, b) => 
        (b.commitmentIndicator?.participantCount || 0) - 
        (a.commitmentIndicator?.participantCount || 0)
    )[0] || null,
  };
}
