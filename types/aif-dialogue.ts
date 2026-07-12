/**
 * Dialogue-Aware AIF Type Definitions
 * 
 * Extended type definitions for Argument Interchange Format (AIF) graphs
 * with dialogue move integration.
 * 
 * @module types/aif-dialogue
 */

import type { DialogueMove, AifNode as PrismaAifNode, AifEdge as PrismaAifEdge } from "@prisma/client";

/**
 * Dialogue metadata stored in AifNode.dialogueMetadata JSON field
 */
export interface DialogueMetadata {
  /** Dialogue move locution (WHY, GROUNDS, CONCEDE, etc.) */
  locution: string;
  
  /** User ID of the speaker */
  speaker: string;
  
  /** Display name of the speaker */
  speakerName: string;
  
  /** ISO 8601 timestamp of the move */
  timestamp: string;
  
  /** ID of the move this replies to (if any) */
  replyToMoveId?: string | null;
  
  /** Illocution type (Question, Argue, Concede, etc.) */
  illocution?: string | null;
  
  /** Additional payload data from DialogueMove */
  payload?: Record<string, any> | null;
}

/**
 * Extended AIF node with dialogue metadata
 * 
 * Includes all standard AIF node fields plus dialogue provenance.
 */
export interface AifNodeWithDialogue extends Omit<PrismaAifNode, "dialogueMetadata"> {
  /** Full dialogue move object (if included in query) */
  dialogueMove?: DialogueMove | null;
  
  /** Parsed dialogue metadata */
  dialogueMetadata?: DialogueMetadata | null;
}

/**
 * Dialogue Move with AIF representation
 * 
 * Links dialogue moves to their visual representation in AIF graphs.
 */
export interface DialogueMoveWithAif extends DialogueMove {
  /** Primary AIF node representing this move (DM-node) */
  aifNode?: AifNodeWithDialogue | null;
  nodeType?: string | null;
  /** AIF nodes created by this move (arguments, etc.) */
  createdAifNodes?: AifNodeWithDialogue[];
  
  /** User/author information */
  author?: {
    id: string;
    username: string;
    displayName?: string | null;
  } | null;
}

/**
 * Edge type for dialogue-aware graphs
 * 
 * Extended edge types to support dialogue move relationships.
 */
export interface DialogueAwareEdge {
  /** Edge ID */
  id: string;
  
  /** Source node ID */
  source: string;
  
  /** Target node ID */
  target: string;
  
  /** Typed edge role */
  edgeType: 
    | "inference"       // Standard AIF: premise/conclusion (I→RA, RA→I)
    | "supports"        // Derived AIF: premise→conclusion claim support (I→I)
    | "conflict"        // Standard AIF: conflicting elements (CA-node edges)
    | "preference"      // Standard AIF: preferred elements
    | "triggers"        // Dialogue: DM-node triggers CQ
    | "answers"         // Dialogue: DM-node answers challenge
    | "commitsTo"       // Dialogue: DM-node commits to claim
    | "repliesTo";      // Dialogue: DM-node replies to DM-node
  
  /** Dialogue move that caused this edge (if any) */
  causedByDialogueMoveId?: string | null;
}

/**
 * Commitment store entry
 * 
 * Maps participant to their committed claims.
 */
export interface CommitmentStore {
  /** Participant user ID */
  participantId: string;
  
  /** List of committed claim IDs */
  claimIds: string[];
}

/**
 * Complete AIF graph with dialogue layer
 * 
 * Includes all nodes, edges, dialogue moves, and commitment stores.
 */
export interface AifGraphWithDialogue {
  /** All AIF nodes (I, RA, CA, PA, DM) */
  nodes: AifNodeWithDialogue[];
  
  /** All AIF edges */
  edges: DialogueAwareEdge[];
  
  /** All dialogue moves in this deliberation */
  dialogueMoves: DialogueMoveWithAif[];
  
  /** Commitment stores per participant */
  commitmentStores: Record<string, string[]>;
  
  /** Graph metadata */
  metadata?: {
    totalNodes: number;
    dmNodeCount: number;
    moveCount: number;
    generatedAt: string;
  };
}

/**
 * Dialogue move provenance for a specific node
 * 
 * Returned by node-specific provenance API.
 */
export interface NodeDialogueProvenance {
  /** Node ID */
  nodeId: string;
  
  /** Dialogue move that created this node */
  createdByMove: DialogueMoveWithAif | null;
  
  /** Dialogue moves that caused edges to/from this node */
  causedByMoves: DialogueMoveWithAif[];
  
  /** Related critical questions (if this is an argument node) */
  relatedCQs?: any[]; // TODO: Type CriticalQuestion
  
  /** Commitment history (if this is a claim node) */
  commitmentHistory?: any[]; // TODO: Type Commitment
}

/**
 * Options for building dialogue-aware graphs
 */
export interface BuildGraphOptions {
  /** Deliberation ID */
  deliberationId: string;
  
  /** Include DM-nodes in graph? */
  includeDialogue: boolean;
  
  /** Filter which dialogue moves to include */
  includeMoves?: "all" | "protocol" | "structural";
  
  /** Filter to specific participant's moves */
  participantFilter?: string;
  
  /** Time range filter */
  timeRange?: {
    start: string; // ISO 8601
    end: string;   // ISO 8601
  };
}

/**
 * Timeline event for dialogue playback
 */
export interface DialogueTimelineEvent {
  /** Event ID (usually move ID) */
  id: string;
  
  /** Event type */
  type: "move" | "argument_created" | "commitment_changed";
  
  /** Timestamp */
  timestamp: string;
  
  /** Associated dialogue move */
  move?: DialogueMoveWithAif;
  
  /** Human-readable description */
  description: string;
  
  /** Affected node IDs */
  affectedNodeIds?: string[];
}

/**
 * Filter options for dialogue visualization
 */
export interface DialogueFilterOptions {
  /** Show only specific participants */
  participants?: string[];
  
  /** Show only specific move types */
  moveTypes?: string[];
  
  /** Time range */
  timeRange?: {
    start: Date;
    end: Date;
  };
  
  /** Show only moves with replies */
  hasReplies?: boolean;
  
  /** Show only moves that created arguments */
  createdArguments?: boolean;
}
