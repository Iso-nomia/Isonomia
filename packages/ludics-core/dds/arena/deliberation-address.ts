/**
 * Deliberation Address Tree Builder
 * 
 * Maps deliberation structure (Arguments, Claims, Edges) to ludic addresses.
 * 
 * Based on the theoretical framework from:
 * - Girard's ludics (addresses as positions in interaction)
 * - Faggian-Hyland (universal arena structure)
 * - Fouqueré-Quatrini (dialogue acts)
 * 
 * ## Address Mapping Strategy
 * 
 * The deliberation model organizes argumentation as:
 * - Claims: propositions (I-nodes in AIF)
 * - Arguments: inference from premises to conclusion (RA-nodes)
 * - ArgumentEdge: attacks between arguments (CA-nodes)
 * - ClaimEdge: direct support/rebut between claims
 * 
 * We map this to ludic addresses where:
 * - Root claim(s) → address []
 * - Arguments for/against root → [0], [1], [2], ...
 * - Counter-arguments → [0,0], [0,1], ...
 * - Polarity alternates: even depth = P (Proponent), odd depth = O (Opponent)
 * 
 * @module
 */

import {
  LudicAddress,
  ArenaPositionTheory,
  addressToKey,
  polarityAtAddress,
} from "../types/ludics-theory";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Node in the address tree
 */
export interface AddressTreeNode {
  /** The ludic address for this node */
  address: LudicAddress;
  
  /** Type of deliberation element */
  elementType: "claim" | "argument" | "premise";
  
  /** ID of the source element (Claim or Argument) */
  sourceId: string;
  
  /** Text content for display */
  content: string;
  
  /** Type for arena position */
  positionType: "claim" | "support" | "attack" | "question" | "premise";
  
  /** Child node addresses */
  children: LudicAddress[];
  
  /** Parent node address (null for root) */
  parent: LudicAddress | null;
  
  /** Additional metadata */
  metadata?: {
    schemeId?: string;
    attackType?: string;
    isImplicit?: boolean;
    isAxiom?: boolean;
  };
}

/**
 * The complete address tree for a deliberation
 */
export interface AddressTree {
  /** Map from address key to node */
  nodes: Map<string, AddressTreeNode>;
  
  /** Root addresses (multiple if deliberation has multiple focal claims) */
  roots: LudicAddress[];
  
  /** Deliberation ID */
  deliberationId: string;
  
  /** Build timestamp */
  builtAt: Date;
}

/**
 * Input types from Prisma query
 */
export interface ClaimInput {
  id: string;
  text: string;
  deliberationId?: string | null;
  edgesFrom?: Array<{ toClaimId: string; type: string }>;
  edgesTo?: Array<{ fromClaimId: string; type: string }>;
  asConclusion?: Array<{ id: string }>;
  asPremiseOf?: Array<{ argumentId: string }>;
}

export interface ArgumentPremiseInput {
  argumentId: string;
  claimId: string;
  isImplicit: boolean;
  isAxiom?: boolean;
  claim?: ClaimInput;
}

export interface ArgumentInput {
  id: string;
  text: string;
  deliberationId: string;
  conclusionClaimId?: string | null;
  conclusion?: ClaimInput | null;
  premises?: ArgumentPremiseInput[];
  outgoingEdges?: ArgumentEdgeInput[];
  incomingEdges?: ArgumentEdgeInput[];
  schemeId?: string | null;
}

export interface ArgumentEdgeInput {
  id: string;
  fromArgumentId: string;
  toArgumentId: string;
  type: string;
  attackType?: string | null;
  targetScope?: string;
  targetPremiseId?: string | null;
}

export interface ClaimEdgeInput {
  id: string;
  fromClaimId: string;
  toClaimId: string;
  type: string;
}

export interface DeliberationInput {
  id: string;
  arguments: ArgumentInput[];
  Claim?: ClaimInput[];
  edges?: ArgumentEdgeInput[];
  ClaimEdge?: ClaimEdgeInput[];
}

// ============================================================================
// TREE BUILDING
// ============================================================================

