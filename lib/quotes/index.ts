/**
 * Quote Module - Barrel Exports
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 */

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type {
  // Enums
  LocatorType,
  QuoteUsageType,
  
  // Quote types
  CreateQuoteOptions,
  SourceSummary,
  UserSummary,
  QuoteNodeSummary,
  QuoteNodeDetail,
  QuoteUsageInfo,
  
  // Interpretation types
  CreateInterpretationOptions,
  InterpretationSummary,
  InterpretationWithVotes,
  VoteResult,
  
  // Search types
  QuoteSearchFilters,
  QuoteSearchResult,
  
  // Link types
  LinkQuoteToClaimOptions,
  LinkQuoteToArgumentOptions,
  
  // Stats
  FrameworkStats,
} from "./types";

export {
  // Display helpers
  LOCATOR_TYPE_PREFIXES,
  LOCATOR_TYPE_LABELS,
  QUOTE_USAGE_LABELS,
  QUOTE_USAGE_COLORS,
  formatLocator,
  truncateQuote,
  getLanguageName,
} from "./types";

// ─────────────────────────────────────────────────────────
// Quote Service
// ─────────────────────────────────────────────────────────

export {
  createQuote,
  getQuote,
  searchQuotes,
  getQuotesBySource,
  linkQuoteToClaim,
  unlinkQuoteFromClaim,
  linkQuoteToArgument,
  unlinkQuoteFromArgument,
  createQuoteDeliberation,
  updateQuote,
  deleteQuote,
} from "./quoteService";

// ─────────────────────────────────────────────────────────
// Interpretation Service
// ─────────────────────────────────────────────────────────

export {
  createInterpretation,
  getInterpretations,
  getInterpretation,
  voteOnInterpretation,
  updateInterpretation,
  deleteInterpretation,
  getFrameworksInUse,
  getTopInterpretationsByFramework,
} from "./interpretationService";
