/**
 * orchestrator/index.ts
 *
 * CLI entrypoint for the polarization-1 multi-agent deliberation
 * orchestrator. Per Stage-1 §4.5 + §4.6.
 *
 * Usage:
 *   npm run orchestrator -- preflight
 *   npm run orchestrator -- state
 *   npm run orchestrator -- phase 1 [--max-rounds N]
 *   npm run orchestrator -- phase 2
 *   npm run orchestrator -- dry-run phase N --round R
 *   npm run orchestrator -- export-final-state
 *
 * Global flags:
 *   --model-tier=dev|prod   (default: dev; required to be 'prod' when
 *                            runtime/deliberation.json has experimentMode=true)
 *   --experiment-root PATH  (default: ../ relative to this file)
 *
 * Phase implementations live in `phases/phase-N-*.ts` and are not all
 * present yet — Phase 1 lands in step 6 of the implementation plan.
 */

import path from "path";

import { existsSync, readFileSync } from "fs";

import { loadConfig, requireDeliberation, modelFor, type ModelTier } from "./config";
import { IsonomiaClient } from "./isonomia-client";
import { AnthropicClient } from "./anthropic-client";
import { RoundLogger } from "./log/round-logger";
import { fetchState } from "./state/refresh";
import { ClaimAnalystRefusedError, type Phase1PartialFile } from "./phases/phase-1-topology";
import { produceReport, reportPathFor } from "./review/report";
import { applyReport } from "./review/apply";
import { produceReportPhase2 } from "./review/phase-2-report";
import { produceReportPhase3 } from "./review/phase-3-report";
import { produceReportPhase4 } from "./review/phase-4-report";
import { finalizePhase1 } from "./finalize/phase-1-finalize";
import { finalizePhase2 } from "./finalize/phase-2-finalize";
import { finalizePhase3 } from "./finalize/phase-3-finalize";
import { finalizePhase4 } from "./finalize/phase-4-finalize";
import { finalizePhase5 } from "./finalize/phase-5-finalize";
import { finalizePhase6 } from "./finalize/phase-6-finalize";
import { finalizePhase7 } from "./finalize/phase-7-finalize";
import { setupDeliberation } from "./setup/setup-deliberation";
import {
  EXPERIMENT_SCHEME_KEYS,
  missingExperimentSchemes,
} from "./scheme-catalog";

// ────────────────────────────────────────────────────────────────────────────
// Tiny CLI parser
// ────────────────────────────────────────────────────────────────────────────

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

// ────────────────────────────────────────────────────────────────────────────
// Pre-flight validation (Stage-1 §4.6)
// ────────────────────────────────────────────────────────────────────────────

interface PreflightResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}

