#!/usr/bin/env tsx
/**
 * Phase 1 regression runner.
 *
 * Loads one or more corpora, generates manifests, asks a
 * `BriefingClient` to produce a `BriefingClaim` per fixture, and
 * grades the result with `scorePhase1`.
 *
 * Usage:
 *   tsx eval/ai-epi/runRegression.ts
 *   tsx eval/ai-epi/runRegression.ts --corpus v1|v2|all
 *   tsx eval/ai-epi/runRegression.ts --corpus /abs/path/to/manifest.json
 *   tsx eval/ai-epi/runRegression.ts --client mock|empty|openai[:model]
 *   tsx eval/ai-epi/runRegression.ts --strict           # exit 1 on any fail
 *
 * Defaults: --corpus all, --client mock. The default invocation is the
 * one CI runs: it must always pass.
 */

import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadCorpus } from "./loadCorpus";
import { generateManifest } from "./manifestGenerator";
import { scorePhase1 } from "./scorecard/phase1";
import type { BriefingClaim, CorpusIndex, Fixture } from "./types";
import type { BriefingClient } from "./llm/client";
import { MockBriefingClient } from "./llm/mockClient";

const CORPUS_PATHS: Record<string, string> = {
  v1: join(__dirname, "corpus", "v1", "manifest.json"),
  v2: join(__dirname, "corpus", "v2", "manifest.json"),
};

interface CliArgs {
  corpusKey: "v1" | "v2" | "all" | "custom";
  corpusCustomPath: string | null;
  clientKind: "mock" | "empty" | "openai";
  clientModel: string | null;
  strict: boolean;
  outPath: string | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1]! : null;
  };

  const corpusRaw = get("--corpus") ?? "all";
  let corpusKey: CliArgs["corpusKey"];
  let corpusCustomPath: string | null = null;
  if (corpusRaw === "v1" || corpusRaw === "v2" || corpusRaw === "all") {
    corpusKey = corpusRaw;
  } else {
    corpusKey = "custom";
    corpusCustomPath = corpusRaw;
  }

  const clientRaw = get("--client") ?? "mock";
  let clientKind: CliArgs["clientKind"];
  let clientModel: string | null = null;
  if (clientRaw === "mock" || clientRaw === "empty") {
    clientKind = clientRaw;
  } else if (clientRaw.startsWith("openai")) {
    clientKind = "openai";
    const colon = clientRaw.indexOf(":");
    if (colon >= 0) clientModel = clientRaw.slice(colon + 1);
  } else {
    throw new Error(
      `Unknown --client value: ${clientRaw}. Use mock | empty | openai[:model].`,
    );
  }

  const strict = args.includes("--strict");
  const outPath = get("--out");

  return { corpusKey, corpusCustomPath, clientKind, clientModel, strict, outPath };
}

function loadCorpora(cli: CliArgs): { label: string; index: CorpusIndex }[] {
  if (cli.corpusKey === "custom") {
    return [{ label: cli.corpusCustomPath!, index: loadCorpus(cli.corpusCustomPath!) }];
  }
  if (cli.corpusKey === "all") {
    return [
      { label: "v1", index: loadCorpus(CORPUS_PATHS.v1) },
      { label: "v2", index: loadCorpus(CORPUS_PATHS.v2) },
    ];
  }
  return [{ label: cli.corpusKey, index: loadCorpus(CORPUS_PATHS[cli.corpusKey]!) }];
}

async function buildClient(cli: CliArgs): Promise<BriefingClient | null> {
  if (cli.clientKind === "mock") return new MockBriefingClient();
  if (cli.clientKind === "empty") return null; // sentinel — use empty {}
  if (cli.clientKind === "openai") {
    const { OpenAIBriefingClient } = await import("./llm/openaiClient");
    return cli.clientModel
      ? new OpenAIBriefingClient(cli.clientModel)
      : new OpenAIBriefingClient();
  }
  throw new Error("unreachable");
}

async function produceClaim(
  client: BriefingClient | null,
  fixture: Fixture,
): Promise<BriefingClaim> {
  if (!client) return {};
  return client.produceBriefingClaim(fixture);
}

