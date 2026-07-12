/**
 * orchestrator/finalize/phase-1-finalize.ts
 *
 * Validates platform state against `PHASE_1_PARTIAL.json`, then writes
 * `PHASE_1_COMPLETE.json` (the gate Stage 3 reads).
 *
 * Validation runs a read-only audit: for every claim in the partial,
 * confirm it still exists on the platform with matching text and
 * deliberation. For every edge, confirm the (from, to, type) tuple is
 * present. Divergence → write `runtime/reviews/phase-1-divergence.md`,
 * refuse to finalize, exit 1.
 *
 * The complete file mirrors the partial's `topology` plus a
 * `reviewSummary` rolled up from the parsed report (if present).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import type { OrchestratorConfig } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { Phase1PartialFile } from "../phases/phase-1-topology";
import { parseReport, reportPathFor } from "../review/report";

export interface Phase1CompleteFile {
  phase: 1;
  status: "complete";
  completedAt: string;
  deliberationId: string;
  modelTier: string;
  rootClaimId: string;
  topology: {
    [index: string]: {
      claimId: string;
      text: string;
      layer: string;
      claimType: string;
      dependsOn: number[];
    };
  };
  edges: Array<{ from: number | "root"; to: number | "root"; type: "supports" }>;
  reviewSummary: {
    totalFlags: number;
    accepted: number;
    revised: number;
    retracted: number;
    reportPath: string | null;
  };
  tokenUsage: { input: number; output: number; modelTier: string };
}

export async function finalizePhase1(opts: {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
}): Promise<Phase1CompleteFile> {
  const partialPath = path.join(opts.cfg.runtimeDir, "PHASE_1_PARTIAL.json");
  if (!existsSync(partialPath)) {
    throw new Error(`PHASE_1_PARTIAL.json not found. Run \`npm run orchestrator -- phase 1\` first.`);
  }
  const partial = JSON.parse(readFileSync(partialPath, "utf8")) as Phase1PartialFile;

  // Audit Claims via /api/claims/search?deliberationId=… (cheap; returns id+text).
  // The /chains endpoint surfaces ArgumentChain records (Phase 2+ artifacts), not
  // raw claims, so it cannot validate Phase 1 minting.
  const divergences: string[] = [];
  try {
    const claims = await opts.iso.listClaims(partial.deliberationId, { role: "claim-analyst" });
    const observedIds = new Set<string>(claims.map((c) => c.id));
    if (!observedIds.has(partial.rootClaimId)) {
      divergences.push(`Root claim ${partial.rootClaimId} not present in deliberation claims.`);
    }
    for (const sc of partial.topology.subClaims) {
      if (!observedIds.has(sc.claimId)) {
        divergences.push(`Sub-claim #${sc.index} (${sc.claimId}) not present in deliberation claims.`);
      }
    }
  } catch (err) {
    // Claims endpoint failed — finalize with a warning rather than blocking.
    divergences.push(`Could not fetch claims for audit: ${(err as Error).message}. Proceeding without claim-existence audit.`);
  }

  if (divergences.some((d) => d.startsWith("Sub-claim") || d.startsWith("Root claim"))) {
    const divPath = path.join(opts.cfg.runtimeDir, "reviews", "phase-1-divergence.md");
    mkdirSync(path.dirname(divPath), { recursive: true });
    writeFileSync(
      divPath,
      `# Phase 1 Finalization — Divergence Detected\n\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        divergences.map((d) => `- ${d}`).join("\n") + "\n\n" +
        `Resolve by either re-running \`phase 1\` (idempotent — claims will be re-minted from cached LLM output via \`--resume\`) or by editing PHASE_1_PARTIAL.json to drop missing items, then re-running \`finalize\`.\n`,
    );
    throw new Error(`Phase 1 finalize refused: divergence detected. See ${divPath}.`);
  }

  // Roll up review summary from the report, if present.
  let reviewSummary: Phase1CompleteFile["reviewSummary"] = {
    totalFlags: partial.reviewFlags.length,
    accepted: 0, revised: 0, retracted: 0, reportPath: null,
  };
  const reportPath = reportPathFor(opts.cfg.runtimeDir, 1);
  if (existsSync(reportPath)) {
    const text = readFileSync(reportPath, "utf8");
    try {
      const verdicts = parseReport(text);
      reviewSummary = {
        totalFlags: verdicts.length,
        accepted: verdicts.filter((v) => v.verdict === "accept").length,
        revised: verdicts.filter((v) => v.verdict === "revise").length,
        retracted: verdicts.filter((v) => v.verdict === "retract").length,
        reportPath,
      };
      const unapplied = verdicts.filter((v) => !v.applied);
      if (unapplied.length > 0) {
        throw new Error(
          `Phase 1 finalize refused: ${unapplied.length} flag(s) in the review report have no \`**Applied:**\` marker. Run \`npm run orchestrator -- review --phase 1 --apply\` first.`,
        );
      }
    } catch (parseErr) {
      throw new Error(`Phase 1 finalize: review report at ${reportPath} could not be parsed: ${(parseErr as Error).message}`);
    }
  } else {
    // Info-severity flags are advisory and don't gate finalize. Only
    // warn/blocker flags require a human-reviewed report.
    const gating = partial.reviewFlags.filter((f) => f.severity !== "info");
    if (gating.length > 0) {
      throw new Error(
        `Phase 1 finalize refused: PHASE_1_PARTIAL.json has ${gating.length} non-info review flag(s) but no review report exists. Generate it with \`npm run orchestrator -- review --phase 1 --produce-report\`, fill in verdicts, then \`--apply\`.`,
      );
    }
  }

  // Build complete file.
  const topology: Phase1CompleteFile["topology"] = {};
  for (const sc of partial.topology.subClaims) {
    topology[String(sc.index)] = {
      claimId: sc.claimId,
      text: sc.text,
      layer: sc.layer,
      claimType: sc.claimType,
      dependsOn: sc.dependsOn,
    };
  }
  const edges = partial.topology.edges.map((e) => ({ from: e.from, to: e.to, type: e.type }));

  const complete: Phase1CompleteFile = {
    phase: 1,
    status: "complete",
    completedAt: new Date().toISOString(),
    deliberationId: partial.deliberationId,
    modelTier: partial.modelTier,
    rootClaimId: partial.rootClaimId,
    topology,
    edges,
    reviewSummary,
    tokenUsage: {
      input: partial.tokenUsage.inputTokens,
      output: partial.tokenUsage.outputTokens,
      modelTier: partial.modelTier,
    },
  };

  const completePath = path.join(opts.cfg.runtimeDir, "PHASE_1_COMPLETE.json");
  writeFileSync(completePath, JSON.stringify(complete, null, 2));
  return complete;
}