async function runPreflight(opts: {
  modelTier: ModelTier;
  experimentRoot?: string;
  requireDeliberation?: boolean;
  minEvidenceSources?: number;
  /**
   * When true, every key in EXPERIMENT_SCHEME_KEYS must exist on the
   * platform or preflight fails. Otherwise the catalog check is a
   * soft warning. Set true for phase >= 2.
   */
  requireSchemeCatalog?: boolean;
}): Promise<PreflightResult> {
  const checks: PreflightResult["checks"] = [];
  const cfg = loadConfig({ modelTier: opts.modelTier, experimentRoot: opts.experimentRoot });

  // 1. Anthropic key present.
  checks.push({
    name: "ANTHROPIC_API_KEY present",
    ok: !!cfg.anthropicApiKey,
    detail: cfg.anthropicApiKey ? undefined : "Set ANTHROPIC_API_KEY in .env",
  });

  // 2. agents.json — already loaded by loadConfig, but verify each token works.
  const iso = new IsonomiaClient(cfg);
  for (const a of cfg.agents.agents) {
    try {
      const me = await iso.getMe(a.role);
      checks.push({
        name: `Agent ${a.role} authenticates against ${cfg.isonomiaBaseUrl}/api/me`,
        ok: !!me?.uid,
        detail: me?.uid ? `uid=${me.uid}` : undefined,
      });
    } catch (err) {
      checks.push({
        name: `Agent ${a.role} authenticates against ${cfg.isonomiaBaseUrl}/api/me`,
        ok: false,
        detail: (err as Error)?.message?.slice(0, 200),
      });
    }
  }

  // 3. Schemes catalog reachable AND every key required by the experiment
  //    is present. Phase 1 doesn't use schemes, so missing keys are a soft
  //    warning there; for phase >= 2 the missing-keys check is a hard fail
  //    (advocates would emit `schemeKey`s the orchestrator can't resolve).
  //
  //    Required keys live in `./scheme-catalog.ts`; missing ones are seeded
  //    by `experiments/polarization-1/scripts/seed-experiment-schemes.ts`.
  const requireSchemes = opts.requireSchemeCatalog === true;
  try {
    const schemes = await iso.getSchemes(cfg.agents.agents[0].role);
    const arr = (Array.isArray(schemes)
      ? schemes
      : (schemes as any)?.items ?? (schemes as any)?.schemes ?? []) as Array<{
      key: string;
    }>;
    const count = arr.length;
    const missing = missingExperimentSchemes(arr);
    const ok = requireSchemes ? count > 0 && missing.length === 0 : true;
    let detail: string;
    if (missing.length === 0) {
      detail = `catalog=${count}, all ${EXPERIMENT_SCHEME_KEYS.length} required keys present`;
    } else {
      const tag = requireSchemes ? "missing" : "warn — missing";
      detail = `catalog=${count}, ${tag} ${missing.length}/${EXPERIMENT_SCHEME_KEYS.length}: ${missing.join(", ")}` +
        (requireSchemes
          ? ` — run \`npx tsx --env-file=.env experiments/polarization-1/scripts/seed-experiment-schemes.ts\``
          : "");
    }
    checks.push({
      name: "GET /api/schemes returns the experiment-allowed catalog",
      ok,
      detail,
    });
  } catch (err) {
    checks.push({
      name: "GET /api/schemes returns the experiment-allowed catalog",
      ok: false,
      detail: (err as Error)?.message?.slice(0, 200),
    });
  }

  // 4. deliberation.json — only required for phase commands.
  if (opts.requireDeliberation) {
    if (!cfg.deliberation.deliberationId) {
      checks.push({
        name: "runtime/deliberation.json present with deliberationId",
        ok: false,
        detail: "Create the deliberation and write its id to runtime/deliberation.json",
      });
    } else {
      checks.push({
        name: "runtime/deliberation.json present with deliberationId",
        ok: true,
        detail: cfg.deliberation.deliberationId,
      });
      // Tier guard: prod required when experimentMode.
      if (cfg.deliberation.experimentMode && cfg.modelTier !== "prod") {
        checks.push({
          name: "Model tier matches deliberation.experimentMode",
          ok: false,
          detail: "deliberation.experimentMode=true but modelTier=dev — refuse to advance.",
        });
      }
      // Evidence corpus floor.
      const min = opts.minEvidenceSources ?? 15;
      try {
        const ec = await iso.getEvidenceContext(cfg.deliberation.deliberationId, {
          role: cfg.agents.agents[0].role,
        });
        checks.push({
          name: `Evidence context bound with ≥ ${min} sources`,
          ok: (ec.stack?.sourceCount ?? 0) >= min,
          detail: `stack=${ec.stack?.id} sourceCount=${ec.stack?.sourceCount}`,
        });
      } catch (err) {
        checks.push({
          name: `Evidence context bound with ≥ ${min} sources`,
          ok: false,
          detail: (err as Error)?.message?.slice(0, 200),
        });
      }
    }
  }

  return { ok: checks.every((c) => c.ok), checks };
}

function printPreflight(r: PreflightResult): void {
  for (const c of r.checks) {
    const mark = c.ok ? "✓" : "✗";
    process.stdout.write(`  ${mark} ${c.name}`);
    if (c.detail) process.stdout.write(`  — ${c.detail}`);
    process.stdout.write("\n");
  }
  process.stdout.write(r.ok ? "\nPreflight: OK\n" : "\nPreflight: FAILED\n");
}

// ────────────────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────────────────

async function cmdPreflight(args: ParsedArgs) {
  const tier = (args.flags["model-tier"] as ModelTier) || "dev";
  const root = args.flags["experiment-root"] as string | undefined;
  const r = await runPreflight({
    modelTier: tier,
    experimentRoot: root,
    requireDeliberation: true,
  });
  printPreflight(r);
  if (!r.ok) process.exit(1);
}