async function main(): Promise<void> {
  const cli = parseArgs();
  const corpora = loadCorpora(cli);
  const client = await buildClient(cli);
  const clientLabel = client?.name ?? "empty";
  console.log(
    `Phase 1 regression — client=${clientLabel} strict=${cli.strict}`,
  );

  // Structured baseline accumulator (written iff --out is set).
  const baseline: {
    runAt: string;
    client: string;
    corpora: Array<{
      label: string;
      version: string;
      fixtures: Array<{
        id: string;
        argumentCount: number;
        hubShape: string;
        claim: BriefingClaim;
        report: ReturnType<typeof scorePhase1>;
      }>;
    }>;
    summary: {
      totalFixtures: number;
      totalPasses: number;
      totalFails: number;
    };
  } = {
    runAt: new Date().toISOString(),
    client: clientLabel,
    corpora: [],
    summary: { totalFixtures: 0, totalPasses: 0, totalFails: 0 },
  };

  let grandTotalFixtures = 0;
  let grandTotalPasses = 0;
  let grandTotalFails = 0;

  for (const { label, index } of corpora) {
    console.log(
      `\n=== Corpus ${label} (${index.version}) — ${index.fixtures.length} fixture(s) ===`,
    );

    let totalConfidentMisstatements = 0;
    let totalAdversarialFails = 0;
    let totalPasses = 0;
    const fixtureRecords: typeof baseline.corpora[number]["fixtures"] = [];

    for (const fixture of index.fixtures) {
      const manifest = generateManifest(fixture);
      let claim;
      try {
        claim = await produceClaim(client, fixture);
      } catch (err: any) {
        // Per-fixture resilience: don't let one fixture crash the
        // whole regression. Most common failure mode in real-DB
        // snapshots is context-length overflow on payload serialization
        // (Phase 2.2 premise extraction is designed to attack this).
        // Mark as FAIL with a clear reason and keep going.
        const reason =
          err?.code === "context_length_exceeded"
            ? "context-length-exceeded"
            : err?.code || err?.name || "client-error";
        console.log(
          `\n[FAIL] ${fixture.id}  (args=${manifest.argumentCount}, hubShape=${manifest.hubShape})`,
        );
        console.log(`  client error: ${reason} — ${err?.message ?? err}`);
        fixtureRecords.push({
          id: fixture.id,
          argumentCount: manifest.argumentCount,
          hubShape: manifest.hubShape,
          claim: {},
          report: {
            fixtureId: fixture.id,
            contentHash: manifest.contentHash,
            argumentCount: manifest.argumentCount,
            hub: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: manifest.hubSet.length },
            loadBearingPremise: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: manifest.loadBearingPremises.length },
            openCq: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: manifest.openCqs.length },
            loadBearingOpenCq: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: manifest.loadBearingOpenCqs.length },
            confidentMisstatements: [],
            adversarialGateResults: [],
            pass: false,
            clientError: reason,
          } as any,
        });
        continue;
      }
      const report = scorePhase1(fixture, manifest, claim);
      fixtureRecords.push({
        id: fixture.id,
        argumentCount: manifest.argumentCount,
        hubShape: manifest.hubShape,
        claim,
        report,
      });

      const status = report.pass ? "PASS" : "FAIL";
      console.log(
        `\n[${status}] ${fixture.id}  (args=${manifest.argumentCount}, hubShape=${manifest.hubShape})`,
      );
      console.log(
        `  hub          P=${report.hub.precision.toFixed(2)} R=${report.hub.recall.toFixed(2)} F1=${report.hub.f1.toFixed(2)}`,
      );
      console.log(
        `  premise      P=${report.loadBearingPremise.precision.toFixed(2)} R=${report.loadBearingPremise.recall.toFixed(2)} F1=${report.loadBearingPremise.f1.toFixed(2)}`,
      );
      console.log(
        `  openCq       P=${report.openCq.precision.toFixed(2)} R=${report.openCq.recall.toFixed(2)} F1=${report.openCq.f1.toFixed(2)}`,
      );
      console.log(
        `  lbOpenCq     P=${report.loadBearingOpenCq.precision.toFixed(2)} R=${report.loadBearingOpenCq.recall.toFixed(2)} F1=${report.loadBearingOpenCq.f1.toFixed(2)}  (load-bearing CQ nudges, Phase 2.1)`,
      );
      if (report.confidentMisstatements.length > 0) {
        totalConfidentMisstatements += report.confidentMisstatements.length;
        console.log(
          `  confident misstatements: ${report.confidentMisstatements.length}`,
        );
        for (const m of report.confidentMisstatements) {
          console.log(`    - [${m.kind}] ${m.detail}`);
        }
      }
      for (const g of report.adversarialGateResults) {
        const tag = g.passed ? "ok" : "FAIL";
        console.log(`  gate ${g.gate}: ${tag} — ${g.detail}`);
        if (!g.passed) totalAdversarialFails++;
      }
      if (report.pass) totalPasses++;
    }

    const fails = index.fixtures.length - totalPasses;
    grandTotalFixtures += index.fixtures.length;
    grandTotalPasses += totalPasses;
    grandTotalFails += fails;

    baseline.corpora.push({
      label,
      version: index.version,
      fixtures: fixtureRecords,
    });

    console.log(
      `\n  -> ${totalPasses}/${index.fixtures.length} passed; ${totalConfidentMisstatements} confident misstatement(s); ${totalAdversarialFails} adversarial-gate failure(s).`,
    );
  }

  baseline.summary = {
    totalFixtures: grandTotalFixtures,
    totalPasses: grandTotalPasses,
    totalFails: grandTotalFails,
  };

  console.log(
    `\nGrand total: ${grandTotalPasses}/${grandTotalFixtures} fixtures passed; ${grandTotalFails} failure(s).`,
  );

  if (cli.outPath) {
    mkdirSync(dirname(cli.outPath), { recursive: true });
    writeFileSync(cli.outPath, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`\nBaseline written: ${cli.outPath}`);
  }

  if (cli.strict && grandTotalFails > 0) {
    process.exit(1);
  }
  // In non-strict mode (e.g. empty-baseline runs) failures are
  // diagnostic, not gating.
  process.exit(0);
}

main().catch((err) => {
  console.error("[runRegression] fatal:", err);
  process.exit(2);
});
