/**
 * Enhanced Markdown Formatter for Argument Chains
 * Provides rich markdown formatting with frontmatter, ToC, badges, and cross-references
 * 
 * Phase 4 Enhancements:
 * - Epistemic status badges: Visual indicators for argument epistemic status
 * - Scope sections: Group arguments by scope with contextual headers
 * - Chain type descriptions: Structural context based on chain type
 */

import { Node, Edge } from "@xyflow/react";
import { 
  ChainNodeData, 
  ChainEdgeData,
  EpistemicStatus,
  ScopeType,
  EPISTEMIC_STATUS_CONFIG,
  SCOPE_TYPE_CONFIG,
  ArgumentScopeWithNodes
} from "@/lib/types/argumentChain";
import type { SortedNode } from "./narrativeGenerator";

export interface MarkdownOptions {
  includeToC?: boolean; // Auto-enabled for chains >10 nodes
  includeFrontmatter?: boolean;
  includeStatistics?: boolean;
  numberingStyle?: "sequential" | "hierarchical"; // 1,2,3 vs 1.1, 1.2
  includeCitations?: boolean;
  includeSchemeDetails?: boolean;
  // Phase 4 options
  includeEpistemicBadges?: boolean;
  groupByScope?: boolean;
  includeChainTypeDescription?: boolean;
  scopes?: ArgumentScopeWithNodes[];
  chainType?: "SERIAL" | "CONVERGENT" | "DIVERGENT" | "TREE" | "GRAPH";
}

/**
 * Escape markdown special characters in text
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/\_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\#/g, "\\#")
    .replace(/\+/g, "\\+")
    .replace(/\-/g, "\\-")
    .replace(/\./g, "\\.")
    .replace(/\!/g, "\\!");
}

/**
 * Generate YAML frontmatter
 */
function generateFrontmatter(
  chainName: string | undefined,
  nodeCount: number,
  edgeCount: number
): string {
  const date = new Date().toISOString().split("T")[0];
  const timestamp = new Date().toISOString();
  
  return `---
title: "${chainName || "Argument Chain"}"
type: argument-chain-narrative
generated: ${date}
timestamp: ${timestamp}
statistics:
  nodes: ${nodeCount}
  edges: ${edgeCount}
  structure: ${edgeCount === 0 ? "disconnected" : "linked"}
format: markdown
version: 1.0.0
---

`;
}

/**
 * Generate table of contents with anchor links
 */
function generateToC(sortedNodes: SortedNode[], mainChainOnly: boolean = true): string {
  const nodes = mainChainOnly ? sortedNodes.filter(sn => sn.depth >= 0) : sortedNodes;
  
  if (nodes.length <= 10) {
    return ""; // Skip ToC for short chains
  }

  let toc = "## Table of Contents\n\n";
  
  nodes.forEach((sortedNode, idx) => {
    const { node } = sortedNode;
    const schemeName = node.data.argument?.argumentSchemes?.[0]?.scheme?.name || "General";
    const argumentText = node.data.argument?.text || "Untitled";
    const preview = argumentText.length > 60 ? argumentText.substring(0, 60) + "..." : argumentText;
    const anchor = `argument-${idx + 1}`;
    
    toc += `${idx + 1}. [Argument ${idx + 1}: ${preview}](#${anchor})\n`;
  });

  toc += "\n---\n\n";
  
  return toc;
}

/**
 * Generate confidence/strength badge
 */
function generateConfidenceBadge(confidence?: number): string {
  if (!confidence || confidence === undefined) {
    return "";
  }

  let level: string;
  let color: string;
  
  if (confidence >= 0.8) {
    level = "High";
    color = "brightgreen";
  } else if (confidence >= 0.5) {
    level = "Medium";
    color = "yellow";
  } else {
    level = "Low";
    color = "orange";
  }

  // Using shields.io style badge syntax (renders on GitHub)
  return `![Confidence: ${level}](https://img.shields.io/badge/confidence-${level}-${color})`;
}

// ===== Phase 4: Chain Type Descriptions =====

