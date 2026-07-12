/**
 * AIF Ontology Extensions for Dialogue Moves
 * 
 * Extends the Argument Interchange Format (AIF) to support dialogue move visualization.
 * Based on AIF+ specification (Reed & Rowe 2007) and formal dialogue game theory.
 * 
 * References:
 * - Reed, C., & Rowe, G. (2007). Araucaria: Software for argument analysis, diagramming and representation.
 * - Prakken, H. (2005). Coherence and flexibility in dialogue games for argumentation.
 * - Walton, D., & Krabbe, E. C. W. (1995). Commitment in dialogue: Basic concepts of interpersonal reasoning.
 * 
 * @module lib/aif/ontology
 */

/**
 * AIF Dialogue Ontology Constants
 * 
 * Defines new node types and edge types for dialogue move integration.
 */
export const AIF_DIALOGUE_ONTOLOGY = {
  // =========================================================================
  // NODE TYPES
  // =========================================================================
  
  /** Base node type for dialogue moves (DM-nodes) */
  DM_NODE: "aif:DialogueMoveNode",
  
  // Subtypes by locution (protocol moves)
  /** WHY move - poses a critical question challenging an argument */
  DM_WHY: "aif:DialogueMove_Why",
  
  /** GROUNDS move - provides support for a claim (creates RA-node) */
  DM_GROUNDS: "aif:DialogueMove_Grounds",
  
  /** CONCEDE move - commits to a proposition */
  DM_CONCEDE: "aif:DialogueMove_Concede",
  
  /** RETRACT move - withdraws a commitment */
  DM_RETRACT: "aif:DialogueMove_Retract",
  
  /** CLOSE move - signals end of dialogue turn */
  DM_CLOSE: "aif:DialogueMove_Close",
  
  /** ACCEPT_ARGUMENT move - accepts opponent's argument */
  DM_ACCEPT: "aif:DialogueMove_Accept",
  
  // Subtypes by locution (structural moves)
  /** THEREFORE move - asserts a claim follows from premises */
  DM_THEREFORE: "aif:DialogueMove_Therefore",
  
  /** SUPPOSE move - introduces a hypothetical assumption */
  DM_SUPPOSE: "aif:DialogueMove_Suppose",
  
  /** DISCHARGE move - closes a hypothetical reasoning context */
  DM_DISCHARGE: "aif:DialogueMove_Discharge",
  
  // =========================================================================
  // EDGE TYPES
  // =========================================================================
  
  /** DM-node triggers a critical question (WHY move → CQ) */
  EDGE_TRIGGERS: "aif:triggers",
  
  /** DM-node answers a challenge (GROUNDS move → Argument) */
  EDGE_ANSWERS: "aif:answers",
  
  /** DM-node commits to a proposition (CONCEDE move → I-node) */
  EDGE_COMMITS_TO: "aif:commitsTo",
  
  /** Any node was caused by a dialogue move (provenance link) */
  EDGE_CAUSED_BY: "aif:causedByDialogueMove",
  
  /** DM-node replies to another DM-node (reply threading) */
  EDGE_REPLIES_TO: "aif:repliesTo",
  
  // Standard AIF edge types (for reference)
  /** Premise supports conclusion (I-node → RA-node) */
  EDGE_PREMISE: "aif:premise",
  
  /** Inference concludes claim (RA-node → I-node) */
  EDGE_CONCLUSION: "aif:conclusion",
  
  /** Conflict relation (CA-node between two RA-nodes) */
  EDGE_CONFLICT: "aif:conflictingElement",
  
  /** Preference relation (PA-node between two RA-nodes) */
  EDGE_PREFERENCE: "aif:preferredElement",
} as const;

export type DmNodeType = typeof AIF_DIALOGUE_ONTOLOGY[keyof typeof AIF_DIALOGUE_ONTOLOGY];

/**
 * AIF Node Kind Enum
 * 
 * Standard AIF node types plus new DM-node type.
 */
export enum AifNodeKind {
  /** Information node - represents a claim/proposition */
  I = "I",
  
  /** Reasoning Application node - represents an inference */
  RA = "RA",
  
