/**
 * orchestrator/state/format-for-prompt.ts
 *
 * Renders a DeliberationState into prose context that goes into the next
 * agent's user-message. This file is the single most LLM-quality-sensitive
 * piece of the orchestrator (per Stage-1 §4.3), so the implementation is
 * intentionally a thin scaffold here — Phase 1 (claim-analyst) doesn't
 * consume the formatter at all (it gets a cold-start prompt), and Phase 2+
 * roles will iterate this function as we measure agent behaviour.
 *
 * For now: a deterministic JSON dump under prose section headers, plus a
 * `### Your task this turn` slot the caller fills in.
 */

import type { DeliberationState } from "./refresh";
import type { AgentRole } from "../agents/types";

export interface FormatOptions {
  state: DeliberationState;
  role: AgentRole;
  phase: number;
  round: number;
  /** Role-specific task block, prepended after the state summary. */
  task: string;
}

export function formatStateForPrompt(opts: FormatOptions): string {
  const { state, role, phase, round, task } = opts;
  const lines: string[] = [];
  lines.push(`## Deliberation state (phase ${phase}, round ${round}, you are: ${role})`);
  lines.push("");
  lines.push("### Fingerprint");
  lines.push("```json");
  lines.push(JSON.stringify(state.fingerprint, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("### Contested frontier");
  lines.push("```json");
  lines.push(JSON.stringify(state.frontier, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("### Missing moves (scheme-typical absences)");
  lines.push("```json");
  lines.push(JSON.stringify(state.missingMoves, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("### Chains");
  lines.push("```json");
  lines.push(JSON.stringify(state.chains, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("### Your task this turn");
  lines.push(task);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Phase-2-and-later: render the locked Phase-1 topology as labeled prose.
// Stable: index assignments don't change once Phase 1 closes.
// ─────────────────────────────────────────────────────────────────

export interface FormatTopologyOptions {
  rootClaimText: string;
  subClaims: Array<{
    index: number;
    text: string;
    layer: string;
    claimType: string;
    dependsOn: number[];
  }>;
}

export function formatTopologyForPrompt(opts: FormatTopologyOptions): string {
  const lines: string[] = [];
  lines.push("## Phase-1 Claim Topology");
  lines.push("");
  lines.push(`Central claim: "${opts.rootClaimText}"`);
  lines.push("");
  lines.push("Sub-claims (referenced by index throughout this deliberation):");
  lines.push("");
  const sorted = [...opts.subClaims].sort((a, b) => a.index - b.index);
  for (const sc of sorted) {
    const deps = sc.dependsOn.length ? `, depends on ${sc.dependsOn.map((d) => `#${d}`).join(", ")}` : "";
    lines.push(`[#${sc.index}] (${sc.layer} / ${sc.claimType}${deps}) ${sc.text}`);
  }
  return lines.join("\n");
}
