/**
 * orchestrator/util/iter3-augment.ts
 *
 * Iter-3 helpers that read PHASE_3_ROUND2_PARTIAL.json and
 * PHASE_4_SUBROUNDB_PARTIAL.json (when present) and emit:
 *   1) An `appendedUserBlock` containing `## ROUND_2_ATTACKS` and
 *      `## SUB_ROUND_B_RESPONSES` sections for tracker / synthesist.
 *   2) Augmentation sets for `knownAttackIds` (round-2 rebuttal ids)
 *      and `knownPhase4ResponseIds` (sub-round-b synthesized response ids).
 *
 * Gate: callers should only invoke when `cfg.iter3MultiRound` is true.
 * If the partial files do not exist, returns empty augmentation.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";

import type { Phase3Round2PartialFile } from "../phases/phase-3-round2";
import type { Phase4SubRoundBPartialFile } from "../phases/phase-4-subround-b";

export interface Iter3Augmentation {
  /** Round-2 rebuttal Argument ids to merge into `knownAttackIds`. */
  round2AttackIds: Set<string>;
  /** Sub-round-b response synthesized ids to merge into `knownPhase4ResponseIds`. */
  subRoundBResponseIds: Set<string>;
  /** Block to append to user message (between EVIDENCE_CORPUS and YOUR_TASK). */
  appendedUserBlock: string;
  /** True iff at least one round-2 actor or sub-round-b defender was loaded. */
  anyData: boolean;
}

const PHASE_3_ROUND2_PARTIAL_FILE = "PHASE_3_ROUND2_PARTIAL.json";
const PHASE_4_SUBROUND_B_PARTIAL_FILE = "PHASE_4_SUBROUNDB_PARTIAL.json";

export function loadIter3Augmentation(opts: {
  runtimeDir: string;
  deliberationId: string;
}): Iter3Augmentation {
  const round2 = readPartial<Phase3Round2PartialFile>(
    path.join(opts.runtimeDir, PHASE_3_ROUND2_PARTIAL_FILE),
    opts.deliberationId,
  );
  const subB = readPartial<Phase4SubRoundBPartialFile>(
    path.join(opts.runtimeDir, PHASE_4_SUBROUND_B_PARTIAL_FILE),
    opts.deliberationId,
  );

  const round2AttackIds = new Set<string>();
  const subRoundBResponseIds = new Set<string>();
  const sections: string[] = [];
  let anyData = false;

  if (round2) {
    const block = renderRound2AttacksBlock(round2, round2AttackIds);
    if (block.length > 0) {
      sections.push(block);
      anyData = true;
    }
  }
  if (subB) {
    const block = renderSubRoundBResponsesBlock(subB, subRoundBResponseIds);
    if (block.length > 0) {
      sections.push(block);
      anyData = true;
    }
  }

  return {
    round2AttackIds,
    subRoundBResponseIds,
    appendedUserBlock: sections.join("\n\n"),
    anyData,
  };
}

function readPartial<T extends { deliberationId: string }>(
  partialPath: string,
  deliberationId: string,
): T | null {
  if (!existsSync(partialPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(partialPath, "utf8")) as T;
    if (raw.deliberationId !== deliberationId) return null;
    return raw;
  } catch {
    return null;
  }
}