const CHAIN_TYPE_MD_DESCRIPTIONS: Record<string, {
  title: string;
  description: string;
  icon: string;
}> = {
  SERIAL: {
    title: "Serial Argument Chain",
    description: "A sequential structure where each conclusion becomes the premise for the next argument, forming a logical progression.",
    icon: "→",
  },
  CONVERGENT: {
    title: "Convergent Argument Chain",
    description: "Multiple independent lines of reasoning that converge to support a central conclusion.",
    icon: "⇒",
  },
  DIVERGENT: {
    title: "Divergent Argument Chain",
    description: "A structure starting from common premises that explores multiple divergent conclusions or implications.",
    icon: "⇋",
  },
  TREE: {
    title: "Tree Structure Argument",
    description: "A hierarchical structure with premises at the leaves supporting intermediate conclusions toward a root conclusion.",
    icon: "⊦",
  },
  GRAPH: {
    title: "Graph Structure Argument",
    description: "A complex interconnected graph with multiple relationships including supports, attacks, and qualifications.",
    icon: "⋈",
  },
};

// ===== Phase 4: Scope Templates =====

const SCOPE_MD_TEMPLATES: Record<ScopeType, {
  title: string;
  icon: string;
  color: string;
  intro: string;
}> = {
  HYPOTHETICAL: {
    title: "Hypothetical Reasoning",
    icon: "💡",
    color: "f59e0b",
    intro: "The following arguments explore a hypothetical scenario:",
  },
  COUNTERFACTUAL: {
    title: "Counterfactual Analysis",
    icon: "⑂",
    color: "8b5cf6",
    intro: "The following arguments consider a contrary-to-fact scenario:",
  },
  CONDITIONAL: {
    title: "Conditional Arguments",
    icon: "↔",
    color: "3b82f6",
    intro: "The following arguments are contingent on the specified condition:",
  },
  OPPONENT: {
    title: "Opponent's Position",
    icon: "⚔",
    color: "ef4444",
    intro: "The following represents the opponent's perspective:",
  },
  MODAL: {
    title: "Modal Scope",
    icon: "◇",
    color: "6366f1",
    intro: "The following explores modal possibilities:",
  },
};

/**
 * Phase 4: Generate epistemic status badge
 * Creates a visual badge indicating the epistemic status of an argument
 */
function generateEpistemicBadge(epistemicStatus?: EpistemicStatus): string {
  if (!epistemicStatus || epistemicStatus === "ASSERTED") {
    return "";
  }

  const config = EPISTEMIC_STATUS_CONFIG[epistemicStatus];
  if (!config) {
    return "";
  }

  // Map epistemic status to badge colors
  const colorMap: Record<EpistemicStatus, string> = {
    ASSERTED: "gray",
    HYPOTHETICAL: "f59e0b",
    COUNTERFACTUAL: "8b5cf6",
    CONDITIONAL: "3b82f6",
    QUESTIONED: "eab308",
    DENIED: "ef4444",
    SUSPENDED: "64748b",
  };

  const color = colorMap[epistemicStatus] || "gray";
  const label = config.label;
  const icon = config.icon;

  // Using shields.io style badge syntax (renders on GitHub)
  return `![${icon} ${label}](https://img.shields.io/badge/status-${encodeURIComponent(label)}-${color})`;
}

/**
 * Format premises as markdown list
 */
function formatPremises(argument: any): string {
  // Try to extract premises from argument structure
  const premises: string[] = [];
  
  // Check if argument has explicit premises
  if (argument.argumentPremises && Array.isArray(argument.argumentPremises)) {
    argument.argumentPremises.forEach((premise: any) => {
      const claimText = premise.claim?.text || premise.text;
      if (claimText) {
        const isAxiom = premise.isAxiom;
        premises.push(`- ${isAxiom ? "**[Axiom]** " : ""}${claimText}`);
      }
    });
  }

  return premises.length > 0 ? `\n**Premises:**\n${premises.join("\n")}\n` : "";
}

/**
 * Format conclusion as blockquote
 */
function formatConclusion(argument: any): string {
  const conclusionText = argument.conclusionClaim?.text || argument.text;
  
  if (!conclusionText) {
    return "";
  }

  return `\n> **Conclusion:** ${conclusionText}\n`;
}