async function cmdState(args: ParsedArgs) {
  const tier = (args.flags["model-tier"] as ModelTier) || "dev";
  const root = args.flags["experiment-root"] as string | undefined;
  const cfg = loadConfig({ modelTier: tier, experimentRoot: root });
  const delib = requireDeliberation(cfg);
  const iso = new IsonomiaClient(cfg);
  const role = cfg.agents.agents[0].role;
  const state = await fetchState(iso, delib.deliberationId, { role });
  process.stdout.write(JSON.stringify(state, null, 2) + "\n");
}

async function cmdPhase(phaseNum: number, args: ParsedArgs) {
  const tier = (args.flags["model-tier"] as ModelTier) || "dev";
  const root = args.flags["experiment-root"] as string | undefined;

  // Validate `--round` early (before preflight network calls) so users get
  // fast feedback on bad CLI invocations.
  const roundFilter = parseRoundFilter(phaseNum, args.flags["round"]);

  const pre = await runPreflight({
    modelTier: tier,
    experimentRoot: root,
    requireDeliberation: true,
    minEvidenceSources: phaseNum >= 2 ? 15 : 0,
    requireSchemeCatalog: phaseNum >= 2,
  });
  if (!pre.ok) {
    printPreflight(pre);
    process.exit(1);
  }

  // Lazy-load the phase module so missing phases produce a clear error
  // before construction of clients.
  const phaseFile = phaseNameFor(phaseNum);
  let mod: any;
  try {
    mod = await import(`./phases/${phaseFile}`);
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    process.stderr.write(
      `Phase ${phaseNum} not implemented yet (looking for ./phases/${phaseFile}).\n` +
        `  Underlying error: ${msg}\n`,
    );
    process.exit(2);
  }
  if (typeof mod.runPhase !== "function") {
    process.stderr.write(`./phases/${phaseFile} does not export runPhase()\n`);
    process.exit(2);
  }

  const cfg = loadConfig({ modelTier: tier, experimentRoot: root });
  const delib = requireDeliberation(cfg);
  const iso = new IsonomiaClient(cfg);
  const llm = new AnthropicClient(cfg.anthropicApiKey);
  const logger = RoundLogger.forRound({
    runtimeDir: cfg.runtimeDir,
    phase: phaseNum,
    round: 0,
  });
  logger.event("phase_start", {
    phase: phaseNum,
    model: modelFor(cfg),
    modelTier: cfg.modelTier,
    deliberationId: delib.deliberationId,
  });

  const result = await mod.runPhase({
    cfg,
    iso,
    llm,
    deliberationId: delib.deliberationId,
    maxRounds: args.flags["max-rounds"] ? Number(args.flags["max-rounds"]) : undefined,
    resume: args.flags["resume"] === true || args.flags["resume"] === "true",
    roundFilter,
  });

  logger.event("phase_complete", { phase: phaseNum, result });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

function phaseNameFor(n: number): string {
  switch (n) {
    case 1: return "phase-1-topology";
    case 2: return "phase-2-arguments";
    case 3: return "phase-3-attacks";
    case 4: return "phase-4-defenses";
    case 5: return "phase-5-synthesis";
    case 6: return "phase-6-chains";
    case 7: return "phase-7-cq-raise";
    default: throw new Error(`Unknown phase ${n}`);
  }
}

/**
 * Iter-3 `--round` flag for resume granularity. Maps the raw flag value
 * to the per-phase enum the phase module accepts.
 *
 * - `--phase 3 --round 1|2`: gates Phase-3 round-1 vs round-2 hook.
 * - `--phase 4 --round a|b`: gates Phase-4 sub-round-a vs sub-round-b hook.
 *
 * Other phases reject `--round`. Returns undefined when not set.
 */
function parseRoundFilter(
  phaseNum: number,
  raw: string | true | undefined,
): "1" | "2" | "a" | "b" | undefined {
  if (raw === undefined) return undefined;
  if (raw === true) {
    throw new Error(`--round requires a value (e.g. --round 2 for phase 3, --round b for phase 4).`);
  }
  const v = String(raw).trim().toLowerCase();
  if (phaseNum === 3) {
    if (v !== "1" && v !== "2") {
      throw new Error(`--phase 3 --round expects "1" or "2"; got "${v}".`);
    }
    return v;
  }
  if (phaseNum === 4) {
    if (v !== "a" && v !== "b") {
      throw new Error(`--phase 4 --round expects "a" or "b"; got "${v}".`);
    }
    return v;
  }
  throw new Error(`--round is only meaningful for --phase 3 (1|2) or --phase 4 (a|b); got phase ${phaseNum}.`);
}

// ────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args.positional[0];

  if (!cmd) {
    process.stderr.write(usage());
    process.exit(2);
  }

  try {
    switch (cmd) {
      case "preflight":
        return await cmdPreflight(args);
      case "state":
        return await cmdState(args);
      case "phase": {
        const n = Number(args.positional[1]);
        if (!Number.isInteger(n) || n < 1) {
          process.stderr.write("Usage: orchestrator phase <N>\n");
          process.exit(2);
        }
        return await cmdPhase(n, args);
      }
      case "review":
        return await cmdReview(args);
      case "finalize":
        return await cmdFinalize(args);
      case "setup":
        return await cmdSetup(args);
      default:
        process.stderr.write(`Unknown command: ${cmd}\n\n${usage()}`);
        process.exit(2);
    }
  } catch (err) {
    if (err instanceof ClaimAnalystRefusedError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(err.exitCode);
    }
    process.stderr.write(`Error: ${(err as Error)?.message ?? String(err)}\n`);
    process.exit(1);
  }
}

