/**
 * orchestrator/config.ts
 *
 * Loads runtime configuration: agent identities, deliberation pin, model
 * tier, base URLs. All paths are resolved relative to the experiment root
 * (`experiments/polarization-1/`).
 *
 * Design constraint: NEVER read process.env directly outside this module.
 * Tests set EXPERIMENT_ROOT to a fixture dir and rely on this module's
 * single source of truth.
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

export type ModelTier = "dev" | "prod";

export interface AgentIdentity {
  role: string; // "claim-analyst" | "advocate-a" | ...
  userId: string;
  authId: string;
  displayName: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AgentsRuntime {
  labelPrefix: string;
  provisionedAt: string;
  agents: AgentIdentity[];
}

export interface DeliberationRuntime {
  deliberationId: string;
  /** Set by the experimenter when the deliberation is for real data collection.
   *  When true, the orchestrator refuses to advance any phase under model-tier=dev. */
  experimentMode: boolean;
  /** Optional: bound evidence stack id (mirrors DeliberationEvidenceContext). */
  evidenceStackId?: string | null;
  createdAt?: string;
  notes?: string;
}

export interface OrchestratorConfig {
  experimentRoot: string;
  runtimeDir: string;
  isonomiaBaseUrl: string;
  anthropicApiKey: string;
  anthropicModelDev: string;
  anthropicModelProd: string;
  modelTier: ModelTier;
  /** Per-agent overrides. When set, beats `modelTier` for that role.
   *  Populated from env vars `MODEL_TIER_<ROLE>` (see `loadConfig`). */
  modelTierByRole: Partial<Record<AgentTierRole, ModelTier>>;
  agents: AgentsRuntime;
  deliberation: DeliberationRuntime;
  /** Iter-3 gating flag. When true, Phase 3 runs two rounds (round-2 =
   *  attacks-on-attacks + new direct attacks) and Phase 4 runs two
   *  sub-rounds (4a / 4b). Default false preserves Iter-2 behavior.
   *  Override via env `ITER3_MULTI_ROUND=1`. */
  iter3MultiRound: boolean;
}

/** Roles whose model tier can be overridden independently. */
export type AgentTierRole =
  | "claim-analyst"
  | "advocate"
  | "rebuttal"
  | "methodologist"
  | "defense"
  | "tracker"
  | "synthesist"
  | "chain-architect"
  | "challenger";

const DEFAULT_DEV_MODEL = "claude-haiku-4-5-20251001";
// Bumped from Opus 4.5 → Opus 4.6 for the loosened, web-search-enabled
// deliberation (May 2026). Override via ANTHROPIC_MODEL_PROD if a more
// recent point release is available at run time.
const DEFAULT_PROD_MODEL = "claude-opus-4-6";

export function readJson<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export interface LoadConfigOptions {
  modelTier?: ModelTier;
  experimentRoot?: string;
}

