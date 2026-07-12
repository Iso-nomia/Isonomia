/**
 * Changelog Generation Service
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * Generates changelogs by diffing snapshots between releases.
 */

import {
  Changelog,
  ClaimSnapshot,
  ArgumentSnapshot,
  ClaimStatus,
  ChangelogClaim,
  ChangelogStatusChange,
  ChangelogModification,
  ChangelogArgument,
  ChangelogAcceptabilityChange,
  ChangelogSummary,
} from "./types";

// ─────────────────────────────────────────────────────────
// Changelog Generation
// ─────────────────────────────────────────────────────────

/**
 * Generate a changelog between two snapshots
 */
export function generateChangelog(
  fromVersion: string,
  toVersion: string,
  fromClaims: ClaimSnapshot,
  toClaims: ClaimSnapshot,
  fromArguments: ArgumentSnapshot,
  toArguments: ArgumentSnapshot
): Changelog {
  // Build lookup maps
  const fromClaimMap = new Map(fromClaims.claims.map((c) => [c.id, c]));
  const toClaimMap = new Map(toClaims.claims.map((c) => [c.id, c]));
  const fromArgMap = new Map(fromArguments.arguments.map((a) => [a.id, a]));
  const toArgMap = new Map(toArguments.arguments.map((a) => [a.id, a]));

  // ─── Claim Changes ───
  const claimsAdded: ChangelogClaim[] = [];
  const claimsRemoved: ChangelogClaim[] = [];
  const statusChanges: ChangelogStatusChange[] = [];
  const modifications: ChangelogModification[] = [];

  // Find added claims
  for (const claim of toClaims.claims) {
    if (!fromClaimMap.has(claim.id)) {
      claimsAdded.push({
        id: claim.id,
        text: claim.text,
        type: claim.claimType,
        status: claim.status,
      });
    }
  }

  // Find removed claims
  for (const claim of fromClaims.claims) {
    if (!toClaimMap.has(claim.id)) {
      claimsRemoved.push({
        id: claim.id,
        text: claim.text,
        type: claim.claimType,
        status: claim.status,
      });
    }
  }

  // Find status changes and modifications
  for (const toClaim of toClaims.claims) {
    const fromClaim = fromClaimMap.get(toClaim.id);
    if (fromClaim) {
      // Check status change
      if (fromClaim.status !== toClaim.status) {
        statusChanges.push({
          claimId: toClaim.id,
          claimText: toClaim.text,
          fromStatus: fromClaim.status,
          toStatus: toClaim.status,
        });
      }

      // Check text modification
      if (fromClaim.text !== toClaim.text) {
        modifications.push({
          claimId: toClaim.id,
          claimText: toClaim.text,
          field: "text",
          oldValue: fromClaim.text,
          newValue: toClaim.text,
        });
      }
    }
  }

  // ─── Argument Changes ───
  const argumentsAdded: ChangelogArgument[] = [];
  const argumentsRemoved: ChangelogArgument[] = [];
  const acceptabilityChanges: ChangelogAcceptabilityChange[] = [];

  // Find added arguments
  for (const arg of toArguments.arguments) {
    if (!fromArgMap.has(arg.id)) {
      argumentsAdded.push({
        id: arg.id,
        type: arg.type,
        conclusionText: arg.conclusionText || "(no conclusion)",
      });
    }
  }

  // Find removed arguments
  for (const arg of fromArguments.arguments) {
    if (!toArgMap.has(arg.id)) {
      argumentsRemoved.push({
        id: arg.id,
        type: arg.type,
        conclusionText: arg.conclusionText || "(no conclusion)",
      });
    }
  }

  // Find acceptability changes
  for (const toArg of toArguments.arguments) {
    const fromArg = fromArgMap.get(toArg.id);
    if (fromArg && fromArg.acceptable !== toArg.acceptable) {
      acceptabilityChanges.push({
        argumentId: toArg.id,
        conclusionText: toArg.conclusionText || "(no conclusion)",
        fromAcceptable: fromArg.acceptable,
        toAcceptable: toArg.acceptable,
      });
    }
  }

  // ─── Summary ───
  const summary: ChangelogSummary = {
    claimsAdded: claimsAdded.length,
    claimsRemoved: claimsRemoved.length,
    statusChanges: statusChanges.length,
    argumentsAdded: argumentsAdded.length,
    argumentsRemoved: argumentsRemoved.length,
    netDefended: toClaims.stats.defended - fromClaims.stats.defended,
  };

  return {
    fromVersion,
    toVersion,
    generatedAt: new Date().toISOString(),
    claims: {
      added: claimsAdded,
      removed: claimsRemoved,
      statusChanged: statusChanges,
      modified: modifications,
    },
    arguments: {
      added: argumentsAdded,
      removed: argumentsRemoved,
      acceptabilityChanged: acceptabilityChanges,
    },
    summary,
  };
}

// ─────────────────────────────────────────────────────────
// Changelog Text Formatting
// ─────────────────────────────────────────────────────────

/**
 * Generate human-readable changelog text (Markdown format)
 */
