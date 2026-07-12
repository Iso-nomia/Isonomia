/**
 * Compatibility Layer for Multi-Scheme Arguments (Phase 1.2)
 * 
 * Provides backward compatibility between legacy single-scheme arguments
 * and new multi-scheme structure. Allows code to work with both formats.
 */

import type { ArgumentScheme } from "@prisma/client";
import type { 
  ArgumentWithSchemes,
  OrganizedSchemes 
} from "@/lib/types/argument-net";
import { featureFlags } from "@/lib/feature-flags";

/**
 * Get the primary scheme from either old or new structure
 * 
 * Priority:
 * 1. New multi-scheme structure (argumentSchemes with role="primary")
 * 2. Legacy single scheme (schemeId + scheme relation)
 * 3. undefined (no scheme)
 */
export function getArgumentScheme(
  arg: ArgumentWithSchemes
): ArgumentScheme | undefined {
  // Try new multi-scheme structure first
  const primaryInstance = arg.argumentSchemes?.find(
    (si) => si.role === "primary" || si.isPrimary
  );
  
  if (primaryInstance) {
    return primaryInstance.scheme;
  }

  // Fall back to legacy single scheme
  if (arg.scheme) {
    return arg.scheme;
  }

  return undefined;
}

/**
 * Get scheme ID from either structure
 */
export function getArgumentSchemeId(
  arg: ArgumentWithSchemes
): string | undefined {
  // Try new multi-scheme structure first
  const primaryInstance = arg.argumentSchemes?.find(
    (si) => si.role === "primary" || si.isPrimary
  );
  
  if (primaryInstance) {
    return primaryInstance.schemeId;
  }

  // Fall back to legacy schemeId field
  return arg.schemeId || undefined;
}

/**
 * Get scheme name from either structure
 */
export function getArgumentSchemeName(
  arg: ArgumentWithSchemes
): string | undefined {
  const scheme = getArgumentScheme(arg);
  return scheme?.name || undefined;
}

/**
 * Check if argument uses new multi-scheme structure
 */
export function usesMultiScheme(arg: ArgumentWithSchemes): boolean {
  return (arg.argumentSchemes?.length ?? 0) > 0;
}

/**
 * Check if argument uses legacy single-scheme structure only
 */
export function usesLegacyScheme(arg: ArgumentWithSchemes): boolean {
  return !usesMultiScheme(arg) && arg.schemeId !== null;
}

/**
 * Check if argument has no scheme at all
 */
export function hasNoScheme(arg: ArgumentWithSchemes): boolean {
  return !usesMultiScheme(arg) && arg.schemeId === null;
}

/**
 * Convert legacy single-scheme argument to multi-scheme structure (in-memory)
 * 
 * This creates a virtual ArgumentSchemeInstance for the legacy scheme
 * without modifying the database.
 */
export function normalizeArgumentSchemes(
  arg: ArgumentWithSchemes
): ArgumentWithSchemes {
  // If already has scheme instances, return as-is
  if (usesMultiScheme(arg)) {
    return arg;
  }

  // If no legacy scheme, return as-is
  if (!arg.schemeId || !arg.scheme) {
    return arg;
  }

  // Create virtual scheme instance from legacy data
  const virtualInstance = {
    id: `virtual_${arg.id}_${arg.schemeId}`,
    argumentId: arg.id,
    schemeId: arg.schemeId,
    confidence: arg.confidence || 1.0,
    isPrimary: true,
    role: "primary" as const,
    explicitness: "explicit" as const,
    order: 0,
    textEvidence: null,
    justification: null,
    ruleType: "DEFEASIBLE" as const,
    ruleName: null,
    epistemicMode: null,
    verifierVerdict: null,
    createdAt: arg.createdAt,
    updatedAt: arg.lastUpdatedAt || arg.createdAt,
    scheme: arg.scheme,
  };

  return {
    ...arg,
    argumentSchemes: [virtualInstance],
  };
}

/**
 * Get all schemes from argument (handles both structures)
 * 
 * Returns array of schemes with their metadata.
 */
export function getAllArgumentSchemes(arg: ArgumentWithSchemes): {
  schemeId: string;
  scheme: ArgumentScheme;
  isPrimary: boolean;
  role: string;
  confidence: number;
}[] {
  if (usesMultiScheme(arg)) {
    return arg.argumentSchemes.map((inst) => ({
      schemeId: inst.schemeId,
      scheme: inst.scheme,
      isPrimary: inst.isPrimary,
      role: inst.role,
      confidence: inst.confidence,
    }));
  }

  // Legacy single scheme
  if (arg.schemeId && arg.scheme) {
    return [
      {
        schemeId: arg.schemeId,
        scheme: arg.scheme,
        isPrimary: true,
        role: "primary",
        confidence: arg.confidence || 1.0,
      },
    ];
  }

  return [];
}

/**
 * Get count of schemes (works with both structures)
 */
export function getSchemeCount(arg: ArgumentWithSchemes): number {
  if (usesMultiScheme(arg)) {
    return arg.argumentSchemes.length;
  }

  return arg.schemeId ? 1 : 0;
}

