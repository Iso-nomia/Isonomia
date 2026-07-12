//lib/aif/validate.ts
import type { AIFGraph, AnyNode, Edge, EdgeType, NodeType } from './types';

const VALID_EDGE_CONNECTIONS: Record<EdgeType, {from: NodeType[], to: NodeType[]}> = {
  premise: { from: ['I','RA'], to: ['RA','TA'] },
  conclusion: { from: ['RA'], to: ['I'] },
  presumption: { from: ['I'], to: ['RA','TA'] },
  conflicting: { from: ['I'], to: ['CA'] },
  conflicted: { from: ['CA'], to: ['I','RA'] },
  preferred: { from: ['I','RA'], to: ['PA'] },
  dispreferred: { from: ['PA'], to: ['I','RA'] },
  start: { from: ['L'], to: ['TA'] },
  end: { from: ['TA'], to: ['L'] },
};

export function validateEdge(edge: Edge, source: AnyNode, target: AnyNode): string[] {
  const errors: string[] = [];
  if (source.nodeType === 'I' && target.nodeType === 'I') {
    errors.push('I-nodes cannot connect directly.');
  }
  const rule = VALID_EDGE_CONNECTIONS[edge.edgeType];
  if (!rule) {
    errors.push(`Unknown edge type ${edge.edgeType}`);
    return errors;
  }
  if (!rule.from.includes(source.nodeType) || !rule.to.includes(target.nodeType)) {
    errors.push(`Invalid ${edge.edgeType} edge: ${source.nodeType} -> ${target.nodeType}`);
  }
  if (edge.sourceId === edge.targetId) {
    errors.push('Self-loops are not allowed.');
  }
  return errors;
}

