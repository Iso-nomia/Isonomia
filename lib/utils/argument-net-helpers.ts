/**
 * Helper Functions for ArgumentNet (Phase 1.1)
 * 
 * Utility functions for working with multi-scheme arguments, including
 * filtering, validation, styling, and statistics.
 */

import type {
  ArgumentWithSchemes,
  ArgumentSchemeInstanceWithScheme,
  OrganizedSchemes,
  SchemeRole,
  ExplicitnessLevel,
  DependencyType,
  ExplicitnessStyle,
  RoleStyle,
  DependencyTypeFormat,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ArgumentSchemeStatistics,
} from "@/lib/types/argument-net";

// ============================================================================
// Scheme Accessors
// ============================================================================

/**
 * Get the primary scheme from an argument (main inferential pattern)
 */
export function getPrimaryScheme(
  arg: ArgumentWithSchemes
): ArgumentSchemeInstanceWithScheme | undefined {
  return arg.argumentSchemes.find((si) => si.role === "primary");
}

/**
 * Get all supporting schemes (enable premises)
 */
export function getSupportingSchemes(
  arg: ArgumentWithSchemes
): ArgumentSchemeInstanceWithScheme[] {
  return arg.argumentSchemes
    .filter((si) => si.role === "supporting")
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all presupposed schemes (background assumptions)
 */
export function getPresupposedSchemes(
  arg: ArgumentWithSchemes
): ArgumentSchemeInstanceWithScheme[] {
  return arg.argumentSchemes
    .filter((si) => si.role === "presupposed")
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all implicit schemes (recoverable from context)
 */
export function getImplicitSchemes(
  arg: ArgumentWithSchemes
): ArgumentSchemeInstanceWithScheme[] {
  return arg.argumentSchemes
    .filter((si) => si.role === "implicit")
    .sort((a, b) => a.order - b.order);
}

/**
 * Organize schemes by role for easy access
 */
export function organizeSchemesByRole(
  arg: ArgumentWithSchemes
): OrganizedSchemes {
  return {
    primary: getPrimaryScheme(arg) || null,
    supporting: getSupportingSchemes(arg),
    presupposed: getPresupposedSchemes(arg),
    implicit: getImplicitSchemes(arg),
    all: arg.argumentSchemes.sort((a, b) => {
      // Sort by role order: primary, supporting, presupposed, implicit
      const roleOrder = { primary: 0, supporting: 1, presupposed: 2, implicit: 3 };
      const roleA = roleOrder[a.role as SchemeRole] || 99;
      const roleB = roleOrder[b.role as SchemeRole] || 99;
      if (roleA !== roleB) return roleA - roleB;
      // Within same role, sort by order field
      return a.order - b.order;
    }),
  };
}

/**
 * Get scheme instance by role and order
 */
export function getSchemeByRole(
  arg: ArgumentWithSchemes,
  role: SchemeRole,
  order = 0
): ArgumentSchemeInstanceWithScheme | undefined {
  return arg.argumentSchemes.find((si) => si.role === role && si.order === order);
}

// ============================================================================
// Scheme Checks
// ============================================================================

/**
 * Check if argument uses multiple schemes
 */
export function isMultiSchemeArgument(arg: ArgumentWithSchemes): boolean {
  return arg.argumentSchemes.length > 1;
}

/**
 * Get total count of schemes
 */
export function getSchemeCount(arg: ArgumentWithSchemes): number {
  return arg.argumentSchemes.length;
}

/**
 * Check if argument has a specific role
 */
export function hasSchemeRole(
  arg: ArgumentWithSchemes,
  role: SchemeRole
): boolean {
  return arg.argumentSchemes.some((si) => si.role === role);
}

/**
 * Check if argument has explicit schemes
 */
export function hasExplicitSchemes(arg: ArgumentWithSchemes): boolean {
  return arg.argumentSchemes.some((si) => si.explicitness === "explicit");
}

/**
 * Check if argument has implicit/presupposed schemes
 */
export function hasImplicitSchemes(arg: ArgumentWithSchemes): boolean {
  return arg.argumentSchemes.some(
    (si) => si.explicitness === "presupposed" || si.explicitness === "implied"
  );
}

// ============================================================================
// Styling Helpers
// ============================================================================

/**
 * Get styling for explicitness level
 */
export function getExplicitnessStyle(level: ExplicitnessLevel): ExplicitnessStyle {
  const styles: Record<ExplicitnessLevel, ExplicitnessStyle> = {
    explicit: {
      borderStyle: "solid",
      label: "Explicit",
      description: "Clearly stated in the argument text",
      color: "sky",
      icon: "📝",
    },
    presupposed: {
      borderStyle: "dashed",
      label: "Presupposed",
      description: "Necessary but unstated assumption",
      color: "amber",
      icon: "💭",
    },
    implied: {
      borderStyle: "dotted",
      label: "Implied",
      description: "Recoverable from context",
      color: "gray",
      icon: "🔍",
    },
  };
  return styles[level];
}

/**
 * Get styling for scheme role
 */
export function getRoleStyle(role: SchemeRole): RoleStyle {
  const styles: Record<SchemeRole, RoleStyle> = {
    primary: {
      color: "text-sky-700",
      bgColor: "bg-sky-50",
      borderColor: "border-sky-300",
      label: "Primary",
      description: "Main inferential pattern",
      icon: "⭐",
    },
    supporting: {
      color: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-300",
      label: "Supporting",
      description: "Enables premises",
      icon: "🔧",
    },
    presupposed: {
      color: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-300",
      label: "Presupposed",
      description: "Background assumption",
      icon: "💭",
    },
    implicit: {
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-300",
      label: "Implicit",
      description: "Context-dependent",
      icon: "👻",
    },
  };
  return styles[role];
}

/**
 * Format dependency type for display
 */
export function formatDependencyType(type: DependencyType): DependencyTypeFormat {
  const formats: Record<DependencyType, DependencyTypeFormat> = {
    premise_conclusion: {
      label: "Premise → Conclusion",
      description: "One scheme's conclusion feeds into another's premise",
      icon: "➡️",
      color: "sky",
    },
    enables_premise: {
      label: "Enables Premise",
      description: "Provides support for another scheme's premise",
      icon: "🔓",
      color: "green",
    },
    supports_inference: {
      label: "Supports Inference",
      description: "Justifies another scheme's inference rule",
      icon: "🎯",
      color: "purple",
    },
    presupposes: {
      label: "Presupposes",
      description: "Assumes another scheme as background",
      icon: "💭",
      color: "amber",
    },
    sequential: {
      label: "Sequential",
      description: "Applied in cognitive/temporal order",
      icon: "📊",
      color: "gray",
    },
  };
  return formats[type];
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate argument net structure
 */
export function validateArgumentNet(arg: ArgumentWithSchemes): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Rule 1: Must have exactly one primary scheme (or none for legacy)
  const primarySchemes = arg.argumentSchemes.filter((si) => si.role === "primary");
  if (primarySchemes.length === 0) {
    warnings.push({
      code: "NO_PRIMARY_SCHEME",
      message: "Argument has no primary scheme (may be legacy single-scheme)",
      field: "argumentSchemes",
      suggestion: "Add a primary scheme to clarify main inferential pattern",
    });
  } else if (primarySchemes.length > 1) {
    errors.push({
      code: "MULTIPLE_PRIMARY_SCHEMES",
      message: `Argument has ${primarySchemes.length} primary schemes (must have exactly one)`,
      field: "argumentSchemes",
      value: primarySchemes.map((s) => s.id),
    });
  }

  // Rule 2: Explicit schemes should have text evidence
  const explicitWithoutEvidence = arg.argumentSchemes.filter(
    (si) => si.explicitness === "explicit" && !si.textEvidence
  );
  if (explicitWithoutEvidence.length > 0) {
    warnings.push({
      code: "EXPLICIT_MISSING_EVIDENCE",
      message: `${explicitWithoutEvidence.length} explicit scheme(s) missing text evidence`,
      field: "textEvidence",
      suggestion: "Provide text evidence showing where scheme is stated",
    });
  }

  // Rule 3: Implicit/presupposed schemes should have justification
  const implicitWithoutJustification = arg.argumentSchemes.filter(
    (si) =>
      (si.explicitness === "presupposed" || si.explicitness === "implied") &&
      !si.justification
  );
  if (implicitWithoutJustification.length > 0) {
    warnings.push({
      code: "IMPLICIT_MISSING_JUSTIFICATION",
      message: `${implicitWithoutJustification.length} implicit/presupposed scheme(s) missing justification`,
      field: "justification",
      suggestion: "Explain why this scheme is presupposed or implied",
    });
  }

  // Rule 4: No duplicate schemes
  const schemeIds = arg.argumentSchemes.map((si) => si.schemeId);
  const duplicates = schemeIds.filter(
    (id, index) => schemeIds.indexOf(id) !== index
  );
  if (duplicates.length > 0) {
    errors.push({
      code: "DUPLICATE_SCHEMES",
      message: "Argument has duplicate schemes",
      field: "argumentSchemes",
      value: Array.from(new Set(duplicates)),
    });
  }

  // Rule 5: Order should be sequential within each role
  const roleGroups = {
    primary: arg.argumentSchemes.filter((si) => si.role === "primary"),
    supporting: arg.argumentSchemes.filter((si) => si.role === "supporting"),
    presupposed: arg.argumentSchemes.filter((si) => si.role === "presupposed"),
    implicit: arg.argumentSchemes.filter((si) => si.role === "implicit"),
  };

  for (const [role, schemes] of Object.entries(roleGroups)) {
    const orders = schemes.map((s) => s.order).sort((a, b) => a - b);
    const expectedOrders = Array.from({ length: orders.length }, (_, i) => i);
    if (JSON.stringify(orders) !== JSON.stringify(expectedOrders)) {
      warnings.push({
        code: "INVALID_ORDER_SEQUENCE",
        message: `Schemes with role "${role}" have non-sequential orders`,
        field: "order",
        suggestion: "Order should be 0, 1, 2, ... within each role",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get statistics for an argument's schemes
 */
export function getArgumentSchemeStatistics(
  arg: ArgumentWithSchemes
): ArgumentSchemeStatistics {
  const schemes = arg.argumentSchemes;

  const roles = {
    primary: schemes.filter((s) => s.role === "primary").length,
    supporting: schemes.filter((s) => s.role === "supporting").length,
    presupposed: schemes.filter((s) => s.role === "presupposed").length,
    implicit: schemes.filter((s) => s.role === "implicit").length,
  };

  const explicitness = {
    explicit: schemes.filter((s) => s.explicitness === "explicit").length,
    presupposed: schemes.filter((s) => s.explicitness === "presupposed").length,
    implied: schemes.filter((s) => s.explicitness === "implied").length,
  };

  const averageConfidence =
    schemes.length > 0
      ? schemes.reduce((sum, s) => sum + s.confidence, 0) / schemes.length
      : 0;

  return {
    schemeCount: schemes.length,
    roles,
    explicitness,
    averageConfidence,
    hasDependencies: false, // Will be populated by database query
  };
}

/**
 * Get display label for scheme count
 */
export function getSchemeCountLabel(count: number): string {
  if (count === 0) return "No schemes";
  if (count === 1) return "Single scheme";
  return `${count} schemes`;
}

/**
 * Get badge variant for scheme count
 */
export function getSchemeCountVariant(
  count: number
): "default" | "secondary" | "outline" {
  if (count === 0) return "outline";
  if (count === 1) return "secondary";
  return "default";
}

// ============================================================================
// Comparison & Sorting
// ============================================================================

/**
 * Compare two scheme instances for sorting
 */
export function compareSchemeInstances(
  a: ArgumentSchemeInstanceWithScheme,
  b: ArgumentSchemeInstanceWithScheme
): number {
  // First by role
  const roleOrder = { primary: 0, supporting: 1, presupposed: 2, implicit: 3 };
  const roleA = roleOrder[a.role as SchemeRole] || 99;
  const roleB = roleOrder[b.role as SchemeRole] || 99;
  if (roleA !== roleB) return roleA - roleB;

  // Then by order
  if (a.order !== b.order) return a.order - b.order;

  // Finally by confidence (descending)
  return b.confidence - a.confidence;
}

/**
 * Sort scheme instances in standard display order
 */
export function sortSchemeInstances(
  schemes: ArgumentSchemeInstanceWithScheme[]
): ArgumentSchemeInstanceWithScheme[] {
  return [...schemes].sort(compareSchemeInstances);
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter schemes by role
 */
export function filterByRole(
  schemes: ArgumentSchemeInstanceWithScheme[],
  roles: SchemeRole[]
): ArgumentSchemeInstanceWithScheme[] {
  return schemes.filter((s) => roles.includes(s.role as SchemeRole));
}

/**
 * Filter schemes by explicitness
 */
export function filterByExplicitness(
  schemes: ArgumentSchemeInstanceWithScheme[],
  levels: ExplicitnessLevel[]
): ArgumentSchemeInstanceWithScheme[] {
  return schemes.filter((s) => levels.includes(s.explicitness as ExplicitnessLevel));
}

/**
 * Filter schemes by minimum confidence
 */
export function filterByConfidence(
  schemes: ArgumentSchemeInstanceWithScheme[],
  minConfidence: number
): ArgumentSchemeInstanceWithScheme[] {
  return schemes.filter((s) => s.confidence >= minConfidence);
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get short summary of argument's schemes for display
 */
export function getSchemeSummary(arg: ArgumentWithSchemes): string {
  const organized = organizeSchemesByRole(arg);

  if (!organized.primary) {
    return "No schemes";
  }

  const parts: string[] = [organized.primary.scheme.name || "Unnamed scheme"];

  if (organized.supporting.length > 0) {
    parts.push(`+${organized.supporting.length} supporting`);
  }

  if (organized.presupposed.length > 0) {
    parts.push(`+${organized.presupposed.length} presupposed`);
  }

  if (organized.implicit.length > 0) {
    parts.push(`+${organized.implicit.length} implicit`);
  }

  return parts.join(", ");
}

/**
 * Get tooltip text for scheme instance
 */
export function getSchemeTooltip(
  scheme: ArgumentSchemeInstanceWithScheme
): string {
  const roleName = getRoleStyle(scheme.role as SchemeRole).label;
  const explicitnessName = getExplicitnessStyle(
    scheme.explicitness as ExplicitnessLevel
  ).label;

  return `${scheme.scheme.name || "Unnamed"} (${roleName}, ${explicitnessName}, ${Math.round(scheme.confidence * 100)}% confidence)`;
}
