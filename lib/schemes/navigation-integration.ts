/**
 * Navigation Integration Utilities
 * 
 * Helper functions for cross-mode navigation, breadcrumb generation,
 * and scheme relationship discovery.
 * 
 * Week 8, Task 8.1: Integration Architecture
 */

import type { ArgumentScheme } from "@prisma/client";
import type { NavigationMode } from "./navigation-state";
import { semanticClusters, getClusterForScheme } from "./semantic-clusters";
import { identificationConditions } from "./identification-conditions";

/**
 * Get the appropriate navigation mode for a scheme based on its characteristics
 */
export function getSuggestedNavigationMode(scheme: ArgumentScheme): NavigationMode {
  // If scheme has a clear semantic cluster, suggest cluster mode
  if ((scheme as any).semanticCluster) {
    return "cluster";
  }
  
  // If scheme has purpose and source, suggest tree mode
  if (scheme.purpose && scheme.source) {
    return "tree";
  }
  
  // Otherwise suggest conditions mode
  return "conditions";
}

/**
 * Get related schemes across all navigation modes
 */
export function getRelatedSchemes(
  scheme: ArgumentScheme,
  allSchemes: ArgumentScheme[]
): {
  byCluster: ArgumentScheme[];
  byPurposeSource: ArgumentScheme[];
  bySimilarConditions: ArgumentScheme[];
} {
  const cluster = getClusterForScheme(scheme.key);
  
  // Related by cluster
  const byCluster = cluster
    ? allSchemes.filter(
        (s) =>
          s.key !== scheme.key &&
          cluster.schemeKeys.includes(s.key)
      )
    : [];
  
  // Related by purpose and source
  const byPurposeSource = allSchemes.filter(
    (s) =>
      s.key !== scheme.key &&
      (s.purpose === scheme.purpose || s.source === scheme.source)
  );
  
  // Related by similar identification conditions (placeholder - would need condition data)
  const bySimilarConditions: ArgumentScheme[] = [];
  
  return {
    byCluster: byCluster.slice(0, 6),
    byPurposeSource: byPurposeSource.slice(0, 6),
    bySimilarConditions: bySimilarConditions.slice(0, 6),
  };
}

/**
 * Generate breadcrumb trail for current navigation state
 */
export function generateBreadcrumbs(
  mode: NavigationMode,
  modeState: {
    cluster?: string | null;
    purpose?: string | null;
    source?: string | null;
    selectedConditions?: string[];
  }
): Array<{ label: string; path: string }> {
  const breadcrumbs: Array<{ label: string; path: string }> = [
    { label: "Schemes", path: "/" },
  ];
  
  switch (mode) {
    case "tree":
      breadcrumbs.push({ label: "Dichotomic Tree", path: "/tree" });
      if (modeState.purpose) {
        breadcrumbs.push({
          label: modeState.purpose === "action" ? "Action" : "State of Affairs",
          path: `/tree/${modeState.purpose}`,
        });
      }
      if (modeState.source) {
        breadcrumbs.push({
          label: modeState.source === "internal" ? "Internal" : "External",
          path: `/tree/${modeState.purpose}/${modeState.source}`,
        });
      }
      break;
      
    case "cluster":
      breadcrumbs.push({ label: "Clusters", path: "/clusters" });
      if (modeState.cluster) {
        const cluster = semanticClusters[modeState.cluster];
        if (cluster) {
          breadcrumbs.push({
            label: cluster.name,
            path: `/clusters/${modeState.cluster}`,
          });
        }
      }
      break;
      
    case "conditions":
      breadcrumbs.push({ label: "Identification Conditions", path: "/conditions" });
      if (modeState.selectedConditions && modeState.selectedConditions.length > 0) {
        breadcrumbs.push({
          label: `${modeState.selectedConditions.length} conditions selected`,
          path: "/conditions",
        });
      }
      break;
      
    case "search":
      breadcrumbs.push({ label: "Search", path: "/search" });
      break;
  }
  
  return breadcrumbs;
}

/**
 * Format scheme count message for current mode
 */
export function formatSchemeCountMessage(
  mode: NavigationMode,
  count: number,
  totalCount: number
): string {
  const percentage = Math.round((count / totalCount) * 100);
  
  switch (mode) {
    case "tree":
      return `Found ${count} schemes (${percentage}% of all schemes) matching your selections`;
    case "cluster":
      return `${count} schemes in this cluster (${percentage}% of all schemes)`;
    case "conditions":
      return `${count} schemes match your conditions (${percentage}% of all schemes)`;
    case "search":
      return `${count} search results (${percentage}% of all schemes)`;
    default:
      return `${count} schemes available`;
  }
}

/**
 * Get mode-specific help text
 */
export function getModeHelpText(mode: NavigationMode): string {
  switch (mode) {
    case "tree":
      return "Answer 2-3 questions to narrow down to the most relevant schemes for your argument";
    case "cluster":
      return "Browse schemes organized by semantic domain (authority, causality, decision-making, etc.)";
    case "conditions":
      return "Select observable patterns in your argument to filter schemes by identification conditions";
    case "search":
      return "Search schemes by name, description, or keywords to quickly find what you need";
    default:
      return "Navigate schemes using different approaches to find the perfect match";
  }
}

/**
 * Get mode icon name (for UI display)
 */
export function getModeIcon(mode: NavigationMode): string {
  switch (mode) {
    case "tree":
      return "GitBranch";
    case "cluster":
      return "Grid3x3";
    case "conditions":
      return "Filter";
    case "search":
      return "Search";
    default:
      return "Compass";
  }
}

/**
 * Get mode label
 */
export function getModeLabel(mode: NavigationMode): string {
  switch (mode) {
    case "tree":
      return "Wizard";
    case "cluster":
      return "Clusters";
    case "conditions":
      return "Conditions";
    case "search":
      return "Search";
    default:
      return "Navigate";
  }
}
