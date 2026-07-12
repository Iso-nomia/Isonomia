/**
 * ArgumentChain to AIF (Argument Interchange Format) Conversion Utilities
 * 
 * Converts ArgumentChain data structures to W3C AIF JSON-LD format for
 * interoperability with other argumentation tools (OVA, Carneades, AIFdb).
 * 
 * AIF Node Types:
 * - I-nodes: Information nodes (claims, premises)
 * - S-nodes: Scheme nodes (argumentation schemes)
 * - RA-nodes: Rule Application nodes (inference steps)
 * 
 * References:
 * - W3C AIF Ontology: http://www.arg.dundee.ac.uk/aif
 * - Mesh AIF Guide: docs/AIF_ONTOLOGY_GUIDE.md
 * - Task 3.8: ARGUMENT_CHAIN_TASK_3.8_COMPLETE.md
 */

import type { ArgumentChainWithRelations, ArgumentChainNodeWithArgument, EpistemicStatus, DialecticalRole, ScopeType } from "@/lib/types/argumentChain";

// ============================================================================
// Type Definitions
// ============================================================================

export interface AifNode {
  nodeID: string;
  text: string;
  type: "I" | "S" | "RA" | "CA" | "PA" | "MA" | "CTX";
  timestamp?: string;
  // Phase 4: Mesh extensions for epistemic/scope data
  "mesh:epistemicStatus"?: EpistemicStatus;
  "mesh:dialecticalRole"?: DialecticalRole | null;
  "mesh:scopeId"?: string | null;
  // Context node specific fields
  "mesh:scopeType"?: ScopeType;
  "mesh:assumption"?: string;
  "mesh:parentScopeId"?: string | null;
  "mesh:color"?: string | null;
}

export interface AifEdge {
  edgeID: string;
  fromID: string;
  toID: string;
  formEdgeID?: string;
}

export interface AifDocument {
  "@context": {
    AIF: string;
    mesh: string;
    [key: string]: string;
  };
  nodes: AifNode[];
  edges: AifEdge[];
  locutions: AifLocution[];
  participants?: AifParticipant[];
  schemeSets?: AifSchemeSet[];
  // Phase 4: Scope contexts
  contexts?: AifScopeContext[];
  metadata?: {
    chainId: string;
    chainName: string;
    chainType?: string;
    createdBy: string;
    createdAt: string;
    exportedAt: string;
    nodeCount: number;
    edgeCount: number;
    // Phase 4: Enhanced metadata
    epistemicBreakdown?: Record<EpistemicStatus, number>;
    scopeCount?: number;
    scopes?: AifScopeMetadata[];
  };
}

// Phase 4: Scope context for AIF export
export interface AifScopeContext {
  contextID: string;
  scopeType: ScopeType;
  assumption: string;
  color?: string | null;
  parentContextID?: string | null;
  nodeCount: number;
}

// Phase 4: Scope metadata summary
export interface AifScopeMetadata {
  id: string;
  type: ScopeType;
  assumption: string;
  nodeCount: number;
  parentId?: string | null;
}

export interface AifLocution {
  nodeID: string;
  personID: string;
  timestamp: string;
}

export interface AifParticipant {
  participantID: string;
  firstname: string;
  surname?: string;
}