/**
 * Format scheme display text for UI
 * 
 * Examples:
 * - "Practical Reasoning"
 * - "Practical Reasoning + 2 more"
 * - "No scheme"
 */
export function formatSchemeDisplay(arg: ArgumentWithSchemes): string {
  const normalized = normalizeArgumentSchemes(arg);
  const count = normalized.argumentSchemes?.length ?? 0;

  if (count === 0) {
    return "No scheme";
  }

  const primaryScheme = normalized.argumentSchemes?.find(
    (si) => si.role === "primary" || si.isPrimary
  );

  if (!primaryScheme) {
    return `${count} scheme${count > 1 ? "s" : ""}`;
  }

  const primaryName = primaryScheme.scheme.name || "Unnamed scheme";

  if (count === 1) {
    return primaryName;
  }

  return `${primaryName} + ${count - 1} more`;
}

/**
 * Check if argument should show multi-scheme UI
 * Respects the ENABLE_MULTI_SCHEME feature flag
 */
export function shouldShowMultiSchemeUI(arg: ArgumentWithSchemes): boolean {
  // Check feature flag first
  if (!featureFlags.ENABLE_MULTI_SCHEME) {
    return false;
  }
  return usesMultiScheme(arg) && arg.argumentSchemes.length > 1;
}

/**
 * Get scheme badge variant based on count
 */
export function getSchemeBadgeVariant(
  arg: ArgumentWithSchemes
): "default" | "secondary" | "outline" {
  const count = getSchemeCount(arg);

  if (count === 0) return "outline";
  if (count === 1) return "secondary";
  return "default"; // Multi-scheme
}

/**
 * Migration helper: Check if argument needs migration to new structure
 */
export function needsMigration(arg: ArgumentWithSchemes): boolean {
  return usesLegacyScheme(arg) && !usesMultiScheme(arg);
}

/**
 * Get migration status for display
 */
export function getMigrationStatus(arg: ArgumentWithSchemes): {
  status: "legacy" | "multi-scheme" | "no-scheme";
  needsMigration: boolean;
  schemeCount: number;
} {
  if (hasNoScheme(arg)) {
    return {
      status: "no-scheme",
      needsMigration: false,
      schemeCount: 0,
    };
  }

  if (usesMultiScheme(arg)) {
    return {
      status: "multi-scheme",
      needsMigration: false,
      schemeCount: arg.argumentSchemes.length,
    };
  }

  return {
    status: "legacy",
    needsMigration: true,
    schemeCount: 1,
  };
}

/**
 * Get tooltip text for scheme badge
 */
export function getSchemeTooltip(arg: ArgumentWithSchemes): string {
  const normalized = normalizeArgumentSchemes(arg);
  const count = normalized.argumentSchemes?.length ?? 0;

  if (count === 0) {
    return "No argumentation scheme assigned";
  }

  if (count === 1) {
    const scheme = normalized.argumentSchemes[0];
    return `Scheme: ${scheme.scheme.name || "Unnamed"} (${Math.round(scheme.confidence * 100)}% confidence)`;
  }

  const primary = normalized.argumentSchemes.find(
    (si) => si.role === "primary" || si.isPrimary
  );
  const supporting = normalized.argumentSchemes.filter(
    (si) => si.role === "supporting"
  );
  const presupposed = normalized.argumentSchemes.filter(
    (si) => si.role === "presupposed"
  );

  const parts: string[] = [];
  
  if (primary) {
    parts.push(`Primary: ${primary.scheme.name}`);
  }
  
  if (supporting.length > 0) {
    parts.push(`${supporting.length} supporting`);
  }
  
  if (presupposed.length > 0) {
    parts.push(`${presupposed.length} presupposed`);
  }

  return parts.join(" • ");
}

/**
 * Helper for components that need to handle both structures
 * 
 * Usage:
 * ```typescript
 * const compat = getCompatibilityHelpers(argument);
 * console.log(compat.primaryScheme.name);
 * console.log(compat.isMultiScheme);
 * ```
 */
export function getCompatibilityHelpers(arg: ArgumentWithSchemes) {
  const normalized = normalizeArgumentSchemes(arg);
  const primaryInstance = normalized.argumentSchemes.find(
    (si) => si.role === "primary" || si.isPrimary
  );

  return {
    // Structure info
    isMultiScheme: shouldShowMultiSchemeUI(normalized),
    isLegacy: usesLegacyScheme(arg),
    hasScheme: getSchemeCount(arg) > 0,
    schemeCount: getSchemeCount(arg),
    
    // Scheme access
    primaryScheme: primaryInstance?.scheme,
    primarySchemeId: primaryInstance?.schemeId,
    allSchemes: getAllArgumentSchemes(arg),
    
    // Display
    displayText: formatSchemeDisplay(arg),
    tooltipText: getSchemeTooltip(arg),
    badgeVariant: getSchemeBadgeVariant(arg),
    
    // Normalized data
    normalized,
  };
}
