/**
 * Constants for AIF (Argument Interchange Format) ontology integration
 */

// ============================================================================
// Namespace URIs
// ============================================================================

/**
 * Standard AIF namespace
 * Reference: http://www.arg.dundee.ac.uk/aif
 */
export const AIF_NAMESPACE = "http://www.arg.dundee.ac.uk/aif#";

/**
 * Mesh extension namespace for custom properties
 */
export const MESH_NAMESPACE = "http://mesh-platform.io/ontology/aif#";

/**
 * RDF namespace
 */
export const RDF_NAMESPACE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

/**
 * RDFS namespace
 */
export const RDFS_NAMESPACE = "http://www.w3.org/2000/01/rdf-schema#";

/**
 * OWL namespace
 */
export const OWL_NAMESPACE = "http://www.w3.org/2002/07/owl#";

/**
 * XSD (XML Schema Datatypes) namespace
 */
export const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema#";

/**
 * All namespaces as a record
 */
export const NAMESPACES = {
  aif: AIF_NAMESPACE,
  mesh: MESH_NAMESPACE,
  rdf: RDF_NAMESPACE,
  rdfs: RDFS_NAMESPACE,
  owl: OWL_NAMESPACE,
  xsd: XSD_NAMESPACE,
} as const;

// ============================================================================
// Base URIs
// ============================================================================

/**
 * Base URI for all Mesh AIF resources
 */
export const BASE_URI = "http://mesh-platform.io/aif";

/**
 * Base URI for schemes
 */
export const SCHEMES_BASE_URI = `${BASE_URI}/schemes`;

/**
 * Base URI for arguments
 */
export const ARGUMENTS_BASE_URI = `${BASE_URI}/arguments`;

/**
 * Base URI for inheritance metadata
 */
export const INHERITANCE_BASE_URI = `${BASE_URI}/inheritance`;

// ============================================================================
// AIF Core Classes
// ============================================================================

/**
 * AIF Scheme class (S-node)
 */
export const AIF_SCHEME_CLASS = `${AIF_NAMESPACE}Scheme`;

/**
 * AIF Question class
 */
export const AIF_QUESTION_CLASS = `${AIF_NAMESPACE}Question`;

/**
 * AIF Argument class
 */
export const AIF_ARGUMENT_CLASS = `${AIF_NAMESPACE}Argument`;

/**
 * AIF I-node (Information node) class
 */
export const AIF_INODE_CLASS = `${AIF_NAMESPACE}I-node`;

/**
 * AIF S-node (Scheme node) class (alias)
 */
export const AIF_SNODE_CLASS = AIF_SCHEME_CLASS;

/**
 * AIF RA-node (Rule Application node) class
 */
export const AIF_RANODE_CLASS = `${AIF_NAMESPACE}RA-node`;

// ============================================================================
// AIF Standard Properties
// ============================================================================

/**
 * AIF property: schemeName
 */
export const AIF_SCHEME_NAME = `${AIF_NAMESPACE}schemeName`;

/**
 * AIF property: description
 */
export const AIF_DESCRIPTION = `${AIF_NAMESPACE}description`;

/**
 * AIF property: hasQuestion (links scheme to questions)
 */
export const AIF_HAS_QUESTION = `${AIF_NAMESPACE}hasQuestion`;

/**
 * AIF property: questionText
 */
export const AIF_QUESTION_TEXT = `${AIF_NAMESPACE}questionText`;

/**
 * AIF property: questionCategory
 */
export const AIF_QUESTION_CATEGORY = `${AIF_NAMESPACE}questionCategory`;

/**
 * AIF property: appliesScheme (links argument to scheme)
 */
export const AIF_APPLIES_SCHEME = `${AIF_NAMESPACE}appliesScheme`;

/**
 * AIF property: hasClaim
 */
export const AIF_HAS_CLAIM = `${AIF_NAMESPACE}hasClaim`;

/**
 * AIF property: hasPremise
 */
export const AIF_HAS_PREMISE = `${AIF_NAMESPACE}hasPremise`;

/**
 * AIF property: isSubtypeOf (for scheme hierarchies)
 */
export const AIF_IS_SUBTYPE_OF = `${AIF_NAMESPACE}isSubtypeOf`;