export interface AifSchemeSet {
  schemeID: string;
  schemeName: string;
  schemeDescription?: string;
  criticalQuestions?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the best text representation for an argument
 * Falls back through: argument.text → conclusion.text → role placeholder
 */
function getArgumentText(argument: any, role?: string | null): string {
  // First try argument text
  if (argument.text && argument.text.trim() !== "") {
    return argument.text;
  }
  
  // Fall back to conclusion claim text
  if (argument.conclusion?.text && argument.conclusion.text.trim() !== "") {
    return argument.conclusion.text;
  }
  
  // Last resort: use role or placeholder
  if (role) {
    return `[${role}] Untitled argument`;
  }
  
  return "Untitled argument";
}

/**
 * Extract critical questions from a scheme, handling both formats:
 * - Array of strings: ["Question 1", "Question 2"]
 * - Array of objects: [{ text: "Question 1" }, { cqKey: "Q1", text: "Question 2" }]
 */
function extractCriticalQuestions(cq: any): string[] | undefined {
  if (!cq || !Array.isArray(cq) || cq.length === 0) {
    return undefined;
  }
  
  const questions = cq.map((item: any) => {
    if (typeof item === "string") {
      return item;
    }
    if (item && typeof item === "object" && item.text) {
      return item.text;
    }
    return null;
  }).filter((q: string | null): q is string => q !== null && q.trim() !== "");
  
  return questions.length > 0 ? questions : undefined;
}

/**
 * Calculate epistemic status breakdown across all nodes
 * @param nodes - Array of chain nodes
 * @returns Record mapping each status to its count
 */
function calculateEpistemicBreakdown(
  nodes: ArgumentChainNodeWithArgument[]
): Record<EpistemicStatus, number> {
  const breakdown: Record<EpistemicStatus, number> = {
    ASSERTED: 0,
    HYPOTHETICAL: 0,
    COUNTERFACTUAL: 0,
    CONDITIONAL: 0,
    QUESTIONED: 0,
    DENIED: 0,
    SUSPENDED: 0,
  };

  for (const node of nodes) {
    const status = (node as any).epistemicStatus || "ASSERTED";
    if (status in breakdown) {
      breakdown[status as EpistemicStatus]++;
    }
  }

  return breakdown;
}

// ============================================================================
// Main Conversion Function
// ============================================================================

/**
 * Convert ArgumentChain to AIF JSON-LD format
 * 
 * Maps chain structure to AIF node-edge graph:
 * - ChainNodes → I-nodes (information)
 * - Arguments → RA-nodes (reasoning applications)
 * - ChainEdges → AIF edges (connections)
 * - Schemes → S-nodes (scheme references)
 * 
 * @param chain - Full ArgumentChain with relations
 * @returns AIF JSON-LD document
 */
export function convertChainToAif(chain: ArgumentChainWithRelations): AifDocument {
  const nodes: AifNode[] = [];
  const edges: AifEdge[] = [];
  const locutions: AifLocution[] = [];
  const participants = new Map<string, AifParticipant>();
  const schemeSets = new Map<string, AifSchemeSet>();
  const contexts: AifScopeContext[] = [];

  // Track node mappings
  const nodeIdMap = new Map<string, string>(); // ChainNode.id → AIF I-node ID
  const argumentIdMap = new Map<string, string>(); // Argument.id → AIF RA-node ID
  const scopeNodeCounts = new Map<string, number>(); // Scope ID → node count

  // ========================================================================
  // Step 0: Process Scopes into Context nodes (Phase 4)
  // ========================================================================
  
  if (chain.scopes && chain.scopes.length > 0) {
    for (const scope of chain.scopes) {
      const contextId = `CTX_${scope.id}`;
      
      // Count nodes in this scope
      const nodeCount = chain.nodes.filter((n: any) => n.scopeId === scope.id).length;
      scopeNodeCounts.set(scope.id, nodeCount);
      
      // Create context node in the nodes array
      nodes.push({
        nodeID: contextId,
        text: `[${scope.scopeType}] ${scope.assumption}`,
        type: "CTX",
        "mesh:scopeType": scope.scopeType as ScopeType,
        "mesh:assumption": scope.assumption,
        "mesh:parentScopeId": scope.parentScopeId || null,
        "mesh:color": scope.color || null,
      });
      
      // Add to contexts array for structured access
      contexts.push({
        contextID: contextId,
        scopeType: scope.scopeType as ScopeType,
        assumption: scope.assumption,
        color: scope.color || null,
        parentContextID: scope.parentScopeId ? `CTX_${scope.parentScopeId}` : null,
        nodeCount,
      });

      // If this scope has a parent, create an edge linking them
      if (scope.parentScopeId) {
        edges.push({
          edgeID: `E_scope_${scope.id}_parent`,
          fromID: contextId,
          toID: `CTX_${scope.parentScopeId}`,
        });
      }
    }
  }

  // ========================================================================
  // Step 1: Convert ChainNodes to I-nodes (with Phase 4 extensions)
  // ========================================================================
  
  for (const chainNode of chain.nodes) {
    const argument = chainNode.argument;
    
    // Create I-node for the argument's claim/conclusion
    const iNodeId = `I_${chainNode.id}`;
    nodeIdMap.set(chainNode.id, iNodeId);
    
    // Safe date handling
    const nodeTimestamp = chainNode.addedAt
      ? (chainNode.addedAt instanceof Date
          ? chainNode.addedAt.toISOString()
          : new Date(chainNode.addedAt).toISOString())
      : new Date().toISOString();
    
    // Get the best text representation for this argument
    const argumentText = getArgumentText(argument, chainNode.role);
    
    // Phase 4: Extract epistemic status and dialectical role
    const epistemicStatus = (chainNode as any).epistemicStatus || "ASSERTED";
    const dialecticalRole = (chainNode as any).dialecticalRole || null;
    const scopeId = (chainNode as any).scopeId || null;

    nodes.push({
      nodeID: iNodeId,
      text: argumentText,
      type: "I",
      timestamp: nodeTimestamp,
      // Phase 4: Mesh extensions
      "mesh:epistemicStatus": epistemicStatus as EpistemicStatus,
      "mesh:dialecticalRole": dialecticalRole as DialecticalRole | null,
      "mesh:scopeId": scopeId,
    });

    // Phase 4: If node is in a scope, create edge linking I-node to context
    if (scopeId) {
      edges.push({
        edgeID: `E_${iNodeId}_scope`,
        fromID: iNodeId,
        toID: `CTX_${scopeId}`,
      });
    }

    // Create RA-node for the argument's inference
    const raNodeId = `RA_${argument.id}`;
    argumentIdMap.set(argument.id, raNodeId);
    
    const argTimestamp = argument.createdAt
      ? (argument.createdAt instanceof Date
          ? argument.createdAt.toISOString()
          : new Date(argument.createdAt).toISOString())
      : new Date().toISOString();
    
    nodes.push({
      nodeID: raNodeId,
      text: `Application of ${argument.argumentSchemes?.[0]?.scheme?.name || 'reasoning'}`,
      type: "RA",
      timestamp: argTimestamp,
    });

    // Link RA-node to I-node (RA → conclusion)
    edges.push({
      edgeID: `E_${raNodeId}_to_${iNodeId}`,
      fromID: raNodeId,
      toID: iNodeId,
    });

    // Create S-nodes for schemes (if available)
    if (argument.argumentSchemes && argument.argumentSchemes.length > 0) {
      for (const argScheme of argument.argumentSchemes) {
        const scheme = argScheme.scheme;
        if (!scheme) continue;

        const sNodeId = `S_${scheme.id}`;
        
        // Add scheme to schemeSets (unique)
        if (!schemeSets.has(scheme.id)) {
          // Extract critical questions, handling both formats
          const criticalQuestions = extractCriticalQuestions(scheme.cq);
          
          schemeSets.set(scheme.id, {
            schemeID: sNodeId,
            schemeName: scheme.name || scheme.key,
            schemeDescription: scheme.description || scheme.summary || undefined,
            criticalQuestions,
          });

          nodes.push({
            nodeID: sNodeId,
            text: scheme.name || scheme.key,
            type: "S",
          });
        }

        // Link RA-node to S-node (RA uses scheme)
        edges.push({
          edgeID: `E_${raNodeId}_scheme_${sNodeId}`,
          fromID: raNodeId,
          toID: sNodeId,
          formEdgeID: sNodeId, // Indicates scheme application
        });
      }
    }

    // Track locution (who said this argument)
    if (chainNode.contributor) {
      const participantId = `P_${chainNode.contributor.id}`;
      
      if (!participants.has(chainNode.contributor.id.toString())) {
        participants.set(chainNode.contributor.id.toString(), {
          participantID: participantId,
          firstname: chainNode.contributor.name || "Unknown",
          surname: undefined,
        });
      }

      locutions.push({
        nodeID: iNodeId,
        personID: participantId,
        timestamp: nodeTimestamp,
      });
    }
  }

  // ========================================================================
  // Step 2: Convert ChainEdges to AIF edges
  // ========================================================================
  
  for (const chainEdge of chain.edges) {
    const sourceINodeId = nodeIdMap.get(chainEdge.sourceNodeId);
    const targetRANodeId = argumentIdMap.get(
      chain.nodes.find((n: any) => n.id === chainEdge.targetNodeId)?.argument?.id || ""
    );

    if (sourceINodeId && targetRANodeId) {
      // Source I-node → Target RA-node (premise to inference)
      edges.push({
        edgeID: `E_chain_${chainEdge.id}`,
        fromID: sourceINodeId,
        toID: targetRANodeId,
      });
    }
  }

  // ========================================================================
  // Step 3: Build AIF Document
  // ========================================================================

  return {
    "@context": {
      AIF: "http://www.arg.dundee.ac.uk/aif#",
      mesh: "http://mesh-platform.io/ontology/aif#",
      nodeID: "AIF:nodeID",
      text: "AIF:text",
      type: "AIF:type",
      timestamp: "AIF:timestamp",
      fromID: "AIF:fromID",
      toID: "AIF:toID",
      formEdgeID: "AIF:formEdgeID",
      personID: "AIF:personID",
      participantID: "AIF:participantID",
      firstname: "AIF:firstname",
      surname: "AIF:surname",
      schemeID: "AIF:schemeID",
      schemeName: "AIF:schemeName",
      schemeDescription: "AIF:schemeDescription",
      criticalQuestions: "AIF:criticalQuestions",
      // Phase 4: Mesh namespace for epistemic/scope extensions
      "mesh:epistemicStatus": "mesh:epistemicStatus",
      "mesh:dialecticalRole": "mesh:dialecticalRole",
      "mesh:scopeId": "mesh:scopeId",
      "mesh:scopeType": "mesh:scopeType",
      "mesh:assumption": "mesh:assumption",
      "mesh:parentScopeId": "mesh:parentScopeId",
      "mesh:color": "mesh:color",
      contextID: "mesh:contextID",
    },
    nodes,
    edges,
    locutions,
    participants: Array.from(participants.values()),
    schemeSets: Array.from(schemeSets.values()),
    // Phase 4: Include scope contexts
    contexts: contexts.length > 0 ? contexts : undefined,
    metadata: {
      chainId: chain.id,
      chainName: chain.name || "Untitled Chain",
      chainType: chain.chainType || undefined,
      createdBy: chain.createdBy.toString(),
      createdAt: chain.createdAt 
        ? (chain.createdAt instanceof Date 
            ? chain.createdAt.toISOString() 
            : new Date(chain.createdAt).toISOString())
        : new Date().toISOString(),
      exportedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      // Phase 4: Enhanced metadata
      epistemicBreakdown: calculateEpistemicBreakdown(chain.nodes as any[]),
      scopeCount: contexts.length,
      scopes: contexts.length > 0 
        ? contexts.map(ctx => ({
            id: ctx.contextID.replace("CTX_", ""),
            type: ctx.scopeType,
            assumption: ctx.assumption,
            nodeCount: ctx.nodeCount,
            parentId: ctx.parentContextID?.replace("CTX_", "") || null,
          }))
        : undefined,
    },
  };
}

/**
 * Convert ArgumentChain to AIF JSON-LD string
 * 
 * Wrapper around convertChainToAif that returns formatted JSON string
 * suitable for file export or API response.
 * 
 * @param chain - Full ArgumentChain with relations
 * @param pretty - Whether to format with indentation (default: true)
 * @returns JSON string
 */
export function chainToAifJson(
  chain: ArgumentChainWithRelations,
  pretty: boolean = true
): string {
  const aifDoc = convertChainToAif(chain);
  return JSON.stringify(aifDoc, null, pretty ? 2 : 0);
}

/**
 * Convert ArgumentChain to AIF RDF/Turtle format (future extension)
 * 
 * TODO: Implement full RDF/Turtle serialization for deeper AIF compliance
 * Currently returns JSON-LD which is RDF-compatible but not Turtle syntax.
 * 
 * @param chain - Full ArgumentChain with relations
 * @returns RDF/Turtle string
 */
export function chainToAifTurtle(chain: ArgumentChainWithRelations): string {
  // Placeholder: Convert JSON-LD to Turtle syntax
  const aifDoc = convertChainToAif(chain);
  
  // For now, return JSON-LD with note
  return `# AIF JSON-LD Export (Turtle conversion pending)\n# Convert using: jsonld-to-rdf tool\n\n${JSON.stringify(aifDoc, null, 2)}`;
}

/**
 * Validate AIF document structure
 * 
 * Checks that AIF document conforms to basic format requirements:
 * - Has required context
 * - Nodes have unique IDs
 * - Edges reference valid node IDs
 * - Node types are valid AIF types
 * 
 * @param aifDoc - AIF document to validate
 * @returns Validation result with errors
 */
export function validateAifDocument(aifDoc: AifDocument): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check context
  if (!aifDoc["@context"] || !aifDoc["@context"].AIF) {
    errors.push("Missing required @context.AIF");
  }