export function loadConfig(opts: LoadConfigOptions = {}): OrchestratorConfig {
  const experimentRoot = path.resolve(
    opts.experimentRoot ??
      process.env.EXPERIMENT_ROOT ??
      path.resolve(__dirname, ".."),
  );
  const runtimeDir = path.join(experimentRoot, "runtime");

  const agentsPath = path.join(runtimeDir, "agents.json");
  if (!existsSync(agentsPath)) {
    throw new Error(
      `runtime/agents.json not found at ${agentsPath}. Run \`npm run provision:agents\` first.`,
    );
  }
  const agents = readJson<AgentsRuntime>(agentsPath);

  const deliberationPath = path.join(runtimeDir, "deliberation.json");
  let deliberation: DeliberationRuntime;
  if (existsSync(deliberationPath)) {
    deliberation = readJson<DeliberationRuntime>(deliberationPath);
  } else {
    // Allow CLI utilities like `state` to short-circuit before a deliberation
    // exists. Phase commands themselves call `requireDeliberation()` below.
    deliberation = { deliberationId: "", experimentMode: false };
  }

  const modelTier: ModelTier =
    opts.modelTier ?? ((process.env.MODEL_TIER as ModelTier) || "dev");

  const isonomiaBaseUrl = (
    process.env.ISONOMIA_BASE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || "";

  return {
    experimentRoot,
    runtimeDir,
    isonomiaBaseUrl,
    anthropicApiKey,
    anthropicModelDev: process.env.ANTHROPIC_MODEL_DEV || DEFAULT_DEV_MODEL,
    anthropicModelProd: process.env.ANTHROPIC_MODEL_PROD || DEFAULT_PROD_MODEL,
    modelTier,
    modelTierByRole: parseRoleTierOverrides(),
    agents,
    deliberation,
    iter3MultiRound:
      process.env.ITER3_MULTI_ROUND === "1" ||
      process.env.ITER3_MULTI_ROUND === "true",
  };
}

/** Parse per-agent tier overrides from env. Recognized vars:
 *  - `MODEL_TIER_CLAIM_ANALYST`
 *  - `MODEL_TIER_ADVOCATE`     (both A and B)
 *  - `MODEL_TIER_REBUTTAL`     (both A and B)
 *  - `MODEL_TIER_METHODOLOGIST`
 *  - `MODEL_TIER_DEFENSE`      (both A and B)
 *  - `MODEL_TIER_TRACKER`
 *  - `MODEL_TIER_SYNTHESIST`
 *
 *  Convenience presets:
 *  - `MODEL_TIER_PRESET=opus-critical`      → Synthesist + Methodologist + Tracker on `prod`.
 *  - `MODEL_TIER_PRESET=opus-critical-plus` → opus-critical, plus Advocate +
 *      Rebuttal + Defense on `prod`. Bakes in iter-3 E2E learning that Haiku
 *      4.5 hallucinates CQ keys (e.g. `relevant_sims`, `alternative_explanation`)
 *      and truncates 10-char source-id citation tokens; the dialectical actors
 *      need prod-tier reasoning for publication-grade runs.
 */
function parseRoleTierOverrides(): Partial<Record<AgentTierRole, ModelTier>> {
  const out: Partial<Record<AgentTierRole, ModelTier>> = {};
  function pick(env: string, role: AgentTierRole): void {
    const v = process.env[env];
    if (v === "prod" || v === "dev") out[role] = v;
  }
  // Apply preset first; explicit env vars below can still override.
  const preset = process.env.MODEL_TIER_PRESET;
  if (preset === "opus-critical" || preset === "opus-critical-plus") {
    out.synthesist = "prod";
    out.methodologist = "prod";
    out.tracker = "prod";
    // Phase 6 chain-architect is a synthesis-class judgment task; matches
    // synthesist tier under either preset.
    out["chain-architect"] = "prod";
    // Phase 7 challenger is a structural pattern-match (CQ catalog ×
    // load-bearing argument set) but the prompt benefits from prod-tier
    // judgment when picking which CQs are most-applicable per target.
    out.challenger = "prod";
  }
  if (preset === "opus-critical-plus") {
    out.advocate = "prod";
    out.rebuttal = "prod";
    out.defense = "prod";
  }
  pick("MODEL_TIER_CLAIM_ANALYST", "claim-analyst");
  pick("MODEL_TIER_ADVOCATE", "advocate");
  pick("MODEL_TIER_REBUTTAL", "rebuttal");
  pick("MODEL_TIER_METHODOLOGIST", "methodologist");
  pick("MODEL_TIER_DEFENSE", "defense");
  pick("MODEL_TIER_TRACKER", "tracker");
  pick("MODEL_TIER_SYNTHESIST", "synthesist");
  pick("MODEL_TIER_CHAIN_ARCHITECT", "chain-architect");
  pick("MODEL_TIER_CHALLENGER", "challenger");
  return out;
}

export function requireDeliberation(cfg: OrchestratorConfig): DeliberationRuntime & { deliberationId: string } {
  if (!cfg.deliberation.deliberationId) {
    throw new Error(
      `runtime/deliberation.json missing or has empty deliberationId. ` +
        `Create the deliberation and write its id to ${path.join(cfg.runtimeDir, "deliberation.json")} before running phases.`,
    );
  }
  return cfg.deliberation as DeliberationRuntime & { deliberationId: string };
}

export function modelFor(cfg: OrchestratorConfig, role?: AgentTierRole): string {
  const tier =
    (role && cfg.modelTierByRole[role]) || cfg.modelTier;
  return tier === "prod" ? cfg.anthropicModelProd : cfg.anthropicModelDev;
}

export function agentByRole(cfg: OrchestratorConfig, role: string): AgentIdentity {
  const a = cfg.agents.agents.find((x) => x.role === role);
  if (!a) {
    throw new Error(
      `Agent role "${role}" not found in runtime/agents.json. ` +
        `Available: ${cfg.agents.agents.map((x) => x.role).join(", ")}`,
    );
  }
  return a;
}
