/**
 * TypeScript types for AIF (Argument Interchange Format) ontology export
 * Based on W3C AIF specification and Mesh extensions
 * 
 * Note: This is separate from lib/aif/types.ts which handles AIF diagram structures
 * for the argument mapping/visualization system.
 */

import { ArgumentScheme, CriticalQuestion, Argument } from "@prisma/client";

// ============================================================================
// AIF Core Node Types (for Ontology Export)
// ============================================================================

/**
 * AIF Node Types for ontology export
 * - I-node: Information node (claims, premises, data)
 * - S-node: Scheme node (inference rules, argumentation schemes)
 * - RA-node: Rule Application node (links I-nodes via S-nodes)
 */
export type AIFOntologyNodeType = "I-node" | "S-node" | "RA-node";

/**
 * Base interface for all AIF ontology nodes
 */
export interface AIFOntologyNode {
  uri: string;
  type: AIFOntologyNodeType;
  properties: Record<string, string | number | boolean | string[]>;
}

/**
 * Information node (I-node) for ontology
 */
export interface AIFInformationNode extends AIFOntologyNode {
  type: "I-node";
  text: string;
}

/**
 * Scheme node (S-node) for ontology
 */
export interface AIFSchemeNode extends AIFOntologyNode {
  type: "S-node";
  schemeKey: string;
  schemeName: string;
  description?: string;
}

/**
 * Rule Application node (RA-node) for ontology
 */
export interface AIFRuleApplicationNode extends AIFOntologyNode {
  type: "RA-node";
  scheme: string; // URI of S-node
  premises: string[]; // URIs of I-nodes
  conclusion: string; // URI of I-node
}

// ============================================================================
// AIF Graph Structure (for RDF Export)
// ============================================================================

/**
 * RDF Triple (subject-predicate-object)
 */
export interface AIFTriple {
  subject: string;
  predicate: string;
  object: string;
  objectType?: "uri" | "literal";
  datatype?: string;
}

/**
 * AIF Graph representation for RDF export
 */
export interface AIFExportGraph {
  nodes: AIFOntologyNode[];
  triples: AIFTriple[];
  namespaces: Record<string, string>;
}

// ============================================================================
// Mesh → AIF Mapping Types
// ============================================================================

/**
 * Extended scheme type with relations needed for AIF export
 * Matches actual Prisma ArgumentScheme model structure
 * Supports recursive parent hierarchy for transitive ancestor tracking
 */
export type SchemeWithRelations = ArgumentScheme & {
  cqs?: CriticalQuestion[];
  parentScheme?: (ArgumentScheme & { parentScheme?: any }) | null; // Recursive parent
  childSchemes?: ArgumentScheme[];
};

/**
 * CriticalQuestion with inheritance metadata
 */
export interface CQWithProvenance extends CriticalQuestion {
  sourceSchemeId?: string;
  sourceSchemeName?: string;
  inheritanceDepth?: number;
}

/**
 * Mapped scheme ready for AIF export
 */
