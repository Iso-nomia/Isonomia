/**
 * Type definitions for argument-level citations
 * Phase 3.2: Argument-Level Citations
 */

// ============================================================
// CITATION TYPES (matches Prisma enum ArgCitationType)
// ============================================================

export type ArgCitationType =
  | "SUPPORT"      // Citing to build upon/strengthen
  | "EXTENSION"    // Extending the argument further
  | "APPLICATION"  // Applying to new domain
  | "CONTRAST"     // Citing as contrast/alternative
  | "REBUTTAL"     // Citing to rebut
  | "REFINEMENT"   // Refining/improving the argument
  | "METHODOLOGY"  // Citing methodology/approach
  | "CRITIQUE";    // Methodological critique

/**
 * Citation type metadata for UI display
 */
export const CITATION_TYPE_LABELS: Record<
  ArgCitationType,
  { label: string; description: string; color: string; icon: string }
> = {
  SUPPORT: {
    label: "Support",
    description: "Cites this argument to build upon or strengthen",
    color: "green",
    icon: "ThumbsUp",
  },
  EXTENSION: {
    label: "Extension",
    description: "Extends the argument to cover new ground",
    color: "blue",
    icon: "ArrowRight",
  },
  APPLICATION: {
    label: "Application",
    description: "Applies the argument to a new domain or context",
    color: "purple",
    icon: "Layers",
  },
  CONTRAST: {
    label: "Contrast",
    description: "Cites as a contrasting or alternative view",
    color: "amber",
    icon: "GitCompare",
  },
  REBUTTAL: {
    label: "Rebuttal",
    description: "Cites to rebut or counter the argument",
    color: "red",
    icon: "XCircle",
  },
  REFINEMENT: {
    label: "Refinement",
    description: "Refines or improves upon the argument",
    color: "cyan",
    icon: "Edit3",
  },
  METHODOLOGY: {
    label: "Methodology",
    description: "Cites the methodological approach",
    color: "indigo",
    icon: "Settings",
  },
  CRITIQUE: {
    label: "Critique",
    description: "Methodological or structural critique",
    color: "orange",
    icon: "AlertTriangle",
  },
};

// ============================================================
// CITATION INPUT/OUTPUT TYPES
// ============================================================

/**
 * Input for creating a citation between arguments
 */
export interface ArgumentCitationInput {
  citingArgumentId: string;
  citedArgumentId: string;
  citationType: ArgCitationType;
  annotation?: string;
  // Optional: which premise the citation appears in
  citedInContext?: {
    premiseArgumentId: string;
    premiseClaimId: string;
  };
}

/**
 * Summary of a single citation for display
 */
export interface ArgumentCitationSummary {
  id: string;
  citingArgumentId: string;
  citedArgumentId: string;
  citationType: ArgCitationType;
  annotation?: string | null;
  citedInContext?: {
    premiseArgumentId: string;
    premiseClaimId: string;
  } | null;
  createdById: string;
  createdAt: Date;
  // Denormalized for display
  citingArgument?: {
    id: string;
    text: string;
    authorId: string;
    deliberationId: string;
    deliberationTitle?: string;
  };
  citedArgument?: {
    id: string;
    text: string;
    authorId: string;
    deliberationId: string;
    deliberationTitle?: string;
  };
}

// ============================================================
// PERMALINK TYPES
// ============================================================

/**
 * Permalink information for an argument
 */
export interface ArgumentPermalinkInfo {
  shortCode: string;
  slug?: string | null;
  fullUrl: string;
  version: number;
  accessCount: number;
  createdAt: Date;
}

/**
 * Citation text formats
 */
export type CitationFormat = "apa" | "mla" | "chicago" | "bibtex" | "mesh";

/**
 * Generated citation text in various formats
 */
export interface CitationTextResult {
  format: CitationFormat;
  text: string;
  // For BibTeX, the entry key
  key?: string;
}

// ============================================================
// METRICS TYPES
// ============================================================

/**
 * Citation metrics for an argument
 */
export interface CitationMetrics {
  totalCitations: number;
  supportCitations: number;
  extensionCitations: number;
  contrastCitations: number;
  rebuttalCitations: number;
  externalCitations: number;
  selfCitations: number;
  lastCalculatedAt: Date;
  // Top citers by citation count
  topCiters?: Array<{
    userId: string;
    userName?: string;
    count: number;
  }>;
}

/**
 * Argument with all citation data
 */
export interface ArgumentWithCitations {
  id: string;
  text: string;
  authorId: string;
  deliberationId: string;
  citationsMade: ArgumentCitationSummary[];
  citationsReceived: ArgumentCitationSummary[];
  permalink?: ArgumentPermalinkInfo | null;
  metrics?: CitationMetrics | null;
}

// ============================================================
// CITATION GRAPH TYPES
// ============================================================

/**
 * Node in a citation graph
 */
export interface CitationGraphNode {
  id: string;
  label: string;
  type: "argument" | "external";
  deliberationId?: string;
  authorId?: string;
  citationCount: number;
  // Position hint for layout (optional)
  depth?: number;
}

/**
 * Edge in a citation graph
 */
export interface CitationGraphEdge {
  source: string;
  target: string;
  citationType: ArgCitationType;
  weight: number; // For multiple citations of same type
}

/**
 * Complete citation graph
 */
export interface CitationGraph {
  nodes: CitationGraphNode[];
  edges: CitationGraphEdge[];
  // Graph metadata
  centerNodeId?: string;
  maxDepth?: number;
  totalNodes: number;
  totalEdges: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get citation type color class for Tailwind
 */
export function getCitationTypeColor(type: ArgCitationType): string {
  const colorMap: Record<ArgCitationType, string> = {
    SUPPORT: "bg-green-100 text-green-800 border-green-200",
    EXTENSION: "bg-blue-100 text-blue-800 border-blue-200",
    APPLICATION: "bg-purple-100 text-purple-800 border-purple-200",
    CONTRAST: "bg-amber-100 text-amber-800 border-amber-200",
    REBUTTAL: "bg-red-100 text-red-800 border-red-200",
    REFINEMENT: "bg-cyan-100 text-cyan-800 border-cyan-200",
    METHODOLOGY: "bg-indigo-100 text-indigo-800 border-indigo-200",
    CRITIQUE: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return colorMap[type];
}

/**
 * Check if citation type is positive (supportive)
 */
export function isPositiveCitationType(type: ArgCitationType): boolean {
  return ["SUPPORT", "EXTENSION", "APPLICATION", "REFINEMENT", "METHODOLOGY"].includes(type);
}

/**
 * Check if citation type is negative (critical)
 */
export function isNegativeCitationType(type: ArgCitationType): boolean {
  return ["REBUTTAL", "CRITIQUE"].includes(type);
}

/**
 * Check if citation type is neutral
 */
export function isNeutralCitationType(type: ArgCitationType): boolean {
  return type === "CONTRAST";
}