/**
 * Get the best text representation for an argument
 * Falls back through: argument.text → conclusion.text → "Untitled argument"
 */
function getArgumentDisplayText(argument: any): string {
  // First try argument text
  if (argument?.text && argument.text.trim() !== "") {
    return argument.text;
  }
  
  // Fall back to conclusion claim text
  if (argument?.conclusion?.text && argument.conclusion.text.trim() !== "") {
    return argument.conclusion.text;
  }
  
  return "Untitled argument";
}

/**
 * Get scheme metadata
 */
function getSchemeMetadata(argument: any): {
  name: string | null;
  type: string | null;
  confidence: number | null;
} {
  const scheme = argument?.argumentSchemes?.[0];
  
  return {
    name: scheme?.scheme?.name || null,
    type: scheme?.scheme?.reasoningType || null,
    confidence: scheme?.confidence || null
  };
}

/**
 * Format a single node as enhanced markdown
 * Phase 4: Now includes epistemic status badges
 */
export function formatNodeAsMarkdown(
  sortedNode: SortedNode,
  options: MarkdownOptions
): string {
  const { node, position, depth } = sortedNode;
  const { argument, epistemicStatus } = node.data;
  
  if (!argument) {
    return `## Argument ${position + 1}\n\n*No argument data available*\n\n---\n\n`;
  }

  const { name: schemeName, type: schemeType, confidence } = getSchemeMetadata(argument);
  const argumentText = getArgumentDisplayText(argument);
  const anchor = `argument-${position + 1}`;
  
  let markdown = "";

  // Heading with anchor
  markdown += `<a id="${anchor}"></a>\n\n`;
  markdown += `## Argument ${position + 1}`;
  
  if (schemeName && options.includeSchemeDetails) {
    markdown += ` — *${schemeName}*`;
  }
  
  markdown += "\n\n";

  // Phase 4: Epistemic status badge
  if (options.includeEpistemicBadges !== false && epistemicStatus && epistemicStatus !== "ASSERTED") {
    markdown += `${generateEpistemicBadge(epistemicStatus as EpistemicStatus)} `;
  }

  // Confidence badge
  if (confidence && options.includeSchemeDetails) {
    markdown += `${generateConfidenceBadge(confidence)} `;
  }

  // Scheme type badge
  if (schemeType && options.includeSchemeDetails) {
    markdown += `\`${schemeType}\``;
  }

  if ((confidence || schemeType || (epistemicStatus && epistemicStatus !== "ASSERTED")) && options.includeSchemeDetails) {
    markdown += "\n\n";
  }

  // Main argument text
  markdown += `${argumentText}\n`;

  // Premises (if available and detail level is high)
  if (options.includeSchemeDetails) {
    const premises = formatPremises(argument);
    if (premises) {
      markdown += premises;
    }
  }

  // Conclusion as blockquote
  if (options.includeSchemeDetails && (argument as any).conclusionClaim) {
    markdown += formatConclusion(argument);
  }

  // Scheme details section
  if (schemeName && options.includeSchemeDetails) {
    markdown += `\n**Reasoning Pattern:** ${schemeName}`;
    
    if (schemeType) {
      markdown += ` (${schemeType})`;
    }
    
    markdown += "\n";
  }

  // Depth indicator for hierarchical structures
  if (depth > 0 && options.numberingStyle === "hierarchical") {
    markdown += `\n*Depth: ${depth}*\n`;
  }

  markdown += "\n---\n\n";

  return markdown;
}

/**
 * Generate statistics section
 * Phase 4: Now includes epistemic status breakdown
 */