  // Check node IDs are unique
  const nodeIds = new Set<string>();
  for (const node of aifDoc.nodes) {
    if (nodeIds.has(node.nodeID)) {
      errors.push(`Duplicate node ID: ${node.nodeID}`);
    }
    nodeIds.add(node.nodeID);

    // Check node type (include CTX for Phase 4 context nodes)
    if (!["I", "S", "RA", "CA", "PA", "MA", "CTX"].includes(node.type)) {
      errors.push(`Invalid node type: ${node.type} for node ${node.nodeID}`);
    }

    // Phase 4: Validate epistemic status if present
    if (node["mesh:epistemicStatus"]) {
      const validStatuses = ["ASSERTED", "HYPOTHETICAL", "COUNTERFACTUAL", "CONDITIONAL", "QUESTIONED", "DENIED", "SUSPENDED"];
      if (!validStatuses.includes(node["mesh:epistemicStatus"])) {
        errors.push(`Invalid epistemic status: ${node["mesh:epistemicStatus"]} for node ${node.nodeID}`);
      }
    }

    // Phase 4: Validate dialectical role if present
    if (node["mesh:dialecticalRole"]) {
      const validRoles = ["THESIS", "ANTITHESIS", "SYNTHESIS", "OBJECTION", "RESPONSE", "CONCESSION"];
      if (!validRoles.includes(node["mesh:dialecticalRole"])) {
        errors.push(`Invalid dialectical role: ${node["mesh:dialecticalRole"]} for node ${node.nodeID}`);
      }
    }

    // Phase 4: Validate context nodes have required fields
    if (node.type === "CTX") {
      if (!node["mesh:scopeType"]) {
        errors.push(`Context node ${node.nodeID} missing required mesh:scopeType`);
      }
      if (!node["mesh:assumption"]) {
        errors.push(`Context node ${node.nodeID} missing required mesh:assumption`);
      }
    }
  }

  // Check edges reference valid nodes
  for (const edge of aifDoc.edges) {
    if (!nodeIds.has(edge.fromID)) {
      errors.push(`Edge ${edge.edgeID} references unknown fromID: ${edge.fromID}`);
    }
    if (!nodeIds.has(edge.toID)) {
      errors.push(`Edge ${edge.edgeID} references unknown toID: ${edge.toID}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