export interface AIFMappedScheme {
  uri: string;
  schemeKey: string;
  schemeName: string;
  summary: string;
  description?: string;
  parentSchemeURI?: string;
  clusterTag?: string;
  questions: AIFMappedQuestion[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Mapped critical question ready for AIF export
 */
export interface AIFMappedQuestion {
  uri: string;
  questionText: string;
  questionCategory?: string;
  questionOrder?: number;
  inheritedFrom?: string; // URI of source scheme
  inheritanceDepth?: number;
}

// ============================================================================
// Export Options & Configuration
// ============================================================================

/**
 * AIF export format options
 */
export type AIFExportFormat = "rdfxml" | "turtle" | "jsonld";

/**
 * Options for exporting schemes to AIF
 */
export interface AIFExportOptions {
  format: AIFExportFormat;
  includeHierarchy: boolean;
  includeCQs: boolean;
  includeInheritedCQs: boolean;
  includeMetadata: boolean;
  includeMeshExtensions: boolean;
  baseURI?: string;
  validate?: boolean;
  strictMode?: boolean;
}

/**
 * Default export options
 */
export const DEFAULT_EXPORT_OPTIONS: AIFExportOptions = {
  format: "turtle",
  includeHierarchy: true,
  includeCQs: true,
  includeInheritedCQs: true,
  includeMetadata: true,
  includeMeshExtensions: true,
  validate: true,
  strictMode: false,
};

// ============================================================================
// AIF Namespace & URI Utilities
// ============================================================================

/**
 * Standard AIF namespaces
 */
export const AIF_NAMESPACES = {
  aif: "http://www.arg.dundee.ac.uk/aif#",
  mesh: "http://mesh-platform.io/ontology/aif#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
} as const;

/**
 * Default base URI for Mesh AIF resources
 */
export const AIF_BASE_URI = "http://mesh-platform.io/aif";

/**
 * URI patterns for different resource types
 */
export const AIF_URI_PATTERNS = {
  scheme: (schemeKey: string) => `${AIF_BASE_URI}/schemes/${schemeKey}`,
  question: (schemeKey: string, questionId: string) =>
    `${AIF_BASE_URI}/schemes/${schemeKey}/questions/${questionId}`,
  argument: (argumentId: string) => `${AIF_BASE_URI}/arguments/${argumentId}`,
  inheritance: (childSchemeId: string, questionId: string) =>
    `${AIF_BASE_URI}/inheritance/${childSchemeId}/${questionId}`,
} as const;

// ============================================================================
// AIF Property Mappings
// ============================================================================

/**
 * Mapping from Mesh fields to AIF properties (for schemes)
 */
export const SCHEME_PROPERTY_MAPPING = {
  schemeKey: "rdfs:label",
  name: "aif:schemeName",
  summary: "rdfs:comment",
  description: "aif:description",
  parentSchemeId: "aif:isSubtypeOf",
  clusterTag: "mesh:clusterTag",
  schemeCategory: "mesh:schemeCategory",
  createdAt: "mesh:createdAt",
  updatedAt: "mesh:updatedAt",
} as const;

/**
 * Mapping from Mesh fields to AIF properties (for critical questions)
 */
export const QUESTION_PROPERTY_MAPPING = {
  question: "aif:questionText",
  category: "aif:questionCategory",
  order: "mesh:questionOrder",
  sourceSchemeId: "mesh:inheritedFrom",
  inheritanceDepth: "mesh:inheritanceDepth",
} as const;

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result for AIF export
 */
export interface AIFValidationResult {
  valid: boolean;
  errors: AIFValidationError[];
  warnings: AIFValidationWarning[];
}

/**
 * Validation error
 */
export interface AIFValidationError {
  code: string;
  message: string;
  context?: {
    uri?: string;
    property?: string;
    value?: string;
  };
}

/**
 * Validation warning
 */
export interface AIFValidationWarning {
  code: string;
  message: string;
  context?: {
    uri?: string;
    property?: string;
    value?: string;
  };
}

/**
 * Validation severity
 */
export type AIFValidationSeverity = "error" | "warning" | "info";

// ============================================================================
// Utility Types
// ============================================================================

/**
 * RDF literal with datatype
 */
export interface RDFLiteral {
  value: string | number | boolean;
  datatype?: string;
  language?: string;
}

/**
 * Ontology class definition
 */
export interface OntologyClass {
  uri: string;
  label: string;
  comment?: string;
  subClassOf?: string[];
  properties: OntologyProperty[];
}

/**
 * Ontology property definition
 */
export interface OntologyProperty {
  uri: string;
  label: string;
  comment?: string;
  domain?: string;
  range?: string;
  propertyType: "ObjectProperty" | "DatatypeProperty" | "AnnotationProperty";
  functional?: boolean;
  transitive?: boolean;
  inverse?: string;
}

// ============================================================================
// Inheritance Tracking Types
// ============================================================================

/**
 * Question inheritance metadata
 * Tracks how a question was inherited through the scheme hierarchy
 */
export interface QuestionInheritanceMetadata {
  uri: string;
  childScheme: string; // URI
  parentScheme: string; // URI
  inheritedQuestion: string; // URI
  inheritanceDepth: number;
}

/**
 * Full inheritance chain for a question
 */
export interface QuestionInheritanceChain {
  question: CriticalQuestion;
  chain: Array<{
    scheme: ArgumentScheme;
    depth: number;
  }>;
  originalSource: ArgumentScheme;
}

// ============================================================================
// Export Result Types
// ============================================================================

/**
 * Result of an AIF export operation
 */
export interface AIFExportResult {
  success: boolean;
  data?: string; // Serialized RDF
  format: AIFExportFormat;
  validation?: AIFValidationResult;
  metadata: {
    schemeCount: number;
    questionCount: number;
    tripleCount: number;
    exportedAt: Date;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Bulk export result (multiple schemes)
 */
export interface AIFBulkExportResult {
  success: boolean;
  exports: Record<string, AIFExportResult>; // schemeKey → result
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ============================================================================
// Query/Filter Types
// ============================================================================

/**
 * Filter options for selecting schemes to export
 */
export interface AIFExportFilter {
  schemeIds?: string[];
  schemeKeys?: string[];
  clusterTags?: string[];
  includeChildren?: boolean;
  includeAncestors?: boolean;
}

/**
 * Options for exporting a cluster family
 */
export interface AIFClusterExportOptions extends AIFExportOptions {
  clusterTag: string;
  includeTransitiveAncestors?: boolean;
}
