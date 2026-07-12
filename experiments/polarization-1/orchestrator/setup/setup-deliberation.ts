/**
 * orchestrator/setup/setup-deliberation.ts
 *
 * One-shot platform-setup helper for the polarization-1 experiment.
 *
 * Performs (under the claim-analyst bot identity):
 *   1. Create a Stack (the evidence corpus container)
 *   2. Optionally seed it with items from `evidence-corpus.json`
 *   3. Create a Deliberation hosted by that Stack
 *   4. Pin the Stack as the Deliberation's evidence context
 *   5. Write `runtime/deliberation.json` so subsequent commands
 *      (preflight, phase, review, finalize) can find it
 *
 * Idempotency:
 *   • If `runtime/deliberation.json` already has a deliberationId, refuses
 *     unless `--force` is passed.
 *   • The `ensure` deliberation endpoint is itself idempotent on
 *     (hostType, hostId), so re-running with `--force` and the same
 *     stack would re-bind rather than fork.
 *   • Stack creation is NOT idempotent (each call creates a new stack);
 *     pass `--stack-id <existing>` to skip stack creation and item-seeding.
 *
 * Auth:
 *   The first agent in `runtime/agents.json` (typically claim-analyst)
 *   acts as the deliberation creator + stack owner. The
 *   evidence-context POST allows binding by either Firebase UID or
 *   numeric User.id, both of which the bot satisfies as the creator.
 *
 * Evidence corpus file format (optional):
 *   experiments/polarization-1/evidence-corpus.json
 *   {
 *     "stackName": "Polarization 1 — evidence corpus",
 *     "stackVisibility": "private",
 *     "items": [
 *       {
 *         "itemKind": "url",
 *         "url": "https://...",
 *         "title": "...",
 *         "authors": ["..."],
 *         "publishedAt": "2020-01-01T00:00:00Z",
 *         "abstract": "...",
 *         "tags": ["..."]
 *       }
 *     ]
 *   }
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient, IsonomiaCallContext } from "../isonomia-client";

export interface SetupOptions {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  /** When true, overwrite an existing runtime/deliberation.json. */
  force?: boolean;
  /** Skip stack creation and reuse this id. Items are not added. */
  reuseStackId?: string;
  /** Override the role used to authenticate setup calls. */
  role?: string;
  /** Override default stack name. */
  stackName?: string;
  /** Set runtime/deliberation.json experimentMode. Defaults to false (dry-run). */
  experimentMode?: boolean;
}

export interface SetupResult {
  stackId: string;
  stackSlug?: string;
  itemsAdded: number;
  itemsSkipped: number;
  itemErrors: Array<{ index: number; error: string }>;
  deliberationId: string;
  deliberationCreated: boolean;
  evidenceCorpusPath: string | null;
  runtimeDeliberationPath: string;
}

interface CorpusItem {
  itemKind: "url" | "doi";
  url?: string;
  doi?: string;
  title?: string;
  authors?: string[];
  publishedAt?: string;
  abstract?: string;
  keyFindings?: string[];
  tags?: string[];
}

interface CorpusFile {
  stackName?: string;
  stackVisibility?: "public_open" | "public_closed" | "private" | "unlisted";
  items?: CorpusItem[];
}

const DEFAULT_STACK_NAME = "Polarization 1 — evidence corpus";

function readCorpus(experimentRoot: string): { path: string | null; data: CorpusFile } {
  const p = path.join(experimentRoot, "evidence-corpus.json");
  if (!existsSync(p)) return { path: null, data: {} };
  const raw = readFileSync(p, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`evidence-corpus.json is not valid JSON: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`evidence-corpus.json must be a JSON object`);
  }
  return { path: p, data: parsed as CorpusFile };
}

function validateItem(it: CorpusItem, index: number): string | null {
  if (it.itemKind !== "url" && it.itemKind !== "doi") {
    return `item[${index}].itemKind must be 'url' or 'doi'`;
  }
  if (it.itemKind === "url" && !it.url) return `item[${index}] missing 'url'`;
  if (it.itemKind === "doi" && !it.doi) return `item[${index}] missing 'doi'`;
  return null;
}

export async function setupDeliberation(opts: SetupOptions): Promise<SetupResult> {
  const { cfg, iso } = opts;
  const role = opts.role ?? cfg.agents.agents[0]?.role;
  if (!role) throw new Error("No agent roles available in runtime/agents.json");
  const ctx: IsonomiaCallContext = { role };

  const runtimeDeliberationPath = path.join(cfg.runtimeDir, "deliberation.json");
  if (existsSync(runtimeDeliberationPath) && !opts.force) {
    const existing = JSON.parse(readFileSync(runtimeDeliberationPath, "utf8")) as {
      deliberationId?: string;
    };
    if (existing.deliberationId) {
      throw new Error(
        `runtime/deliberation.json already pins deliberationId=${existing.deliberationId}. ` +
          `Pass --force to overwrite, or delete the file manually.`,
      );
    }
  }

  const corpus = readCorpus(cfg.experimentRoot);
  const items = corpus.data.items ?? [];

  // 1. Stack
  let stackId: string;
  let stackSlug: string | undefined;
  if (opts.reuseStackId) {
    stackId = opts.reuseStackId;
  } else {
    const created = await iso.createStack(
      {
        name: opts.stackName ?? corpus.data.stackName ?? DEFAULT_STACK_NAME,
        visibility: corpus.data.stackVisibility ?? "private",
      },
      ctx,
    );
    stackId = created.id;
    stackSlug = created.slug;
  }

  // 2. Seed items (only when not reusing)
  let itemsAdded = 0;
  let itemsSkipped = 0;
  const itemErrors: Array<{ index: number; error: string }> = [];
  if (!opts.reuseStackId && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const v = validateItem(it, i);
      if (v) {
        itemErrors.push({ index: i, error: v });
        itemsSkipped++;
        continue;
      }
      try {
        await iso.addStackItem(stackId, it, ctx);
        itemsAdded++;
      } catch (err) {
        itemErrors.push({ index: i, error: (err as Error)?.message?.slice(0, 300) ?? "unknown" });
        itemsSkipped++;
      }
    }
  }

  // 3. Deliberation
  const ensured = await iso.ensureDeliberation(
    { hostType: "library_stack", hostId: stackId },
    ctx,
  );

  // 4. Bind evidence stack
  await iso.bindEvidenceStack(ensured.id, stackId, ctx);

  // 5. Write runtime/deliberation.json
  const deliberationFile = {
    deliberationId: ensured.id,
    experimentMode: !!opts.experimentMode,
    evidenceStackId: stackId,
    createdAt: new Date().toISOString(),
    notes:
      "Created by `orchestrator setup`. Edit experimentMode to true once ready " +
      "to advance phases under --model-tier=prod.",
  };
  writeFileSync(runtimeDeliberationPath, JSON.stringify(deliberationFile, null, 2) + "\n", "utf8");

  return {
    stackId,
    stackSlug,
    itemsAdded,
    itemsSkipped,
    itemErrors,
    deliberationId: ensured.id,
    deliberationCreated: ensured.created,
    evidenceCorpusPath: corpus.path,
    runtimeDeliberationPath,
  };
}