async function cmdReview(args: ParsedArgs) {
  const tier = (args.flags["model-tier"] as ModelTier) || "dev";
  const root = args.flags["experiment-root"] as string | undefined;
  const phase = Number(args.flags["phase"] ?? 1);
  if (phase !== 1 && phase !== 2 && phase !== 3 && phase !== 4) throw new Error(`review supports phase 1, 2, 3, or 4 (Phase 5 has no review-flag step — its output is fully validated by the Synthesist Zod schema); got ${phase}`);

  const cfg = loadConfig({ modelTier: tier, experimentRoot: root });
  const partialPath = `${cfg.runtimeDir}/PHASE_${phase}_PARTIAL.json`;
  if (!existsSync(partialPath)) {
    throw new Error(`PHASE_${phase}_PARTIAL.json not found at ${partialPath}. Run \`npm run orchestrator -- phase ${phase}\` first.`);
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8"));

  if (args.flags["apply"]) {
    if (phase !== 1) {
      throw new Error(`review --apply currently supports phase 1 only (the apply step retracts/edits Phase-1 claims). For Phase ${phase}, fill in verdicts in the report and finalize will gate on \`**Applied:**\` markers — add them manually after acting on each flag.`);
    }
    const iso = new IsonomiaClient(cfg);
    void iso; // reserved for v2 retract path
    const result = await applyReport({ cfg, partial: partial as Phase1PartialFile });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.notes.length) {
      process.stderr.write("\nFollow-up actions:\n");
      for (const n of result.notes) process.stderr.write(`  - ${n}\n`);
    }
    return;
  }

  // Default: produce-report (and warn if a report already exists).
  const force = args.flags["force"] === true || args.flags["force"] === "true";
  const reportPath = reportPathFor(cfg.runtimeDir, phase);
  if (existsSync(reportPath) && !force) {
    process.stdout.write(`Report already exists: ${reportPath}\nPass --force to overwrite, or --apply to apply your verdicts.\n`);
    return;
  }
  const out = phase === 1
    ? produceReport({ partial: partial as Phase1PartialFile, runtimeDir: cfg.runtimeDir, force })
    : phase === 2
      ? produceReportPhase2({ partial: partial as import("./phases/phase-2-arguments").Phase2PartialFile, runtimeDir: cfg.runtimeDir, force })
      : phase === 3
        ? produceReportPhase3({ partial: partial as import("./phases/phase-3-attacks").Phase3PartialFile, runtimeDir: cfg.runtimeDir, force })
        : produceReportPhase4({ partial: partial as import("./phases/phase-4-defenses").Phase4PartialFile, runtimeDir: cfg.runtimeDir, force });
  process.stdout.write(`Wrote ${out.path}\nFill in verdicts, then run: npm run orchestrator -- review --phase ${phase} --apply\n`);
}