/**
 * Build address tree from deliberation structure
 * 
 * Algorithm:
 * 1. Find root claims (claims not concluded by any argument that's attacked)
 * 2. Traverse depth-first, assigning addresses
 * 3. For each element, find children (attacks/supports) and recurse
 */
export function buildAddressTree(
  deliberation: DeliberationInput,
  options?: {
    rootClaimId?: string;
    maxDepth?: number;
  }
): AddressTree {
  const nodes = new Map<string, AddressTreeNode>();
  const roots: LudicAddress[] = [];
  const maxDepth = options?.maxDepth ?? 10;
  
  // Index structures for efficient lookup
  const argumentById = new Map<string, ArgumentInput>();
  const claimById = new Map<string, ClaimInput>();
  const argumentsByConclusion = new Map<string, ArgumentInput[]>();
  const attacksOnArgument = new Map<string, ArgumentEdgeInput[]>();
  
  // Build indices
  for (const arg of deliberation.arguments) {
    argumentById.set(arg.id, arg);
    
    if (arg.conclusionClaimId) {
      const existing = argumentsByConclusion.get(arg.conclusionClaimId) || [];
      existing.push(arg);
      argumentsByConclusion.set(arg.conclusionClaimId, existing);
    }
    
    // Index incoming attacks
    for (const edge of arg.incomingEdges || []) {
      const existing = attacksOnArgument.get(arg.id) || [];
      existing.push(edge);
      attacksOnArgument.set(arg.id, existing);
    }
  }
  
  for (const claim of deliberation.Claim || []) {
    claimById.set(claim.id, claim);
  }
  
  // Find root claims
  const rootClaims = findRootClaims(deliberation, {
    argumentsByConclusion,
    claimById,
    specifiedRootId: options?.rootClaimId,
  });
  
  // Build tree from each root
  let rootIndex = 0;
  for (const rootClaim of rootClaims) {
    const rootAddress: LudicAddress = rootClaims.length > 1 ? [rootIndex] : [];
    
    addClaimNode(
      nodes,
      rootClaim,
      rootAddress,
      null,
      "claim",
      {
        argumentsByConclusion,
        attacksOnArgument,
        argumentById,
        claimById,
        maxDepth,
        visited: new Set<string>(),
      }
    );
    
    roots.push(rootAddress);
    rootIndex++;
  }
  
  return {
    nodes,
    roots,
    deliberationId: deliberation.id,
    builtAt: new Date(),
  };
}

/**
 * Find root claims in the deliberation
 * 
 * Root claims are:
 * 1. If specified, use that claim
 * 2. Otherwise, claims that are conclusions but not attacked
 * 3. Or claims with no incoming edges
 */
export function findRootClaims(
  deliberation: DeliberationInput,
  context: {
    argumentsByConclusion: Map<string, ArgumentInput[]>;
    claimById: Map<string, ClaimInput>;
    specifiedRootId?: string;
  }
): ClaimInput[] {
  const { argumentsByConclusion, claimById, specifiedRootId } = context;
  
  // If root specified, use it
  if (specifiedRootId) {
    const claim = claimById.get(specifiedRootId);
    if (claim) return [claim];
  }
  
  // Find claims that are conclusions of arguments
  const conclusionClaimIds = new Set<string>();
  for (const arg of deliberation.arguments) {
    if (arg.conclusionClaimId) {
      conclusionClaimIds.add(arg.conclusionClaimId);
    }
  }
  
  // Find claims that are attacked (have incoming argument edges via their arguments)
  const attackedClaimIds = new Set<string>();
  for (const arg of deliberation.arguments) {
    if (arg.incomingEdges && arg.incomingEdges.length > 0 && arg.conclusionClaimId) {
      attackedClaimIds.add(arg.conclusionClaimId);
    }
  }
  
  // Root candidates: conclusions that aren't attacked, or have arguments but aren't premises
  const roots: ClaimInput[] = [];
  
  for (const claim of deliberation.Claim || []) {
    // Check if this claim is a conclusion
    const isConclusion = conclusionClaimIds.has(claim.id);
    
    // Check if it has arguments supporting it
    const hasArguments = argumentsByConclusion.has(claim.id);
    
    // Check if it's attacked
    const isAttacked = attackedClaimIds.has(claim.id);
    
    // Check if it's primarily used as a premise (not standalone)
    const isPremise = claim.asPremiseOf && claim.asPremiseOf.length > 0;
    
    // Heuristic: Good roots are conclusions with arguments that aren't heavily attacked
    // or claims that stand alone (not premises)
    if (isConclusion && hasArguments && !isPremise) {
      roots.push(claim);
    } else if (!isPremise && !isConclusion && !isAttacked) {
      // Standalone claim with no incoming edges
      roots.push(claim);
    }
  }
  
  // If no roots found, use first argument's conclusion or first claim
  if (roots.length === 0) {
    if (deliberation.arguments.length > 0) {
      const firstArg = deliberation.arguments[0];
      if (firstArg.conclusion) {
        roots.push(firstArg.conclusion);
      } else if (firstArg.conclusionClaimId) {
        const claim = claimById.get(firstArg.conclusionClaimId);
        if (claim) roots.push(claim);
      }
    } else if (deliberation.Claim && deliberation.Claim.length > 0) {
      roots.push(deliberation.Claim[0]);
    }
  }
  
  return roots;
}