export function formatChangelogText(changelog: Changelog): string {
  const lines: string[] = [];

  lines.push(`# Changelog: ${changelog.fromVersion} → ${changelog.toVersion}`);
  lines.push("");
  lines.push(`*Generated: ${new Date(changelog.generatedAt).toLocaleString()}*`);
  lines.push("");

  // Summary section
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Claims Added | ${changelog.summary.claimsAdded} |`);
  lines.push(`| Claims Removed | ${changelog.summary.claimsRemoved} |`);
  lines.push(`| Status Changes | ${changelog.summary.statusChanges} |`);
  lines.push(`| Arguments Added | ${changelog.summary.argumentsAdded} |`);
  lines.push(`| Arguments Removed | ${changelog.summary.argumentsRemoved} |`);
  
  const netSign = changelog.summary.netDefended >= 0 ? "+" : "";
  lines.push(`| Net Defended | ${netSign}${changelog.summary.netDefended} |`);
  lines.push("");

  // New Claims section
  if (changelog.claims.added.length > 0) {
    lines.push("## New Claims");
    lines.push("");
    for (const claim of changelog.claims.added) {
      const statusBadge = getStatusBadge(claim.status);
      lines.push(`- ${statusBadge} "${truncate(claim.text, 100)}"`);
    }
    lines.push("");
  }

  // Removed Claims section
  if (changelog.claims.removed.length > 0) {
    lines.push("## Removed Claims");
    lines.push("");
    for (const claim of changelog.claims.removed) {
      lines.push(`- ~~"${truncate(claim.text, 100)}"~~`);
    }
    lines.push("");
  }

  // Status Changes section
  if (changelog.claims.statusChanged.length > 0) {
    lines.push("## Status Changes");
    lines.push("");
    for (const change of changelog.claims.statusChanged) {
      const arrow = getStatusArrow(change.fromStatus, change.toStatus);
      const fromBadge = getStatusBadge(change.fromStatus);
      const toBadge = getStatusBadge(change.toStatus);
      lines.push(
        `- ${arrow} "${truncate(change.claimText, 80)}": ${fromBadge} → ${toBadge}`
      );
    }
    lines.push("");
  }

  // New Arguments section
  if (changelog.arguments.added.length > 0) {
    lines.push("## New Arguments");
    lines.push("");
    for (const arg of changelog.arguments.added) {
      lines.push(`- **[${arg.type}]** → "${truncate(arg.conclusionText, 80)}"`);
    }
    lines.push("");
  }

  // Removed Arguments section
  if (changelog.arguments.removed.length > 0) {
    lines.push("## Removed Arguments");
    lines.push("");
    for (const arg of changelog.arguments.removed) {
      lines.push(`- ~~**[${arg.type}]** → "${truncate(arg.conclusionText, 80)}"~~`);
    }
    lines.push("");
  }

  // Acceptability Changes section
  if (changelog.arguments.acceptabilityChanged.length > 0) {
    lines.push("## Argument Acceptability Changes");
    lines.push("");
    for (const change of changelog.arguments.acceptabilityChanged) {
      const status = change.toAcceptable ? "✅ Now Acceptable" : "❌ Now Defeated";
      lines.push(`- ${status}: → "${truncate(change.conclusionText, 80)}"`);
    }
    lines.push("");
  }

  // No changes case
  const hasChanges =
    changelog.claims.added.length > 0 ||
    changelog.claims.removed.length > 0 ||
    changelog.claims.statusChanged.length > 0 ||
    changelog.arguments.added.length > 0 ||
    changelog.arguments.removed.length > 0 ||
    changelog.arguments.acceptabilityChanged.length > 0;

  if (!hasChanges) {
    lines.push("*No significant changes between these versions.*");
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Get emoji badge for claim status
 */
function getStatusBadge(status: ClaimStatus): string {
  const badges: Record<ClaimStatus, string> = {
    DEFENDED: "🟢 Defended",
    CONTESTED: "🟡 Contested",
    UNRESOLVED: "⚪ Unresolved",
    WITHDRAWN: "🔴 Withdrawn",
    ACCEPTED: "✅ Accepted",
  };
  return badges[status] || status;
}

/**
 * Get arrow indicating improvement or regression
 */
function getStatusArrow(from: ClaimStatus, to: ClaimStatus): string {
  const order: ClaimStatus[] = ["WITHDRAWN", "CONTESTED", "UNRESOLVED", "DEFENDED", "ACCEPTED"];
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);

  if (toIndex > fromIndex) return "⬆️"; // Improvement
  if (toIndex < fromIndex) return "⬇️"; // Regression
  return "➡️"; // Same level (shouldn't happen)
}

/**
 * Check if status change is an improvement
 */
export function isStatusImprovement(from: ClaimStatus, to: ClaimStatus): boolean {
  const order: ClaimStatus[] = ["WITHDRAWN", "CONTESTED", "UNRESOLVED", "DEFENDED", "ACCEPTED"];
  return order.indexOf(to) > order.indexOf(from);
}

/**
 * Generate a concise one-line summary
 */
export function generateChangelogOneLiner(changelog: Changelog): string {
  const parts: string[] = [];

  if (changelog.summary.claimsAdded > 0) {
    parts.push(`+${changelog.summary.claimsAdded} claims`);
  }
  if (changelog.summary.claimsRemoved > 0) {
    parts.push(`-${changelog.summary.claimsRemoved} claims`);
  }
  if (changelog.summary.argumentsAdded > 0) {
    parts.push(`+${changelog.summary.argumentsAdded} arguments`);
  }
  if (changelog.summary.statusChanges > 0) {
    parts.push(`${changelog.summary.statusChanges} status changes`);
  }

  if (parts.length === 0) {
    return "No significant changes";
  }

  return parts.join(", ");
}
