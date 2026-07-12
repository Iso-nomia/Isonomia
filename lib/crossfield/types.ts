/**
 * Phase 5.1: Types for cross-field mapping and discovery
 */

// ============================================================
// Enum Types (mirror Prisma enums)
// ============================================================

export type EpistemicStyle =
  | "EMPIRICAL"
  | "INTERPRETIVE"
  | "FORMAL"
  | "NORMATIVE"
  | "HISTORICAL"
  | "MIXED";

export type FieldRelationType =
  | "PARENT_CHILD"
  | "OVERLAPPING"
  | "COMPLEMENTARY"
  | "METHODOLOGICAL"
  | "HISTORICAL_RELATION"
  | "INTERDISCIPLINARY";

export type ConceptEquivalenceType =
  | "IDENTICAL"
  | "SIMILAR"
  | "OVERLAPPING"
  | "RELATED"
  | "TRANSLATES_TO"
  | "CONTRASTING";

export type ConceptEquivalenceStatus =
  | "PROPOSED"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "CONTESTED"
  | "REJECTED";

export type CrossFieldAlertType =
  | "SIMILAR_CLAIM"
  | "NEW_EQUIVALENCE"
  | "TRANSLATION_READY"
  | "FIELD_DISCUSSION"
  | "COLLABORATION_MATCH";

export type CrossFieldAlertStatus = "UNREAD" | "READ" | "DISMISSED" | "ACTIONED";

// ============================================================
// Field Taxonomy Types
// ============================================================

export interface AcademicFieldSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentFieldId?: string;
  parentFieldName?: string;
  epistemicStyle: EpistemicStyle;
  subFieldCount: number;
  claimCount: number;
  conceptCount: number;
}

export interface FieldHierarchy {
  id: string;
  name: string;
  slug: string;
  epistemicStyle: EpistemicStyle;
  children: FieldHierarchy[];
}

export interface FieldWithRelations {
  id: string;
  name: string;
  slug: string;
  description?: string;
  epistemicStyle: EpistemicStyle;
  aliases: string[];
  keyTerms: string[];
  parent?: AcademicFieldSummary;
  subFields: AcademicFieldSummary[];
  relatedFields: Array<{
    field: AcademicFieldSummary;
    relationType: FieldRelationType;
    strength: number;
  }>;
}

// ============================================================
// Concept Types
// ============================================================

export interface ConceptSummary {
  id: string;
  name: string;
  definition: string;
  fieldId: string;
  fieldName: string;
  aliases: string[];
  equivalenceCount: number;
  claimCount: number;
}

export interface ConceptWithEquivalences {
  id: string;
  name: string;
  definition: string;
  field: AcademicFieldSummary;
  aliases: string[];
  relatedTerms: string[];
  equivalences: Array<{
    targetConcept: ConceptSummary;
    equivalenceType: ConceptEquivalenceType;
    confidence: number;
    status: ConceptEquivalenceStatus;
  }>;
}

export interface ConceptEquivalenceProposal {
  sourceConceptId: string;
  targetConceptId: string;
  equivalenceType: ConceptEquivalenceType;
  justification: string;
}

// ============================================================
// Alert Types
// ============================================================

export interface CrossFieldAlertData {
  id: string;
  alertType: CrossFieldAlertType;
  title: string;
  description: string;
  sourceField?: string;
  targetField?: string;
  matchScore?: number;
  sourceClaimId?: string;
  targetClaimId?: string;
  conceptId?: string;
  status: CrossFieldAlertStatus;
  createdAt: Date;
}

export interface AlertPreferences {
  similarClaims: boolean;
  newEquivalences: boolean;
  translationReady: boolean;
  fieldDiscussions: boolean;
  collaborationMatches: boolean;
  fieldsOfInterest: string[];
  minMatchScore: number;
}

// ============================================================
// Search & Discovery Types
// ============================================================

export interface CrossFieldSearchParams {
  query: string;
  sourceField?: string;
  targetFields?: string[];
  minSimilarity?: number;
  includeRelatedConcepts?: boolean;
  limit?: number;
}

export interface CrossFieldSearchResult {
  claims: Array<{
    claimId: string;
    claimText: string;
    field: AcademicFieldSummary;
    similarity: number;
    matchedConcepts: string[];
  }>;
  concepts: Array<{
    concept: ConceptSummary;
    equivalentTo: ConceptSummary[];
    similarity: number;
  }>;
  suggestedEquivalences: Array<{
    sourceConcept: ConceptSummary;
    targetConcept: ConceptSummary;
    confidence: number;
  }>;
}