function renderRound2AttacksBlock(
  round2: Phase3Round2PartialFile,
  outIds: Set<string>,
): string {
  const lines: string[] = [];
  lines.push(`## ROUND_2_ATTACKS`);
  lines.push(``);
  lines.push(
    `Iter-3 multi-round Phase 3 produced a SECOND round of attacks. Each ` +
      `actor (Advocate A, Advocate B, Methodologist) below may have filed ` +
      `(a) NEW direct attacks on opponent's Phase-2 args (\`targetKind=phase2-arg\`), ` +
      `or (b) attacks-on-attacks targeting round-1 rebuttals filed against the ` +
      `actor's own side (\`targetKind=round1-rebuttal\`). Treat these as part of ` +
      `the full record when scoring per-argument standings.`,
  );
  lines.push(``);

  let any = false;
  const actors: Array<["a" | "b" | "methodologist", string]> = [
    ["a", "Advocate A"],
    ["b", "Advocate B"],
    ["methodologist", "Methodologist"],
  ];
  for (const [slot, label] of actors) {
    const rec = round2.actors[slot];
    if (!rec || rec.outcome !== "ok" || !rec.mintResult || !rec.llmOutput) continue;
    const inputs = rec.llmOutput.rebuttals as Array<any>;
    const cqs = (rec.llmOutput as any).cqResponses as Array<any> | undefined;

    let blockHeader = false;
    for (const m of rec.mintResult.rebuttals) {
      const orig = inputs[m.inputIndex];
      if (!orig) continue;
      const round = (orig as any).round ?? "1";
      if (round !== "2") continue;
      const targetKind = (orig as any).targetKind ?? "phase2-arg";
      outIds.add(m.rebuttalArgumentId);
      if (!blockHeader) {
        lines.push(`### ${label} (round-2)`);
        lines.push(``);
        blockHeader = true;
        any = true;
      }
      lines.push(
        `ATTACK ${m.rebuttalArgumentId}  attackType=${m.attackType}  targetKind=${targetKind}  round=2`,
      );
      lines.push(
        `  targets: ${targetKind === "round1-rebuttal" ? "ROUND_1_REBUTTAL" : "ARG"} ${m.targetArgumentId}  premise=${m.targetPremiseIndex ?? "null"}  cqKey=${m.cqKey ?? "null"}`,
      );
      lines.push(`  concludes: "${orig.conclusionText}"`);
      lines.push(`  premises (0-indexed):`);
      const premises = orig.premises as Array<{ text: string; citationToken?: string | null }>;
      for (let i = 0; i < premises.length; i++) {
        lines.push(
          `    [${i}] "${premises[i].text}"  cite=${premises[i].citationToken ?? "null"}`,
        );
      }
      lines.push(`  warrant: ${orig.warrant ? `"${orig.warrant}"` : "null"}`);
      lines.push(`  scheme: ${m.schemeKey}`);
      lines.push(``);
    }
    if (cqs) {
      for (let i = 0; i < cqs.length; i++) {
        const c = cqs[i];
        if (c.action !== "raise") continue;
        const targetKind = c.targetKind ?? "phase2-arg";
        // Synthesized id mirrors the sub-round-b driver's format.
        const cqResponseId = `cqraise-r2-${slot === "methodologist" ? "methodologist" : `advocate-${slot}`}:${c.targetArgumentId}:${c.cqKey}`;
        outIds.add(cqResponseId);
        if (!blockHeader) {
          lines.push(`### ${label} (round-2)`);
          lines.push(``);
          blockHeader = true;
          any = true;
        }
        lines.push(
          `CQ_RAISE ${cqResponseId}  action=raise  targetKind=${targetKind}  round=2`,
        );
        lines.push(`  targets: ARG ${c.targetArgumentId}  cqKey=${c.cqKey}`);
        lines.push(`  rationale: "${c.rationale ?? ""}"`);
        lines.push(``);
      }
    }
  }

  if (!any) return "";
  return lines.join("\n");
}

function renderSubRoundBResponsesBlock(
  subB: Phase4SubRoundBPartialFile,
  outIds: Set<string>,
): string {
  const lines: string[] = [];
  lines.push(`## SUB_ROUND_B_RESPONSES`);
  lines.push(``);
  lines.push(
    `Iter-3 multi-round Phase 4 produced a SECOND sub-round of defenses ` +
      `responding to ROUND_2_ATTACKS above. Treat these alongside Phase-4 ` +
      `sub-round-a responses when scoring per-argument standings.`,
  );
  lines.push(``);

  let any = false;
  for (const slot of ["a", "b"] as const) {
    const rec = subB.advocates[slot];
    if (!rec || rec.outcome !== "ok" || !rec.llmOutput) continue;
    const letter = slot.toUpperCase() as "A" | "B";
    const responses = (rec.llmOutput.responses ?? []) as Array<any>;
    const cqAnswers = (rec.llmOutput.cqAnswers ?? []) as Array<any>;
    if (responses.length === 0 && cqAnswers.length === 0) continue;
    any = true;
    lines.push(`### Advocate ${letter} (sub-round-b)`);
    lines.push(``);
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const responseId = `phase4b-${letter}-r${i}`;
      outIds.add(responseId);
      lines.push(`RESPONSE ${responseId}  kind=${r.kind}  targets: ATTACK ${r.targetAttackId}`);
      if (r.defense) {
        lines.push(
          `  defense: attackType=${r.defense.attackType}  scheme=${r.defense.schemeKey}  premises=${r.defense.premises.length}`,
        );
        lines.push(`  defense.concludes: "${r.defense.conclusionText}"`);
      }
      if (r.kind === "narrow" && r.narrowedConclusionText) {
        lines.push(`  narrowedConclusionText: "${r.narrowedConclusionText}"`);
      }
      if (r.rationale) lines.push(`  rationale: "${r.rationale}"`);
      lines.push(``);
    }
    for (let i = 0; i < cqAnswers.length; i++) {
      const c = cqAnswers[i];
      const cqAnswerId = `phase4b-${letter}-cq${i}`;
      outIds.add(cqAnswerId);
      lines.push(
        `CQ_ANSWER ${cqAnswerId}  kind=${c.kind}  targets: CQ_RAISE ${c.targetCqRaiseId}`,
      );
      if (c.rationale) lines.push(`  rationale: "${c.rationale}"`);
      lines.push(``);
    }
  }

  if (!any) return "";
  return lines.join("\n");
}