async function cmdFinalize(args: ParsedArgs) {
  const tier = (args.flags["model-tier"] as ModelTier) || "dev";
  const root = args.flags["experiment-root"] as string | undefined;
  const phase = Number(args.flags["phase"] ?? 1);
  if (phase !== 1 && phase !== 2 && phase !== 3 && phase !== 4 && phase !== 5 && phase !== 6 && phase !== 7) throw new Error(`finalize supports phase 1, 2, 3, 4, 5, 6, or 7; got ${phase}`);

  const cfg = loadConfig({ modelTier: tier, experimentRoot: root });
  const iso = new IsonomiaClient(cfg);
  const complete = phase === 1
    ? await finalizePhase1({ cfg, iso })
    : phase === 2
      ? await finalizePhase2({ cfg, iso })
      : phase === 3
        ? await finalizePhase3({ cfg, iso })
        : phase === 4
          ? await finalizePhase4({ cfg, iso })
          : phase === 5
            ? await finalizePhase5({ cfg, iso })
            : phase === 6
              ? await finalizePhase6({ cfg, iso })
              : await finalizePhase7({ cfg, iso });
  process.stdout.write(JSON.stringify(complete, null, 2) + "\n");
}

async function cmdSetup(args: ParsedArgs) {
  const tier = (args.flags["model-tier"] as ModelTier) || "dev";
  const root = args.flags["experiment-root"] as string | undefined;
  const cfg = loadConfig({ modelTier: tier, experimentRoot: root });
  const iso = new IsonomiaClient(cfg);
  const result = await setupDeliberation({
    cfg,
    iso,
    force: args.flags["force"] === true || args.flags["force"] === "true",
    reuseStackId: typeof args.flags["stack-id"] === "string" ? (args.flags["stack-id"] as string) : undefined,
    role: typeof args.flags["role"] === "string" ? (args.flags["role"] as string) : undefined,
    stackName: typeof args.flags["stack-name"] === "string" ? (args.flags["stack-name"] as string) : undefined,
    experimentMode: args.flags["experiment-mode"] === true || args.flags["experiment-mode"] === "true",
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.stderr.write(
    `\nWrote ${result.runtimeDeliberationPath}\n` +
      `  deliberationId=${result.deliberationId} (${result.deliberationCreated ? "created" : "reused"})\n` +
      `  stackId=${result.stackId}${result.stackSlug ? ` (slug=${result.stackSlug})` : ""}\n` +
      `  evidence items: added=${result.itemsAdded} skipped=${result.itemsSkipped}` +
      (result.evidenceCorpusPath ? ` from ${result.evidenceCorpusPath}` : " (no evidence-corpus.json found)") +
      `\n` +
      (result.itemErrors.length
        ? `  errors:\n${result.itemErrors.map((e) => `    - item[${e.index}]: ${e.error}`).join("\n")}\n`
        : "") +
      `\nNext: \`npm run orchestrator -- preflight\`\n`,
  );
}

function usage(): string {
  return [
    "Usage: orchestrator <command> [args]",
    "",
    "Commands:",
    "  preflight                      Validate runtime config + auth + evidence corpus",
    "  state                          Print composed deliberation state JSON (no LLM calls)",
    "  setup [--force] [--stack-id ID] [--stack-name S] [--experiment-mode] [--role R]",
    "                                 Create stack + deliberation + bind evidence; writes runtime/deliberation.json",
    "  phase <N> [--max-rounds N] [--resume] [--round R]  Run phase N",
    "                                                      --round 1|2 (phase 3) or a|b (phase 4)",
    "                                                      gates Iter-3 multi-round halves for resume.",
    "  review --phase N [--apply] [--force]    Produce or apply phase-N review report",
    "  finalize --phase N             Validate platform state and write PHASE_N_COMPLETE.json",
    "",
    "Global flags:",
    "  --model-tier=dev|prod          Default: dev (refuses to run experimentMode=true)",
    "  --experiment-root PATH         Override experiment root (defaults to ../)",
    "",
    `Resolved root: ${path.resolve(__dirname, "..")}`,
    "",
  ].join("\n");
}

main();