export function validateGraph(graph: AIFGraph): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // No I->I edges & type-safe endpoints
  for (const e of graph.edges) {
    const s = graph.nodes.find(n => n.id === e.sourceId);
    const t = graph.nodes.find(n => n.id === e.targetId);
    if (!s || !t) {
      errors.push(`Edge ${e.id} references missing node(s).`);
      continue;
    }
    errors.push(...validateEdge(e, s, t));
  }

  // RA must have exactly one conclusion
  const raNodes = graph.nodes.filter(n => n.nodeType === 'RA');
  for (const ra of raNodes) {
    const outConcls = graph.edges.filter(e => e.sourceId === ra.id && e.edgeType === 'conclusion');
    if (outConcls.length !== 1) {
      errors.push(`RA-node ${ra.id} must have exactly one conclusion (has ${outConcls.length}).`);
    }
  }

  // CA/PA cardinalities
  const caNodes = graph.nodes.filter(n => n.nodeType === 'CA');
  for (const ca of caNodes) {
    const incom = graph.edges.filter(e => e.targetId === ca.id && e.edgeType === 'conflicting');
    const out = graph.edges.filter(e => e.sourceId === ca.id && e.edgeType === 'conflicted');
    if (incom.length !== 1 || out.length !== 1) {
      errors.push(`CA-node ${ca.id} must have exactly one conflicting in and one conflicted out.`);
    }
  }

  const paNodes = graph.nodes.filter(n => n.nodeType === 'PA');
  for (const pa of paNodes) {
    const incom = graph.edges.filter(e => e.targetId === pa.id && e.edgeType === 'preferred');
    const out = graph.edges.filter(e => e.sourceId === pa.id && e.edgeType === 'dispreferred');
    if (incom.length !== 1 || out.length !== 1) {
      errors.push(`PA-node ${pa.id} must have exactly one preferred in and one dispreferred out.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// JSON-LD Export Validation
// =============================================================================

export interface AifJsonLdValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    nodeCount: Record<string, number>;
    edgeCount: Record<string, number>;
    totalNodes: number;
    totalEdges: number;
  };
}

const VALID_JSONLD_NODE_TYPES = new Set([
  "aif:InformationNode",
  "aif:RA",
  "aif:CA",
  "aif:PA",
  "aif:L",
  "aif:PascalMeta",
  "cq:CriticalQuestion",
]);

const VALID_JSONLD_EDGE_ROLES = new Set([
  "aif:Premise",
  "aif:Conclusion",
  "aif:ConflictingElement",
  "aif:ConflictedElement",
  "aif:PreferredElement",
  "aif:DispreferredElement",
  "aif:Illocutes",
  "aif:Replies",
  "aif:Annotates",
  "as:hasCriticalQuestion",
  "as:HasPresumption",
  "as:HasException",
]);

/**
 * Validate AIF-JSON-LD export structure
 * Checks @context, node types, edge connectivity, and AIF 2.0 semantics
 */
export function validateAifJsonLd(doc: any): AifJsonLdValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeCount: Record<string, number> = {};
  const edgeCount: Record<string, number> = {};

  // 1) Check @context existence
  if (!doc["@context"]) {
    errors.push("Missing @context field (required for JSON-LD)");
  } else {
    const docCtx = doc["@context"];
    
    if (typeof docCtx === "object") {
      if (!docCtx["aif"]) warnings.push("@context missing 'aif' namespace");
      if (!docCtx["as"]) warnings.push("@context missing 'as' namespace (argument schemes)");
      
      // Check for Mesh extensions
      if (doc.nodes?.some((n: any) => n["@type"]?.includes("PascalMeta"))) {
        warnings.push("Document uses Mesh extension: PascalMeta (not AIF 2.0 standard)");
      }
      if (doc.nodes?.some((n: any) => n["@type"]?.includes("CriticalQuestion"))) {
        warnings.push("Document uses Mesh extension: CriticalQuestion (not AIF 2.0 standard)");
      }
    }
  }

  // 2) Check structure (nodes + edges OR @graph)
  const nodes = doc.nodes || doc["@graph"]?.filter((n: any) => n["@id"] && n["@type"] && !n["aif:from"]) || [];
  const edges = doc.edges || doc["@graph"]?.filter((e: any) => e["aif:from"] && e["aif:to"]) || [];

  if (nodes.length === 0) {
    errors.push("No nodes found (expected at least one I-node or RA-node)");
  }

  // 3) Validate node structure
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node["@id"]) {
      errors.push(`Node missing @id: ${JSON.stringify(node).slice(0, 100)}`);
      continue;
    }
    if (nodeIds.has(node["@id"])) {
      errors.push(`Duplicate node ID: ${node["@id"]}`);
    }
    nodeIds.add(node["@id"]);

    const nodeType = Array.isArray(node["@type"]) ? node["@type"][0] : node["@type"];
    if (!nodeType) {
      errors.push(`Node ${node["@id"]} missing @type`);
    } else {
      const baseType = nodeType.split(":")[0] === "aif" || nodeType.split(":")[0] === "cq" 
        ? nodeType 
        : nodeType;
        
      if (!VALID_JSONLD_NODE_TYPES.has(baseType) && !nodeType.startsWith("as:")) {
        warnings.push(`Unknown node type: ${nodeType} (node ${node["@id"]})`);
      }
      
      nodeCount[baseType] = (nodeCount[baseType] || 0) + 1;
    }

    // Type-specific validation
    if (nodeType === "aif:InformationNode" && !node.text && !node["aif:text"]) {
      warnings.push(`I-node ${node["@id"]} missing text content`);
    }
    if (nodeType === "aif:RA" && !node.schemeKey && !node["aif:usesScheme"]) {
      warnings.push(`RA-node ${node["@id"]} missing scheme reference (optional but recommended)`);
    }
  }

  // 4) Validate edge structure and connectivity
  for (const edge of edges) {
    const from = edge.from || edge["aif:from"];
    const to = edge.to || edge["aif:to"];
    const role = edge["@type"] || edge.role;

    if (!from) {
      errors.push(`Edge missing 'from' field: ${JSON.stringify(edge).slice(0, 100)}`);
      continue;
    }
    if (!to) {
      errors.push(`Edge missing 'to' field: ${JSON.stringify(edge).slice(0, 100)}`);
      continue;
    }
    if (!role) {
      errors.push(`Edge missing '@type' or 'role': ${from} → ${to}`);
      continue;
    }

    // Check connectivity
    if (!nodeIds.has(from)) {
      errors.push(`Edge references non-existent 'from' node: ${from}`);
    }
    if (!nodeIds.has(to)) {
      errors.push(`Edge references non-existent 'to' node: ${to}`);
    }

    // Validate role
    if (!VALID_JSONLD_EDGE_ROLES.has(role)) {
      warnings.push(`Unknown edge role: ${role} (${from} → ${to})`);
    }

    edgeCount[role] = (edgeCount[role] || 0) + 1;
  }

  // 5) Semantic validation (AIF 2.0 rules)
  const raNodes = nodes.filter((n: any) => {
    const t = Array.isArray(n["@type"]) ? n["@type"][0] : n["@type"];
    return t === "aif:RA";
  });
  
  for (const ra of raNodes) {
    const raId = ra["@id"];
    const premises = edges.filter((e: any) => 
      (e.to || e["aif:to"]) === raId && 
      (e["@type"] || e.role)?.includes("Premise")
    );
    const conclusions = edges.filter((e: any) => 
      (e.from || e["aif:from"]) === raId && 
      (e["@type"] || e.role)?.includes("Conclusion")
    );

    if (premises.length === 0) {
      warnings.push(`RA-node ${raId} has no premises (AIF requires ≥1 premise)`);
    }
    if (conclusions.length === 0) {
      warnings.push(`RA-node ${raId} has no conclusion (AIF requires exactly 1 conclusion)`);
    }
    if (conclusions.length > 1) {
      warnings.push(`RA-node ${raId} has ${conclusions.length} conclusions (AIF allows only 1)`);
    }
  }

  // 6) Statistics
  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      nodeCount,
      edgeCount,
      totalNodes,
      totalEdges,
    },
  };
}

/**
 * Validate AIF export from deliberation
 * Usage: const result = await validateDeliberationExport("deliberation_id");
 */
export async function validateDeliberationExport(deliberationId: string): Promise<AifJsonLdValidationResult> {
  const { exportDeliberationAsAifJSONLD } = await import("./export");
  const exported = await exportDeliberationAsAifJSONLD(deliberationId);
  return validateAifJsonLd(exported);
}