  /** Conflict Application node - represents a conflict between arguments */
  CA = "CA",
  
  /** Preference Application node - represents a preference between arguments */
  PA = "PA",
  
  /** Dialogue Move node - represents a protocol action (NEW) */
  DM = "DM",
}

/**
 * Dialogue Move Locution Enum
 * 
 * Maps to DialogueMove.kind field in Prisma schema.
 */
export enum DialogueLocution {
  WHY = "WHY",
  GROUNDS = "GROUNDS",
  CONCEDE = "CONCEDE",
  RETRACT = "RETRACT",
  CLOSE = "CLOSE",
  ACCEPT_ARGUMENT = "ACCEPT_ARGUMENT",
  THEREFORE = "THEREFORE",
  SUPPOSE = "SUPPOSE",
  DISCHARGE = "DISCHARGE",
  ASSERT = "ASSERT", // Legacy, may not need DM-node
}

/**
 * Type guard: Check if node is a DM-node
 * 
 * @param node - Node with a nodeType field
 * @returns True if node is a Dialogue Move node
 * 
 * @example
 * ```ts
 * if (isDmNode(node)) {
 *   console.log("This is a dialogue move:", node.dialogueMetadata);
 * }
 * ```
 */
export function isDmNode(node: { nodeType: string }): boolean {
  return node.nodeType.startsWith("aif:DialogueMove");
}

/**
 * Type guard: Check if node is a standard AIF node (I/RA/CA/PA)
 * 
 * @param node - Node with a nodeType field
 * @returns True if node is a standard AIF node
 */
export function isStandardAifNode(node: { nodeType: string }): boolean {
  return (
    node.nodeType === "aif:I" ||
    node.nodeType === "aif:RA" ||
    node.nodeType === "aif:CA" ||
    node.nodeType === "aif:PA"
  );
}

/**
 * Map DialogueMove.kind to AIF DM-node subtype
 * 
 * Converts Prisma enum to AIF ontology URI.
 * 
 * @param kind - DialogueMove.kind from database
 * @returns AIF DM-node type URI
 * 
 * @example
 * ```ts
 * const nodeType = dialogueKindToAifType("WHY");
 * console.log(nodeType); // "aif:DialogueMove_Why"
 * ```
 */
export function dialogueKindToAifType(kind: string): DmNodeType {
  const mapping: Record<string, DmNodeType> = {
    WHY: AIF_DIALOGUE_ONTOLOGY.DM_WHY,
    GROUNDS: AIF_DIALOGUE_ONTOLOGY.DM_GROUNDS,
    CONCEDE: AIF_DIALOGUE_ONTOLOGY.DM_CONCEDE,
    RETRACT: AIF_DIALOGUE_ONTOLOGY.DM_RETRACT,
    CLOSE: AIF_DIALOGUE_ONTOLOGY.DM_CLOSE,
    ACCEPT_ARGUMENT: AIF_DIALOGUE_ONTOLOGY.DM_ACCEPT,
    THEREFORE: AIF_DIALOGUE_ONTOLOGY.DM_THEREFORE,
    SUPPOSE: AIF_DIALOGUE_ONTOLOGY.DM_SUPPOSE,
    DISCHARGE: AIF_DIALOGUE_ONTOLOGY.DM_DISCHARGE,
  };
  return mapping[kind] || AIF_DIALOGUE_ONTOLOGY.DM_NODE;
}

/**
 * Map AIF DM-node type to human-readable label
 * 
 * @param nodeType - AIF DM-node type URI
 * @returns Human-readable label
 * 
 * @example
 * ```ts
 * const label = aifTypeToLabel("aif:DialogueMove_Why");
 * console.log(label); // "Why?"
 * ```
 */
