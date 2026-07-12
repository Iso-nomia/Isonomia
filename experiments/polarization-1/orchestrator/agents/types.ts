/**
 * orchestrator/agents/types.ts
 *
 * Shared agent types: roles, common turn input/output shape, discriminated
 * unions per role. Kept thin; per-role inputs/outputs live alongside their
 * implementations to keep the contract local to the agent.
 */

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { AnthropicClient } from "../anthropic-client";
import type { RoundLogger } from "../log/round-logger";

export const AGENT_ROLES = [
  "claim-analyst",
  "advocate-a",
  "advocate-b",
  "challenger",
  "concession-tracker",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

/** Context every agent turn receives. Specific input (the "task") is added per-role. */
export interface AgentTurnContext {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  llm: AnthropicClient;
  logger: RoundLogger;
  phase: number;
  round: number;
  deliberationId: string;
}

/** Common shape for an agent's structured output. Each role refines this. */
export interface AgentTurnOutputBase {
  agent: AgentRole;
  /** Free-form rationale the agent produced before the structured payload. */
  rationale?: string;
  /** Whether the agent refused to act (per its refusal cases). */
  refused?: boolean;
  refusalReason?: string;
}

/** Soft-validation issues to surface to the human reviewer (not aborting). */
export interface ReviewFlag {
  ruleId: string; // e.g. "claim-analyst:no-restating-established"
  severity: "info" | "warn";
  message: string;
  evidence?: unknown;
}
