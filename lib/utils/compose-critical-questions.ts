// lib/utils/compose-critical-questions.ts
import { useMemo } from "react";
import type { ArgumentWithSchemes } from "@/lib/types/argument-net";
import type { ComposedCQSet, ComposedCriticalQuestion, CQFilter } from "@/lib/types/composed-cqs";

/**
 * Compose critical questions from all schemes in an argument.
 * Orders schemes by priority (primary first) and composes their CQs
 * into a unified set with metadata about sources and relationships.
 */
export function composeCriticalQuestions(argument: ArgumentWithSchemes): ComposedCQSet {
  const composedCQs: ComposedCriticalQuestion[] = [];
  let order = 0;
  
  // Sort scheme instances by priority: primary first, then by order
  const sortedInstances = [...argument.argumentSchemes].sort((a, b) => {
    // Primary always first
    const aRole = (a as any).role || (a.isPrimary ? "primary" : "supporting");
    const bRole = (b as any).role || (b.isPrimary ? "primary" : "supporting");
    
    if (aRole === "primary") return -1;
    if (bRole === "primary") return 1;
    
    // Then by order field
    const aOrder = (a as any).order || 0;
    const bOrder = (b as any).order || 0;
    return aOrder - bOrder;
  });
  
  // Compose CQs from each scheme
  sortedInstances.forEach(instance => {
    const scheme = instance.scheme;
    if (!scheme) return;
    
    const cqs = (scheme as any).criticalQuestions || [];
    const role = (instance as any).role || (instance.isPrimary ? "primary" : "supporting");
    
    cqs.forEach((cq: any) => {
      composedCQs.push({
        ...cq,
        sourceSchemeInstance: instance,
        sourceSchemeName: scheme.name || "Unknown Scheme",
        sourceSchemeRole: role,
        isFromPrimaryScheme: role === "primary",
        compositionOrder: order++,
        // Determine what this CQ targets based on its type and source
        targetsSchemeRole: determineTargetRole(cq, role)
      });
    });
  });
  
  // Group by scheme
  const byScheme = sortedInstances.map(instance => {
    const scheme = instance.scheme;
    const role = (instance as any).role || (instance.isPrimary ? "primary" : "supporting");
    
    return {
      schemeInstanceId: instance.id,
      schemeName: scheme?.name || "Unknown Scheme",
      schemeRole: role,
      schemeKey: (scheme as any)?.schemeKey || scheme?.key || "unknown",
      cqs: composedCQs.filter(cq => cq.sourceSchemeInstance.id === instance.id)
    };
  }).filter(group => group.cqs.length > 0);
  
  // Group by attack type
  const attackTypes = new Set(
    composedCQs
      .map(cq => cq.attackType)
      .filter(type => type !== null) as string[]
  );
  const byAttackType = Array.from(attackTypes).map(attackType => ({
    attackType: attackType as string,
    displayName: formatAttackType(attackType as string),
    cqs: composedCQs.filter(cq => cq.attackType === attackType)
  })).sort((a, b) => b.cqs.length - a.cqs.length); // Sort by count descending
  
  // Group by target role
  const targetRoles: Array<"primary" | "supporting" | "presupposed" | "implicit"> = 
    ["primary", "supporting", "presupposed", "implicit"];
  const byTarget = targetRoles.map(role => ({
    targetRole: role,
    cqs: composedCQs.filter(cq => cq.targetsSchemeRole === role)
  })).filter(group => group.cqs.length > 0);
  
  // Calculate statistics
  const stats = {
    fromPrimary: composedCQs.filter(cq => cq.sourceSchemeRole === "primary").length,
    fromSupporting: composedCQs.filter(cq => cq.sourceSchemeRole === "supporting").length,
    fromPresupposed: composedCQs.filter(cq => cq.sourceSchemeRole === "presupposed").length,
    fromImplicit: composedCQs.filter(cq => cq.sourceSchemeRole === "implicit").length,
    byAttackType: Object.fromEntries(
      Array.from(attackTypes).map(type => [
        type,
        composedCQs.filter(cq => cq.attackType === type).length
      ])
    )
  };
  
  return {
    argumentId: argument.id,
    totalCQs: composedCQs.length,
    byScheme,
    byAttackType,
    byTarget,
    stats
  };
}