export function aifTypeToLabel(nodeType: string): string {
  const labelMap: Record<string, string> = {
    [AIF_DIALOGUE_ONTOLOGY.DM_WHY]: "Why?",
    [AIF_DIALOGUE_ONTOLOGY.DM_GROUNDS]: "Grounds",
    [AIF_DIALOGUE_ONTOLOGY.DM_CONCEDE]: "Concede",
    [AIF_DIALOGUE_ONTOLOGY.DM_RETRACT]: "Retract",
    [AIF_DIALOGUE_ONTOLOGY.DM_CLOSE]: "Close",
    [AIF_DIALOGUE_ONTOLOGY.DM_ACCEPT]: "Accept",
    [AIF_DIALOGUE_ONTOLOGY.DM_THEREFORE]: "Therefore",
    [AIF_DIALOGUE_ONTOLOGY.DM_SUPPOSE]: "Suppose",
    [AIF_DIALOGUE_ONTOLOGY.DM_DISCHARGE]: "Discharge",
  };
  return labelMap[nodeType] || nodeType;
}

/**
 * Get dialogue move locution from AIF node type
 * 
 * @param nodeType - AIF DM-node type URI
 * @returns Dialogue move locution
 * 
 * @example
 * ```ts
 * const locution = aifTypeToLocution("aif:DialogueMove_Why");
 * console.log(locution); // "WHY"
 * ```
 */
export function aifTypeToLocution(nodeType: string): DialogueLocution | null {
  const locutionMap: Record<string, DialogueLocution> = {
    [AIF_DIALOGUE_ONTOLOGY.DM_WHY]: DialogueLocution.WHY,
    [AIF_DIALOGUE_ONTOLOGY.DM_GROUNDS]: DialogueLocution.GROUNDS,
    [AIF_DIALOGUE_ONTOLOGY.DM_CONCEDE]: DialogueLocution.CONCEDE,
    [AIF_DIALOGUE_ONTOLOGY.DM_RETRACT]: DialogueLocution.RETRACT,
    [AIF_DIALOGUE_ONTOLOGY.DM_CLOSE]: DialogueLocution.CLOSE,
    [AIF_DIALOGUE_ONTOLOGY.DM_ACCEPT]: DialogueLocution.ACCEPT_ARGUMENT,
    [AIF_DIALOGUE_ONTOLOGY.DM_THEREFORE]: DialogueLocution.THEREFORE,
    [AIF_DIALOGUE_ONTOLOGY.DM_SUPPOSE]: DialogueLocution.SUPPOSE,
    [AIF_DIALOGUE_ONTOLOGY.DM_DISCHARGE]: DialogueLocution.DISCHARGE,
  };
  return locutionMap[nodeType] || null;
}

/**
 * Get color for dialogue move visualization
 * 
 * Returns consistent color codes for each move type.
 * Colors follow semantic conventions from dialogue game theory.
 * 
 * @param locution - Dialogue move locution
 * @returns Hex color code
 * 
 * @example
 * ```ts
 * const color = getDialogueMoveColor("WHY");
 * console.log(color); // "#f59e0b" (amber)
 * ```
 */
export function getDialogueMoveColor(locution: string): string {
  const colorMap: Record<string, string> = {
    WHY: "#f59e0b", // amber-500 (questioning)
    GROUNDS: "#3b82f6", // blue-500 (constructive)
    CONCEDE: "#10b981", // green-500 (accepting)
    RETRACT: "#ef4444", // red-500 (withdrawing)
    CLOSE: "#6b7280", // gray-500 (neutral)
    ACCEPT_ARGUMENT: "#10b981", // green-500 (accepting)
    THEREFORE: "#8b5cf6", // purple-500 (inferential)
    SUPPOSE: "#ec4899", // pink-500 (hypothetical)
    DISCHARGE: "#6366f1", // indigo-500 (closing hypothesis)
  };
  return colorMap[locution] || "#9ca3af"; // gray-400 default
}

/**
 * Get icon for dialogue move visualization
 * 
 * Returns emoji/icon for each move type.
 * 
 * @param locution - Dialogue move locution
 * @returns Icon string (emoji or Unicode symbol)
 */
export function getDialogueMoveIcon(locution: string): string {
  const iconMap: Record<string, string> = {
    WHY: "❓",
    GROUNDS: "💬",
    CONCEDE: "✅",
    RETRACT: "❌",
    CLOSE: "🔚",
    ACCEPT_ARGUMENT: "👍",
    THEREFORE: "∴",
    SUPPOSE: "💭",
    DISCHARGE: "⊢",
  };
  return iconMap[locution] || "•";
}