// ============================================================================
// NODE ADDITION HELPERS
// ============================================================================

interface BuildContext {
  argumentsByConclusion: Map<string, ArgumentInput[]>;
  attacksOnArgument: Map<string, ArgumentEdgeInput[]>;
  argumentById: Map<string, ArgumentInput>;
  claimById: Map<string, ClaimInput>;
  maxDepth: number;
  visited: Set<string>;
}

/**
 * Add a claim node to the tree
 */
function addClaimNode(
  nodes: Map<string, AddressTreeNode>,
  claim: ClaimInput,
  address: LudicAddress,
  parent: LudicAddress | null,
  positionType: "claim" | "support" | "attack" | "question" | "premise",
  context: BuildContext
): void {
  if (context.visited.has(`claim:${claim.id}`)) return;
  if (address.length > context.maxDepth) return;
  
  context.visited.add(`claim:${claim.id}`);
  
  const node: AddressTreeNode = {
    address,
    elementType: "claim",
    sourceId: claim.id,
    content: claim.text,
    positionType,
    children: [],
    parent,
  };
  
  nodes.set(addressToKey(address), node);
  
  // Find arguments that conclude this claim (supports for this claim)
  const supportingArgs = context.argumentsByConclusion.get(claim.id) || [];
  let childIndex = 0;
  
  for (const arg of supportingArgs) {
    const childAddress: LudicAddress = [...address, childIndex];
    node.children.push(childAddress);
    
    addArgumentNode(
      nodes,
      arg,
      childAddress,
      address,
      "support",
      context
    );
    
    childIndex++;
  }
}

/**
 * Add an argument node to the tree
 */
function addArgumentNode(
  nodes: Map<string, AddressTreeNode>,
  argument: ArgumentInput,
  address: LudicAddress,
  parent: LudicAddress | null,
  positionType: "claim" | "support" | "attack" | "question" | "premise",
  context: BuildContext
): void {
  if (context.visited.has(`arg:${argument.id}`)) return;
  if (address.length > context.maxDepth) return;
  
  context.visited.add(`arg:${argument.id}`);
  
  const node: AddressTreeNode = {
    address,
    elementType: "argument",
    sourceId: argument.id,
    content: argument.text,
    positionType,
    children: [],
    parent,
    metadata: {
      schemeId: argument.schemeId ?? undefined,
    },
  };
  
  nodes.set(addressToKey(address), node);
  
  let childIndex = 0;
  
  // Add attacking arguments as children
  const attacks = context.attacksOnArgument.get(argument.id) || [];
  for (const edge of attacks) {
    const attackingArg = context.argumentById.get(edge.fromArgumentId);
    if (!attackingArg) continue;
    
    const childAddress: LudicAddress = [...address, childIndex];
    node.children.push(childAddress);
    
    addArgumentNode(
      nodes,
      attackingArg,
      childAddress,
      address,
      "attack",
      {
        ...context,
        // Track attack metadata
      }
    );
    
    // Store attack type in child node after creation
    const childNode = nodes.get(addressToKey(childAddress));
    if (childNode) {
      childNode.metadata = {
        ...childNode.metadata,
        attackType: edge.attackType ?? edge.type,
      };
    }
    
    childIndex++;
  }
  
  // Add premises as potential challenge points (for undermining attacks)
  for (const premise of argument.premises || []) {
    if (premise.isAxiom) continue; // Axioms can't be undermined
    
    const premiseClaim = premise.claim || context.claimById.get(premise.claimId);
    if (!premiseClaim) continue;
    
    const childAddress: LudicAddress = [...address, childIndex];
    node.children.push(childAddress);
    
    const premiseNode: AddressTreeNode = {
      address: childAddress,
      elementType: "premise",
      sourceId: premiseClaim.id,
      content: premiseClaim.text,
      positionType: "premise",
      children: [],
      parent: address,
      metadata: {
        isImplicit: premise.isImplicit,
        isAxiom: premise.isAxiom ?? false,
      },
    };
    
    nodes.set(addressToKey(childAddress), premiseNode);
    childIndex++;
  }
}