// ============================================================================
// RDF/RDFS/OWL Standard Properties
// ============================================================================

/**
 * RDF type property
 */
export const RDF_TYPE = `${RDF_NAMESPACE}type`;

/**
 * RDFS label property
 */
export const RDFS_LABEL = `${RDFS_NAMESPACE}label`;

/**
 * RDFS comment property
 */
export const RDFS_COMMENT = `${RDFS_NAMESPACE}comment`;

/**
 * RDFS subClassOf property
 */
export const RDFS_SUBCLASS_OF = `${RDFS_NAMESPACE}subClassOf`;

/**
 * OWL Class
 */
export const OWL_CLASS = `${OWL_NAMESPACE}Class`;

/**
 * OWL ObjectProperty
 */
export const OWL_OBJECT_PROPERTY = `${OWL_NAMESPACE}ObjectProperty`;

/**
 * OWL DatatypeProperty
 */
export const OWL_DATATYPE_PROPERTY = `${OWL_NAMESPACE}DatatypeProperty`;

// ============================================================================
// Mesh Extension Properties
// ============================================================================

/**
 * Mesh property: clusterTag
 */
export const MESH_CLUSTER_TAG = `${MESH_NAMESPACE}clusterTag`;

// Phase 3 step 13: MESH_INHERIT_CQS retired with the `inheritCQs` column.

/**
 * Mesh property: hasAncestor (transitive)
 */
export const MESH_HAS_ANCESTOR = `${MESH_NAMESPACE}hasAncestor`;

/**
 * Mesh property: inheritedFrom
 */
export const MESH_INHERITED_FROM = `${MESH_NAMESPACE}inheritedFrom`;

/**
 * Mesh property: inheritanceDepth
 */
export const MESH_INHERITANCE_DEPTH = `${MESH_NAMESPACE}inheritanceDepth`;

/**
 * Mesh property: questionOrder
 */
export const MESH_QUESTION_ORDER = `${MESH_NAMESPACE}questionOrder`;

/**
 * Mesh property: attackKind (UNDERMINES, UNDERCUTS, REBUTS)
 */
export const MESH_ATTACK_KIND = `${MESH_NAMESPACE}attackKind`;

/**
 * Mesh property: schemeCategory
 */
export const MESH_SCHEME_CATEGORY = `${MESH_NAMESPACE}schemeCategory`;

/**
 * Mesh property: createdAt
 */
export const MESH_CREATED_AT = `${MESH_NAMESPACE}createdAt`;

/**
 * Mesh property: updatedAt
 */
export const MESH_UPDATED_AT = `${MESH_NAMESPACE}updatedAt`;

/**
 * Mesh property: confidence
 */
export const MESH_CONFIDENCE = `${MESH_NAMESPACE}confidence`;

// ============================================================================
// Mesh Extension Classes
// ============================================================================

/**
 * Mesh class: QuestionInheritance
 */
export const MESH_QUESTION_INHERITANCE_CLASS = `${MESH_NAMESPACE}QuestionInheritance`;

/**
 * Mesh property: childScheme (for QuestionInheritance)
 */
export const MESH_CHILD_SCHEME = `${MESH_NAMESPACE}childScheme`;

/**
 * Mesh property: parentScheme (for QuestionInheritance)
 */
export const MESH_PARENT_SCHEME = `${MESH_NAMESPACE}parentScheme`;

/**
 * Mesh property: inheritedQuestion (for QuestionInheritance)
 */
export const MESH_INHERITED_QUESTION = `${MESH_NAMESPACE}inheritedQuestion`;

/**
 * Mesh property: behaviourFingerprint
 *
 * Spec 4 §3.5 / §4.3 — sha256 hex of the canonical CQ-bundle digest for an
 * `ArgumentScheme`. Stamped on AIF exports of schemes (and on every RA node
 * that references a scheme) so the import path can use it as a cheap
 * candidate-set pre-filter before invoking the behaviour-equality verifier.
 *
 * The fingerprint is a NECESSARY condition for behaviour equality, never a
 * sufficient one — the verifier is what decides on import whether to attach
 * a presentation as a variant or mint a new top-level scheme.
 */
export const MESH_BEHAVIOUR_FINGERPRINT = `${MESH_NAMESPACE}behaviourFingerprint`;

