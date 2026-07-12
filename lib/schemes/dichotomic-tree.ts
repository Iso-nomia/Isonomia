// lib/schemes/dichotomic-tree.ts

import type { ArgumentScheme } from "@prisma/client";

/**
 * Purpose types for dichotomic tree filtering
 */
export type Purpose = "action" | "state_of_affairs";

/**
 * Source types for dichotomic tree filtering
 */
export type Source = "internal" | "external";

/**
 * User selections in the wizard
 */
export interface WizardSelections {
  purpose: Purpose | null;
  source: Source | null;
}

/**
 * Purpose option definitions
 */
export const purposeOptions = {
  action: {
    label: "Justify an Action",
    helpText: "Arguments that recommend, justify, or criticize a course of action or policy. These arguments help decide what to do.",
    examples: [
      "We should implement this policy",
      "You ought to choose this option",
      "This action is morally wrong"
    ],
    icon: "𝒜"
  },
  state_of_affairs: {
    label: "Describe a State of Affairs",
    helpText: "Arguments that describe how things are, explain why something happened, or predict what will happen. These arguments help understand the world.",
    examples: [
      "This is a case of X",
      "Y caused Z to happen",
      "This situation is similar to that one"
    ],
    icon: "𝒮"
  }
};

/**
 * Source option definitions
 */
export const sourceOptions = {
  internal: {
    label: "Internal Evidence",
    helpText: "Evidence that comes from reasoning, logic, or the nature of the situation itself. This includes analogies, definitions, consequences, and logical relationships.",
    examples: [
      "Based on the definition of X",
      "This is similar to that case",
      "This action will lead to Y",
      "It follows logically that..."
    ],
    icon: "∴"
  },
  external: {
    label: "External Evidence",
    helpText: "Evidence that comes from outside sources such as expert testimony, popular opinion, tradition, or empirical observation.",
    examples: [
      "Experts say that...",
      "Most people believe...",
      "We've always done it this way",
      "The evidence shows..."
    ],
    icon: "∵"
  }
};

/**
 * Filter schemes by purpose
 */
export function filterSchemesByPurpose(
  schemes: ArgumentScheme[],
  purpose: Purpose
): ArgumentScheme[] {
  return schemes.filter(scheme => 
    scheme.purpose === purpose || 
    scheme.purpose === null // Include schemes that work for both
  );
}

/**
 * Filter schemes by source
 */
export function filterSchemesBySource(
  schemes: ArgumentScheme[],
  source: Source
): ArgumentScheme[] {
  return schemes.filter(scheme => 
    scheme.source === source || 
    scheme.source === null // Include schemes that work for both
  );
}

/**
 * Filter schemes by both purpose and source
 * Sorts results with exact matches first
 */
export function filterSchemesByPurposeAndSource(
  schemes: ArgumentScheme[],
  purpose: Purpose,
  source: Source
): ArgumentScheme[] {
  let filtered = filterSchemesByPurpose(schemes, purpose);
  filtered = filterSchemesBySource(filtered, source);
  
  // Sort by relevance (schemes matching both criteria first)
  return filtered.sort((a, b) => {
    const aMatchesBoth = a.purpose === purpose && a.source === source;
    const bMatchesBoth = b.purpose === purpose && b.source === source;
    
    if (aMatchesBoth && !bMatchesBoth) return -1;
    if (!aMatchesBoth && bMatchesBoth) return 1;
    return 0;
  });
}

/**
 * Get explanation for a purpose selection
 */
export function getPurposeExplanation(purpose: Purpose): string {
  return purposeOptions[purpose].helpText;
}

/**
 * Get explanation for a source selection
 */
export function getSourceExplanation(source: Source): string {
  return sourceOptions[source].helpText;
}

/**
 * Generate match reason for a filtered scheme
 */
export function getMatchReason(
  scheme: ArgumentScheme,
  purpose: Purpose,
  source: Source
): string {
  const matchesPurpose = scheme.purpose === purpose;
  const matchesSource = scheme.source === source;
  
  if (matchesPurpose && matchesSource) {
    return `Perfect match: ${purposeOptions[purpose].label} + ${sourceOptions[source].label}`;
  }
  
  if (matchesPurpose) {
    return `Matches purpose: ${purposeOptions[purpose].label}`;
  }
  
  if (matchesSource) {
    return `Matches evidence type: ${sourceOptions[source].label}`;
  }
  
  return "Compatible with your selections";
}

/**
 * Get estimated result count (for preview before filtering)
 */
export function getEstimatedResultCount(
  allSchemes: ArgumentScheme[],
  purpose: Purpose | null,
  source: Source | null
): number {
  if (!purpose && !source) return allSchemes.length;
  
  if (purpose && source) {
    return filterSchemesByPurposeAndSource(allSchemes, purpose, source).length;
  }
  
  if (purpose) {
    return filterSchemesByPurpose(allSchemes, purpose).length;
  }
  
  if (source) {
    return filterSchemesBySource(allSchemes, source).length;
  }
  
  return allSchemes.length;
}