// ============================================================================
// TREE QUERY UTILITIES
// ============================================================================

/**
 * Get all addresses in the tree
 */
export function getAllAddresses(tree: AddressTree): LudicAddress[] {
  return Array.from(tree.nodes.values()).map((node) => node.address);
}

/**
 * Get node at address
 */
export function getNodeAtAddress(
  tree: AddressTree,
  address: LudicAddress
): AddressTreeNode | undefined {
  return tree.nodes.get(addressToKey(address));
}

/**
 * Get children of a node
 */
export function getChildNodes(
  tree: AddressTree,
  address: LudicAddress
): AddressTreeNode[] {
  const node = tree.nodes.get(addressToKey(address));
  if (!node) return [];
  
  return node.children
    .map((childAddr) => tree.nodes.get(addressToKey(childAddr)))
    .filter((n): n is AddressTreeNode => n !== undefined);
}

/**
 * Get parent node
 */
export function getParentNode(
  tree: AddressTree,
  address: LudicAddress
): AddressTreeNode | undefined {
  const node = tree.nodes.get(addressToKey(address));
  if (!node || !node.parent) return undefined;
  
  return tree.nodes.get(addressToKey(node.parent));
}

/**
 * Check if address is a leaf (no children)
 */
export function isLeaf(tree: AddressTree, address: LudicAddress): boolean {
  const node = tree.nodes.get(addressToKey(address));
  return node ? node.children.length === 0 : true;
}

/**
 * Get depth of address (length)
 */
export function getDepth(address: LudicAddress): number {
  return address.length;
}

/**
 * Get maximum depth in tree
 */
export function getMaxDepth(tree: AddressTree): number {
  let maxDepth = 0;
  for (const node of Array.from(tree.nodes.values())) {
    if (node.address.length > maxDepth) {
      maxDepth = node.address.length;
    }
  }
  return maxDepth;
}

// ============================================================================
// CONVERSION TO ARENA POSITIONS
// ============================================================================

/**
 * Convert address tree to arena positions map
 */
export function treeToPositions(tree: AddressTree): Map<string, ArenaPositionTheory> {
  const positions = new Map<string, ArenaPositionTheory>();
  
  for (const [key, node] of Array.from(tree.nodes.entries())) {
    // Compute ramification from children
    const ramification = node.children.map(
      (childAddr) => childAddr[childAddr.length - 1]
    );
    
    // Determine polarity from address depth
    const polarity = polarityAtAddress(node.address);
    
    const position: ArenaPositionTheory = {
      address: node.address,
      content: node.content,
      type: node.positionType,
      ramification,
      polarity,
      sourceId: node.sourceId,
      sourceType: node.elementType === "premise" ? "claim" : node.elementType,
    };
    
    positions.set(key, position);
  }
  
  return positions;
}

/**
 * Convert position type string to theory type
 */
export function mapPositionType(
  type: string
): "claim" | "support" | "attack" | "question" {
  switch (type) {
    case "support":
    case "argue":
      return "support";
    case "attack":
    case "challenge":
    case "rebut":
      return "attack";
    case "question":
    case "query":
      return "question";
    default:
      return "claim";
  }
}
