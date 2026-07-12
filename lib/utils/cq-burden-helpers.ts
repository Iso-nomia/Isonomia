/**
 * Helper functions for Critical Question Burden of Proof
 * Phase 0.1: Burden of Proof Enhancement
 */

import { BurdenOfProof, PremiseType } from "@prisma/client";

/**
 * Get human-readable explanation of burden allocation for a CQ
 */
export function getCQBurdenExplanation(
  burdenOfProof: BurdenOfProof,
  premiseType?: PremiseType | null
): string {
  if (burdenOfProof === "PROPONENT") {
    if (premiseType === "ASSUMPTION") {
      return "This question shifts the burden to the argument proponent. The premise is assumed acceptable unless challenged.";
    }
    return "This question shifts the burden to the argument proponent to provide justification.";
  }

  if (burdenOfProof === "CHALLENGER") {
    if (premiseType === "EXCEPTION") {
      return "The challenger must provide evidence that this exception applies.";
    }
    return "The challenger must provide evidence when raising this question.";
  }

  return "Burden of proof for this question is unclear.";
}

/**
 * Get guidance on what evidence is needed for a CQ
 */
export function getCQEvidenceGuidance(
  burdenOfProof: BurdenOfProof,
  premiseType?: PremiseType | null,
  requiresEvidence?: boolean
): string {
  if (!requiresEvidence) {
    return "No evidence required - asking the question is sufficient.";
  }

  if (burdenOfProof === "PROPONENT") {
    if (premiseType === "ORDINARY") {
      return "The proponent must provide evidence to support this premise.";
    }
    if (premiseType === "ASSUMPTION") {
      return "Once questioned, the proponent must defend this assumption with evidence.";
    }
    return "The proponent must respond with supporting evidence or reasoning.";
  }

  if (burdenOfProof === "CHALLENGER") {
    if (premiseType === "EXCEPTION") {
      return "You must provide evidence that this exception applies to the argument.";
    }
    return "You must provide evidence or examples when raising this question.";
  }

  return "Please provide relevant evidence or reasoning.";
}

/**
 * Determine whether to show evidence prompt in UI
 */
export function shouldShowEvidencePrompt(
  burdenOfProof: BurdenOfProof,
  requiresEvidence: boolean,
  isProponent: boolean
): boolean {
  // If no evidence required, never show prompt
  if (!requiresEvidence) {
    return false;
  }

  // Show prompt if user has the burden
  if (burdenOfProof === "PROPONENT" && isProponent) {
    return true;
  }

  if (burdenOfProof === "CHALLENGER" && !isProponent) {
    return true;
  }

  return false;
}

/**
 * Get badge text for burden indicator in UI
 */
export function getBurdenBadgeText(burdenOfProof: BurdenOfProof): string {
  switch (burdenOfProof) {
    case "PROPONENT":
      return "Proponent burden";
    case "CHALLENGER":
      return "Challenger burden";
    default:
      return "Unknown burden";
  }
}

/**
 * Get badge color class for burden indicator
 */
export function getBurdenBadgeColor(burdenOfProof: BurdenOfProof): string {
  switch (burdenOfProof) {
    case "PROPONENT":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300";
    case "CHALLENGER":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

/**
 * Get premise type display name
 */
export function getPremiseTypeDisplay(premiseType?: PremiseType | null): string | null {
  if (!premiseType) return null;
  
  switch (premiseType) {
    case "ORDINARY":
      return "Ordinary Premise";
    case "ASSUMPTION":
      return "Assumption";
    case "EXCEPTION":
      return "Exception";
    default:
      return null;
  }
}

/**
 * Get detailed premise type explanation
 */
export function getPremiseTypeExplanation(premiseType?: PremiseType | null): string | null {
  if (!premiseType) return null;

  switch (premiseType) {
    case "ORDINARY":
      return "Must always be supported with evidence or reasoning.";
    case "ASSUMPTION":
      return "Accepted as true unless explicitly challenged (Carneades model).";
    case "EXCEPTION":
      return "Challenger must prove this exception applies to the argument.";
    default:
      return null;
  }
}
