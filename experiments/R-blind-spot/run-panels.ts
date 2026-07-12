/**
 * experiments/R-blind-spot/run-panels.ts
 *
 * Runs the AI checker pool over the labelled items. For each item it draws
 * N_CLAUDE independent Claude checkers and N_GPT independent GPT checkers —
 * each a FRESH context (one chat call, no shared history), sampled at
 * CHECKER_TEMPERATURE so same-family members are correlated-but-not-identical
 * (see judge.ts). The analyzer composes the arms (claude_1/2/3, cross_2/3) from
 * this flat pool, so nothing is re-run when arm definitions change.
 *
 * Blinding: the judge prompt is verbatim JUDGE_SYSTEM — it never learns which
 * items are seeded, and checkers never see each other's verdicts.
 *
 *   Run: tsx --env-file=.env experiments/R-blind-spot/run-panels.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ClaudeClient, GptClient, MODELS } from "./clients";
import { judgeItem, isCatch } from "./judge";
import type { Item, PoolVerdict } from "./types";

const DATA_DIR = join(__dirname, "data");
const N_CLAUDE = 3; // supports same-family N ∈ {1,2,3}
const N_GPT = 2; // supports cross-family N=2 ({claude,gpt}) and N=3 ({claude,gpt,gpt})
const CHECKER_TEMPERATURE = 0.7;
const CONCURRENCY = 6;

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  const items: Item[] = JSON.parse(readFileSync(join(DATA_DIR, "items.json"), "utf8"));
  const claude = new ClaudeClient();
  const gpt = new GptClient();

  // One task per (item, checker). Each is an independent fresh-context call.
  type Task = { item: Item; family: "claude" | "gpt"; idx: number };
  const tasks: Task[] = [];
  for (const item of items) {
    for (let i = 0; i < N_CLAUDE; i++) tasks.push({ item, family: "claude", idx: i });
    for (let i = 0; i < N_GPT; i++) tasks.push({ item, family: "gpt", idx: i });
  }
  console.log(`Running ${tasks.length} checker calls (${items.length} items × ${N_CLAUDE} claude + ${N_GPT} gpt)...`);

  let done = 0;
  const verdicts = await mapLimit(tasks, CONCURRENCY, async (t) => {
    const client = t.family === "claude" ? claude : gpt;
    const model = t.family === "claude" ? MODELS.claude : MODELS.gpt;
    const outcome = await judgeItem(client, model, t.item, CHECKER_TEMPERATURE);
    if (++done % 25 === 0) console.log(`  ${done}/${tasks.length}`);
    const pv: PoolVerdict = {
      itemId: t.item.id,
      family: t.family,
      modelVersion: model,
      checkerId: `${t.family}:${t.idx}`,
      verdict: outcome.verdict,
      justification: outcome.justification,
      caught: outcome.verdict === "parse_error" ? false : isCatch(outcome.verdict),
      raw: outcome.raw.slice(0, 400),
    };
    return pv;
  });

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "ai-verdicts.json"), JSON.stringify(verdicts, null, 2));
  const parseErrors = verdicts.filter((v) => v.verdict === "parse_error").length;
  console.log(`\nWrote ${verdicts.length} AI verdicts → data/ai-verdicts.json (${parseErrors} parse errors).`);
  console.log(`Next: add human verdicts (human-apply --mode=panel), then: tsx experiments/R-blind-spot/analyze.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