function generateStatistics(
  nodeCount: number,
  edgeCount: number,
  sortedNodes: SortedNode[],
  options: MarkdownOptions = {}
): string {
  const mainChain = sortedNodes.filter(sn => sn.depth >= 0);
  const orphans = sortedNodes.filter(sn => sn.depth < 0);
  const maxDepth = Math.max(...sortedNodes.map(sn => sn.depth), 0);
  
  // Count scheme types
  const schemeTypes = new Map<string, number>();
  sortedNodes.forEach(sn => {
    const schemeName = sn.node.data.argument?.argumentSchemes?.[0]?.scheme?.name;
    if (schemeName) {
      schemeTypes.set(schemeName, (schemeTypes.get(schemeName) || 0) + 1);
    }
  });

  // Phase 4: Count epistemic statuses
  const epistemicCounts = new Map<string, number>();
  sortedNodes.forEach(sn => {
    const status = sn.node.data.epistemicStatus || "ASSERTED";
    epistemicCounts.set(status, (epistemicCounts.get(status) || 0) + 1);
  });

  let stats = "## Chain Statistics\n\n";
  stats += `| Metric | Value |\n`;
  stats += `|--------|-------|\n`;
  stats += `| Total Arguments | ${nodeCount} |\n`;
  stats += `| Total Connections | ${edgeCount} |\n`;
  stats += `| Main Chain | ${mainChain.length} arguments |\n`;
  stats += `| Disconnected Claims | ${orphans.length} |\n`;
  stats += `| Maximum Depth | ${maxDepth} levels |\n`;
  stats += `| Unique Schemes | ${schemeTypes.size} types |\n`;

  // Phase 4: Chain type info
  if (options.chainType) {
    const chainTypeInfo = CHAIN_TYPE_MD_DESCRIPTIONS[options.chainType];
    if (chainTypeInfo) {
      stats += `| Chain Structure | ${chainTypeInfo.icon} ${chainTypeInfo.title} |\n`;
    }
  }

  // Phase 4: Scope count
  if (options.scopes && options.scopes.length > 0) {
    stats += `| Scopes | ${options.scopes.length} |\n`;
  }

  if (schemeTypes.size > 0) {
    stats += "\n### Reasoning Patterns Used\n\n";
    const sortedSchemes = Array.from(schemeTypes.entries()).sort((a, b) => b[1] - a[1]);
    sortedSchemes.forEach(([scheme, count]) => {
      stats += `- **${scheme}**: ${count} argument${count > 1 ? "s" : ""}\n`;
    });
  }

  // Phase 4: Epistemic status breakdown
  const nonAssertedStatuses = Array.from(epistemicCounts.entries())
    .filter(([status]) => status !== "ASSERTED");
  
  if (nonAssertedStatuses.length > 0) {
    stats += "\n### Epistemic Status Breakdown\n\n";
    nonAssertedStatuses.forEach(([status, count]) => {
      const config = EPISTEMIC_STATUS_CONFIG[status as EpistemicStatus];
      if (config) {
        stats += `- ${config.icon} **${config.label}**: ${count} argument${count > 1 ? "s" : ""}\n`;
      }
    });
  }

  stats += "\n---\n\n";

  return stats;
}

/**
 * Generate orphan nodes section (enhanced)
 */
function generateOrphansSection(orphans: SortedNode[]): string {
  if (orphans.length === 0) {
    return "";
  }

  let section = "## Additional Claims\n\n";
  section += "*The following claims are not connected to the main argument chain:*\n\n";

  orphans.forEach((sortedNode, idx) => {
    const text = getArgumentDisplayText(sortedNode.node.data.argument);
    const schemeName = sortedNode.node.data.argument?.argumentSchemes?.[0]?.scheme?.name;
    
    section += `${idx + 1}. ${text}`;
    
    if (schemeName) {
      section += ` — *${schemeName}*`;
    }
    
    section += "\n";
  });

  return "\n" + section;
}

/**
 * Edge type descriptions for narrative
 */
const EDGE_TYPE_LABELS: Record<string, string> = {
  SUPPORTS: "supports",
  ENABLES: "enables",
  PRESUPPOSES: "presupposes",
  REFUTES: "refutes",
  QUALIFIES: "qualifies",
  EXEMPLIFIES: "exemplifies",
  GENERALIZES: "generalizes",
};

/**
 * Generate edge relationships section
 */
