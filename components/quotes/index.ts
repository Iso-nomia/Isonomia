/**
 * Quote Components - Barrel Export
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * Re-exports all quote-related UI components.
 */

// Quote Card components
export {
  QuoteCard,
  QuoteCardCompact,
  QuoteCardSkeleton,
  QuoteList,
  type QuoteCardData,
  type QuoteCardProps,
  type QuoteCardCompactProps,
  type QuoteUsageData,
  type QuoteListProps,
} from "./QuoteCard";

// Interpretation Card components
export {
  InterpretationCard,
  InterpretationCardCompact,
  InterpretationCardSkeleton,
  InterpretationList,
  type InterpretationCardData,
  type InterpretationCardProps,
  type InterpretationAuthor,
  type InterpretationListProps,
} from "./InterpretationCard";

// Interpretations Panel
export {
  InterpretationsPanel,
  InterpretationsPanelSkeleton,
  type InterpretationsPanelProps,
} from "./InterpretationsPanel";

// Quote Modals
export {
  CreateQuoteModal,
  QuoteLinkModal,
  CreateInterpretationModal,
  type CreateQuoteModalProps,
  type QuoteLinkModalProps,
  type QuoteLinkTarget,
  type CreateInterpretationModalProps,
} from "./QuoteModals";
