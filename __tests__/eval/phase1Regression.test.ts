/**
 * Phase 1 regression test (CI gate).
 *
 * Runs the `MockBriefingClient` against every fixture in every
 * corpus (v1 + v2) and asserts that:
 *   - every fixture passes the Phase 1 scorecard,
 *   - no confident misstatements are detected,
 *   - all adversarial gates pass.
 *
 * The mock client emits a structurally-perfect briefing claim from
 * the manifest. If it ever stops passing, one of three things broke:
 *   (a) scorecard logic regressed (a check fires when it shouldn't);
 *   (b) manifest generator regressed (different ground truth from
 *       same readout);
 *   (c) a fixture was edited inconsistently with its committed
 *       readout / spec.
 *
 * This is the gate that protects the harness itself across changes
 * to prompts, payloads, the briefing assembler, or refactors of the
 * scorecard code. Real-LLM regression (OpenAIBriefingClient) runs
 * separately, on-demand or nightly.
 */

import { join } from "node:path";
import { loadCorpus } from "../../eval/ai-epi/loadCorpus";
import { generateManifest } from "../../eval/ai-epi/manifestGenerator";
import { scorePhase1 } from "../../eval/ai-epi/scorecard/phase1";
import { MockBriefingClient } from "../../eval/ai-epi/llm/mockClient";

const CORPUS_PATHS = {
  v1: join(__dirname, "..", "..", "eval", "ai-epi", "corpus", "v1", "manifest.json"),
  v2: join(__dirname, "..", "..", "eval", "ai-epi", "corpus", "v2", "manifest.json"),
};

describe("eval/ai-epi: phase 1 regression (mock client)", () => {
  const client = new MockBriefingClient();

  for (const [label, path] of Object.entries(CORPUS_PATHS)) {
    describe(`corpus ${label}`, () => {
      const corpus = loadCorpus(path);

      it(`loads at least one fixture`, () => {
        expect(corpus.fixtures.length).toBeGreaterThan(0);
      });

      for (const fixture of corpus.fixtures) {
        it(`${fixture.id} — mock client passes the scorecard`, async () => {
          const manifest = generateManifest(fixture);
          const claim = await client.produceBriefingClaim(fixture);
          const report = scorePhase1(fixture, manifest, claim);

          if (!report.pass) {
            // Verbose failure output: shows exactly which check broke.
            const lines: string[] = [];
            lines.push(`Fixture ${fixture.id} failed Phase 1 scorecard:`);
            for (const m of report.confidentMisstatements) {
              lines.push(`  confident misstatement [${m.kind}]: ${m.detail}`);
            }
            for (const g of report.adversarialGateResults) {
              if (!g.passed) {
                lines.push(`  adversarial gate ${g.gate} FAILED: ${g.detail}`);
              }
            }
            throw new Error(lines.join("\n"));
          }

          expect(report.pass).toBe(true);
          expect(report.confidentMisstatements).toEqual([]);
          for (const g of report.adversarialGateResults) {
            expect(g.passed).toBe(true);
          }
        });
      }
    });
  }
});