function generateEdgeRelationships(
  edges: Edge<ChainEdgeData>[],
  sortedNodes: SortedNode[]
): string {
  if (edges.length === 0) {
    return "";
  }

  // Create a position map for node IDs
  const nodePositionMap = new Map<string, number>();
  sortedNodes.forEach((sn, idx) => {
    nodePositionMap.set(sn.node.id, idx + 1);
  });

  // Create a role map for node IDs
  const nodeRoleMap = new Map<string, string>();
  sortedNodes.forEach((sn) => {
    const role = sn.node.data.role || "CLAIM";
    nodeRoleMap.set(sn.node.id, role);
  });

  let section = "## Argument Relationships\n\n";
  section += "*How the arguments connect to form the reasoning chain:*\n\n";

  edges.forEach((edge, idx) => {
    const sourcePos = nodePositionMap.get(edge.source);
    const targetPos = nodePositionMap.get(edge.target);
    const sourceRole = nodeRoleMap.get(edge.source) || "CLAIM";
    const targetRole = nodeRoleMap.get(edge.target) || "CLAIM";
    
    const edgeType = edge.data?.edgeType || "SUPPORTS";
    const edgeLabel = EDGE_TYPE_LABELS[edgeType] || edgeType.toLowerCase();
    const strength = edge.data?.strength;
    
    if (sourcePos && targetPos) {
      section += `${idx + 1}. **Argument ${sourcePos}** (${sourceRole}) `;
      section += `**${edgeLabel}** `;
      section += `**Argument ${targetPos}** (${targetRole})`;
      
      if (strength && strength < 1) {
        section += ` — *strength: ${Math.round(strength * 100)}%*`;
      }
      
      if (edge.data?.description) {
        section += `\n   > ${edge.data.description}`;
      }
      
      section += "\n";
    }
  });

  section += "\n---\n\n";

  return section;
}

/**
 * Phase 4: Group nodes by scope for scope-aware markdown generation
 */
function groupNodesByScope(
  sortedNodes: SortedNode[],
  scopes: ArgumentScopeWithNodes[] | undefined
): Map<string | null, SortedNode[]> {
  const scopeGroups = new Map<string | null, SortedNode[]>();
  
  if (!scopes || scopes.length === 0) {
    scopeGroups.set(null, sortedNodes);
    return scopeGroups;
  }

  // Build a map of nodeId -> scopeId
  const nodeToScope = new Map<string, string>();
  scopes.forEach(scope => {
    scope.nodes?.forEach(scopeNode => {
      nodeToScope.set(scopeNode.id, scope.id);
    });
  });

  // Group nodes
  sortedNodes.forEach(sortedNode => {
    const scopeId = nodeToScope.get(sortedNode.node.id) || null;
    const existing = scopeGroups.get(scopeId) || [];
    existing.push(sortedNode);
    scopeGroups.set(scopeId, existing);
  });

  return scopeGroups;
}

/**
 * Phase 4: Generate markdown section for a scope
 */
function generateScopeSection(
  scopeId: string | null,
  nodes: SortedNode[],
  scopes: ArgumentScopeWithNodes[] | undefined,
  options: MarkdownOptions
): string {
  if (nodes.length === 0) {
    return "";
  }

  let section = "";
  const scope = scopes?.find(s => s.id === scopeId);

  if (scope) {
    const scopeType = scope.scopeType as ScopeType;
    const scopeTemplate = SCOPE_MD_TEMPLATES[scopeType];
    
    // Scope header
    section += `### ${scopeTemplate?.icon || "📦"} ${scope.assumption}\n\n`;
    
    if (scopeTemplate) {
      section += `*${scopeTemplate.intro}*\n\n`;
    }
    
    if (scope.description) {
      section += `> ${scope.description}\n\n`;
    }
  }

  // Format nodes within scope
  nodes.forEach(sortedNode => {
    section += formatNodeAsMarkdown(sortedNode, options);
  });

  return section;
}

/**
 * Phase 4: Generate chain type description section
 */
function generateChainTypeSection(chainType: string | undefined): string {
  if (!chainType) {
    return "";
  }

  const chainTypeInfo = CHAIN_TYPE_MD_DESCRIPTIONS[chainType];
  if (!chainTypeInfo) {
    return "";
  }

  let section = `## ${chainTypeInfo.icon} Chain Structure: ${chainTypeInfo.title}\n\n`;
  section += `${chainTypeInfo.description}\n\n`;
  section += `---\n\n`;

  return section;
}