/**
 * Determine which scheme role a CQ targets based on its attack type
 * and the role of the scheme it comes from.
 */
function determineTargetRole(
  cq: any,
  sourceRole: "primary" | "supporting" | "presupposed" | "implicit"
): "primary" | "supporting" | "presupposed" | "implicit" | undefined {
  // CQs from supporting schemes typically strengthen or challenge the primary
  if (sourceRole === "supporting") {
    return "primary";
  }
  
  // CQs from primary scheme challenge the primary inference itself
  if (sourceRole === "primary") {
    return "primary";
  }
  
  // Presupposed/implicit CQs can target various roles
  // This could be made more sophisticated based on CQ content/type
  if (sourceRole === "presupposed" || sourceRole === "implicit") {
    return "primary"; // Default to primary as most CQs challenge main inference
  }
  
  return undefined;
}

/**
 * Format attack type for display
 */
function formatAttackType(attackType: string): string {
  // Convert "exception_to_rule" to "Exception to Rule"
  return attackType
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Filter composed CQs based on multiple criteria
 */
export function filterComposedCQs(
  composedSet: ComposedCQSet,
  filters: CQFilter
): ComposedCriticalQuestion[] {
  let filtered = composedSet.byScheme.flatMap(group => group.cqs);
  
  if (filters.schemeInstanceIds?.length) {
    filtered = filtered.filter(cq =>
      filters.schemeInstanceIds!.includes(cq.sourceSchemeInstance.id)
    );
  }
  
  if (filters.attackTypes?.length) {
    filtered = filtered.filter(cq =>
      cq.attackType && filters.attackTypes!.includes(cq.attackType as string)
    );
  }
  
  if (filters.sourceRoles?.length) {
    filtered = filtered.filter(cq =>
      filters.sourceRoles!.includes(cq.sourceSchemeRole)
    );
  }
  
  if (filters.targetRoles?.length) {
    filtered = filtered.filter(cq =>
      cq.targetsSchemeRole && filters.targetRoles!.includes(cq.targetsSchemeRole)
    );
  }
  
  return filtered;
}

/**
 * Get CQ statistics for display
 */
export function getCQStatsSummary(composedSet: ComposedCQSet): string[] {
  const { stats } = composedSet;
  const summary: string[] = [];
  
  summary.push(`${composedSet.totalCQs} total critical questions`);
  
  if (stats.fromPrimary > 0) {
    summary.push(`${stats.fromPrimary} from primary scheme`);
  }
  
  if (stats.fromSupporting > 0) {
    summary.push(`${stats.fromSupporting} from supporting schemes`);
  }
  
  if (stats.fromPresupposed > 0 || stats.fromImplicit > 0) {
    const implicitTotal = stats.fromPresupposed + stats.fromImplicit;
    summary.push(`${implicitTotal} from implicit schemes`);
  }
  
  return summary;
}

/**
 * Custom hook for composing CQs with memoization
 * Use this in components for optimal performance
 */
export function useComposedCriticalQuestions(argument: ArgumentWithSchemes | null | undefined) {
  return useMemo(() => {
    if (!argument) return null;
    return composeCriticalQuestions(argument);
  }, [argument]);
}

/**
 * Check if an argument has composed CQs
 */
export function hasComposedCQs(argument: ArgumentWithSchemes): boolean {
  return argument.argumentSchemes.some(instance => {
    const scheme = instance.scheme;
    return scheme && (scheme as any).criticalQuestions?.length > 0;
  });
}

/**
 * Get total CQ count without full composition (lightweight)
 */
export function getTotalCQCount(argument: ArgumentWithSchemes): number {
  return argument.argumentSchemes.reduce((total, instance) => {
    const scheme = instance.scheme;
    const cqs = (scheme as any)?.criticalQuestions || [];
    return total + cqs.length;
  }, 0);
}