// ============================================================================
// XSD Datatypes
// ============================================================================

/**
 * XSD string datatype
 */
export const XSD_STRING = `${XSD_NAMESPACE}string`;

/**
 * XSD integer datatype
 */
export const XSD_INTEGER = `${XSD_NAMESPACE}integer`;

/**
 * XSD float datatype
 */
export const XSD_FLOAT = `${XSD_NAMESPACE}float`;

/**
 * XSD boolean datatype
 */
export const XSD_BOOLEAN = `${XSD_NAMESPACE}boolean`;

/**
 * XSD dateTime datatype
 */
export const XSD_DATETIME = `${XSD_NAMESPACE}dateTime`;

// ============================================================================
// Critical Question Categories (from Walton's taxonomy)
// ============================================================================

/**
 * Standard CQ categories based on Walton's argumentation theory
 */
export const CQ_CATEGORIES = {
  PREMISES: "premises",
  EXCEPTIONS: "exceptions",
  ALTERNATIVES: "alternatives",
  SIDE_EFFECTS: "side_effects",
  EVIDENCE: "evidence",
  EXPERTISE: "expertise",
  COMMITMENT: "commitment",
  CLASSIFICATION: "classification",
} as const;

export type CQCategory = (typeof CQ_CATEGORIES)[keyof typeof CQ_CATEGORIES];

// ============================================================================
// Validation Error Codes
// ============================================================================

/**
 * AIF validation error codes
 */
export const VALIDATION_ERRORS = {
  MISSING_REQUIRED_PROPERTY: "MISSING_REQUIRED_PROPERTY",
  INVALID_URI: "INVALID_URI",
  INVALID_DATATYPE: "INVALID_DATATYPE",
  BROKEN_REFERENCE: "BROKEN_REFERENCE",
  CIRCULAR_DEPENDENCY: "CIRCULAR_DEPENDENCY",
  INVALID_RDF_SYNTAX: "INVALID_RDF_SYNTAX",
  NAMESPACE_NOT_DECLARED: "NAMESPACE_NOT_DECLARED",
  DUPLICATE_NODE: "DUPLICATE_NODE",
} as const;

/**
 * AIF validation warning codes
 */
export const VALIDATION_WARNINGS = {
  OPTIONAL_PROPERTY_MISSING: "OPTIONAL_PROPERTY_MISSING",
  INCONSISTENT_CLUSTER_TAG: "INCONSISTENT_CLUSTER_TAG",
  ORPHAN_QUESTION: "ORPHAN_QUESTION",
  INHERITANCE_DEPTH_MISMATCH: "INHERITANCE_DEPTH_MISMATCH",
  EMPTY_DESCRIPTION: "EMPTY_DESCRIPTION",
} as const;

// ============================================================================
// Export Format MIME Types
// ============================================================================

/**
 * MIME type for RDF/XML
 */
export const MIME_TYPE_RDFXML = "application/rdf+xml";

/**
 * MIME type for Turtle
 */
export const MIME_TYPE_TURTLE = "text/turtle";

/**
 * MIME type for JSON-LD
 */
export const MIME_TYPE_JSONLD = "application/ld+json";

/**
 * Map export format to MIME type
 */
export const FORMAT_TO_MIME_TYPE = {
  rdfxml: MIME_TYPE_RDFXML,
  turtle: MIME_TYPE_TURTLE,
  jsonld: MIME_TYPE_JSONLD,
} as const;

// ============================================================================
// Performance Targets
// ============================================================================

/**
 * Performance target: Ancestor chain query (ms)
 */
export const PERF_TARGET_ANCESTOR_CHAIN = 10;

/**
 * Performance target: Descendant tree query (ms)
 */
export const PERF_TARGET_DESCENDANT_TREE = 50;

/**
 * Performance target: Property inference (ms)
 */
export const PERF_TARGET_PROPERTY_INFERENCE = 100;

/**
 * Performance target: Single scheme export (ms)
 */
export const PERF_TARGET_SINGLE_EXPORT = 200;

/**
 * Performance target: Cluster family export (ms)
 */
export const PERF_TARGET_CLUSTER_EXPORT = 500;

/**
 * Performance target: CQ suggestions (ms)
 */
export const PERF_TARGET_CQ_SUGGESTIONS = 150;