/**
 * Generate full enhanced markdown document
 * Phase 4: Now includes chain type descriptions, scope sections, and epistemic badges
 */
export function generateEnhancedMarkdown(
  nodes: Node<ChainNodeData>[],
  edges: Edge<ChainEdgeData>[],
  sortedNodes: SortedNode[],
  chainName?: string,
  options: MarkdownOptions = {}
): string {
  // Set defaults with Phase 4 options
  const opts: Required<Omit<MarkdownOptions, "scopes" | "chainType">> &
    Pick<MarkdownOptions, "scopes" | "chainType"> = {
    includeToC: options.includeToC ?? (nodes.length > 10),
    includeFrontmatter: options.includeFrontmatter ?? true,
    includeStatistics: options.includeStatistics ?? true,
    numberingStyle: options.numberingStyle || "sequential",
    includeCitations: options.includeCitations ?? false,
    includeSchemeDetails: options.includeSchemeDetails ?? true,
    // Phase 4 options
    includeEpistemicBadges: options.includeEpistemicBadges ?? true,
    groupByScope: options.groupByScope ?? true,
    includeChainTypeDescription: options.includeChainTypeDescription ?? true,
    scopes: options.scopes,
    chainType: options.chainType,
  };

  let markdown = "";

  // Frontmatter
  if (opts.includeFrontmatter) {
    markdown += generateFrontmatter(chainName, nodes.length, edges.length);
  }

  // Title
  markdown += `# ${chainName || "Argument Chain"}\n\n`;
  markdown += `*A structured narrative of connected reasoning*\n\n`;

  // Phase 4: Chain type description
  if (opts.includeChainTypeDescription && opts.chainType) {
    markdown += generateChainTypeSection(opts.chainType);
  }

  // Table of Contents
  if (opts.includeToC) {
    markdown += generateToC(sortedNodes);
  }

  // Statistics (Phase 4: now includes epistemic breakdown)
  if (opts.includeStatistics) {
    markdown += generateStatistics(nodes.length, edges.length, sortedNodes, opts);
  }

  // Separate main chain from orphans
  const mainChain = sortedNodes.filter(sn => sn.depth >= 0);
  const orphans = sortedNodes.filter(sn => sn.depth < 0);

  // Phase 4: Check if we should group by scope
  if (opts.groupByScope && opts.scopes && opts.scopes.length > 0) {
    // Group nodes by scope
    const scopeGroups = groupNodesByScope(mainChain, opts.scopes);
    
    // Main content section - unscoped arguments first
    const unscopedNodes = scopeGroups.get(null) || [];
    if (unscopedNodes.length > 0) {
      markdown += "## Main Arguments\n\n";
      unscopedNodes.forEach(sortedNode => {
        markdown += formatNodeAsMarkdown(sortedNode, opts);
      });
    }
    
    // Scoped arguments
    const hasScopes = opts.scopes.some(scope => (scopeGroups.get(scope.id) || []).length > 0);
    if (hasScopes) {
      markdown += "## Scoped Arguments\n\n";
      opts.scopes.forEach(scope => {
        const scopeNodes = scopeGroups.get(scope.id) || [];
        if (scopeNodes.length > 0) {
          markdown += generateScopeSection(scope.id, scopeNodes, opts.scopes, opts);
        }
      });
    }
  } else {
    // Legacy behavior: All arguments in sequence
    markdown += "## Arguments\n\n";
    mainChain.forEach(sortedNode => {
      markdown += formatNodeAsMarkdown(sortedNode, opts);
    });
  }

  // Edge relationships section (after arguments, before orphans)
  if (edges.length > 0) {
    markdown += generateEdgeRelationships(edges, sortedNodes);
  }

  // Orphans section
  markdown += generateOrphansSection(orphans);

  // Footer
  markdown += "\n\n---\n\n";
  markdown += `*Generated on ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long", 
    day: "numeric"
  })}*\n`;

  return markdown.trim();
}
