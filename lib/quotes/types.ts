/**
 * Type definitions for Quote Nodes and Interpretations
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * Makes textual quotes first-class addressable objects for HSS scholarly work.
 */

// ─────────────────────────────────────────────────────────
// Enums (mirror Prisma schema)
// ─────────────────────────────────────────────────────────

export type LocatorType =
  | "PAGE"       // p. 42
  | "SECTION"    // §3.2
  | "CHAPTER"    // Ch. 5
  | "VERSE"      // 3:16
  | "TIMESTAMP"  // 01:23:45
  | "LINE"       // line 123
  | "PARAGRAPH"  // ¶12
  | "CUSTOM";    // User-defined

export type QuoteUsageType =
  | "EVIDENCE"    // Quote supports the claim/argument
  | "COUNTER"     // Quote challenges the claim/argument
  | "CONTEXT"     // Quote provides background
  | "DEFINITION"  // Quote defines a key term
  | "METHODOLOGY"; // Quote describes method

// ─────────────────────────────────────────────────────────
// Locator Display Helpers
// ─────────────────────────────────────────────────────────

export const LOCATOR_TYPE_PREFIXES: Record<LocatorType, string> = {
  PAGE: "p.",
  SECTION: "§",
  CHAPTER: "Ch.",
  VERSE: "",
  TIMESTAMP: "",
  LINE: "l.",
  PARAGRAPH: "¶",
  CUSTOM: "",
};

export const LOCATOR_TYPE_LABELS: Record<LocatorType, string> = {
  PAGE: "Page",
  SECTION: "Section",
  CHAPTER: "Chapter",
  VERSE: "Verse",
  TIMESTAMP: "Timestamp",
  LINE: "Line",
  PARAGRAPH: "Paragraph",
  CUSTOM: "Custom",
};

export const QUOTE_USAGE_LABELS: Record<QuoteUsageType, string> = {
  EVIDENCE: "Supporting Evidence",
  COUNTER: "Counter-Evidence",
  CONTEXT: "Context",
  DEFINITION: "Definition",
  METHODOLOGY: "Methodology",
};

export const QUOTE_USAGE_COLORS: Record<QuoteUsageType, string> = {
  EVIDENCE: "text-green-600",
  COUNTER: "text-red-600",
  CONTEXT: "text-blue-600",
  DEFINITION: "text-purple-600",
  METHODOLOGY: "text-amber-600",
};

// ─────────────────────────────────────────────────────────
// Quote Node Types
// ─────────────────────────────────────────────────────────

export interface CreateQuoteOptions {
  sourceId: string;
  text: string;
  locator?: string;
  locatorType?: LocatorType;
  context?: string;
  language?: string;
  isTranslation?: boolean;
  originalQuoteId?: string;
}

export interface SourceSummary {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  kind?: string;
}

export interface UserSummary {
  id: string;
  name: string;
  image?: string;
}

export interface QuoteNodeSummary {
  id: string;
  text: string;
  locator?: string;
  locatorType: LocatorType;
  language: string;
  isTranslation: boolean;
  source: SourceSummary;
  interpretationCount: number;
  usageCount: number;
  createdBy: UserSummary;
  createdAt: Date;
}

export interface QuoteNodeDetail extends QuoteNodeSummary {
  context?: string;
  originalQuote?: {
    id: string;
    text: string;
    language: string;
  };
  translations: Array<{
    id: string;
    text: string;
    language: string;
  }>;
  interpretations: InterpretationWithVotes[];
  usedInClaims: QuoteUsageInfo[];
  usedInArguments: QuoteUsageInfo[];
  deliberation?: {
    id: string;
    title: string;
  };
}

export interface QuoteUsageInfo {
  id: string;
  usageType: QuoteUsageType;
  usageNote?: string;
  target: {
    id: string;
    type: "claim" | "argument";
    text: string;
  };
  addedAt: Date;
}

// ─────────────────────────────────────────────────────────
// Interpretation Types
// ─────────────────────────────────────────────────────────

export interface CreateInterpretationOptions {
  quoteId: string;
  interpretation: string;
  framework?: string;
  methodology?: string;
  supportsId?: string;
  challengesId?: string;
}

export interface InterpretationSummary {
  id: string;
  interpretation: string;
  framework?: string;
  methodology?: string;
  author: UserSummary;
  voteScore: number;
  createdAt: Date;
}

export interface InterpretationWithVotes extends InterpretationSummary {
  userVote?: number; // +1, -1, or undefined
  supportedBy: InterpretationSummary[];
  challengedBy: InterpretationSummary[];
}

export interface VoteResult {
  action: "created" | "changed" | "removed";
  newScore: number;
}

// ─────────────────────────────────────────────────────────
// Search & Filter Types
// ─────────────────────────────────────────────────────────

export interface QuoteSearchFilters {
  sourceId?: string;
  authorId?: string;
  framework?: string;
  language?: string;
  hasInterpretations?: boolean;
  searchText?: string;
  deliberationId?: string;
}

export interface QuoteSearchResult {
  quotes: QuoteNodeSummary[];
  total: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────
// Link Quote Types
// ─────────────────────────────────────────────────────────

export interface LinkQuoteToClaimOptions {
  quoteId: string;
  claimId: string;
  usageType: QuoteUsageType;
  usageNote?: string;
}

export interface LinkQuoteToArgumentOptions {
  quoteId: string;
  argumentId: string;
  usageType: QuoteUsageType;
  premiseIndex?: number;
  usageNote?: string;
}

// ─────────────────────────────────────────────────────────
// Framework Statistics
// ─────────────────────────────────────────────────────────

export interface FrameworkStats {
  framework: string;
  count: number;
  percentage: number;
}

// ─────────────────────────────────────────────────────────
// Display Helpers
// ─────────────────────────────────────────────────────────

/**
 * Format a locator for display (e.g., "p. 42", "§3.2")
 */
export function formatLocator(locator: string, type: LocatorType): string {
  const prefix = LOCATOR_TYPE_PREFIXES[type];
  if (!prefix) return locator;
  return `${prefix} ${locator}`;
}

/**
 * Truncate quote text for preview
 */
export function truncateQuote(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Get language display name
 */
export function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: "English",
    de: "German",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    pt: "Portuguese",
    el: "Greek",
    la: "Latin",
    he: "Hebrew",
    ar: "Arabic",
    zh: "Chinese",
    ja: "Japanese",
    ru: "Russian",
  };
  return names[code] || code.toUpperCase();
}
