/**
 * Phase 2.2 regression runner: extracts premises from every fixture
 * in the chosen corpus, scores each against ground truth, prints a
 * compact report, and writes a baseline JSON.
 *
 * Usage:
 *   tsx --env-file=.env eval/ai-epi/premise-extraction/runRegression.ts \
 *     --client mock|openai:<model> [--corpus v1] [--out <path>]
 *
 * The mock extractor is deterministic and used by CI; the openai
 * extractor is gated on OPENAI_API_KEY and used to capture
 * model-specific baselines.
 */

import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createOpenAIPremiseExtractor,
  mockPremiseExtractor,
  type PremiseExtractor,
} from "@/lib/deliberation/premiseExtractor";
import { loadPremiseExtractionCorpus } from "./loadCorpus";
import { aggregateReports, scorePremiseExtraction } from "./scorer";
import type { PremiseExtractionReport } from "./types";

interface CliArgs {
  client: "mock" | { kind: "openai"; model: string };
  corpus: string;
  out?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { client: "mock", corpus: "v1" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--client") {
      const v = argv[++i];
      if (v === "mock") args.client = "mock";
      else if (v?.startsWith("openai:")) {
        args.client = { kind: "openai", model: v.slice("openai:".length) };
      } else {
        throw new Error(`Unknown --client value: ${v}`);
      }
    } else if (a === "--corpus") {
      args.corpus = argv[++i] ?? "v1";
    } else if (a === "--out") {
      args.out = argv[++i];
    }
  }
  return args;
}

function resolveExtractor(client: CliArgs["client"]): {
  label: string;
  extractor: PremiseExtractor;
} {
  if (client === "mock") {
    return { label: "mock", extractor: mockPremiseExtractor };
  }
  return {
    label: `openai:${client.model}`,
    extractor: createOpenAIPremiseExtractor({ model: client.model }),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { label, extractor } = resolveExtractor(args.client);
  const manifestPath = join(
    __dirname,
    "corpus",
    args.corpus,
    "manifest.json",
  );
  const corpus = loadPremiseExtractionCorpus(manifestPath);

  console.log(`\nPhase 2.2 premise extraction — client=${label} corpus=${corpus.version}`);
  console.log(`(${corpus.fixtures.length} fixture(s))\n`);

  const reports: PremiseExtractionReport[] = [];
  for (const fixture of corpus.fixtures) {
    let extraction;
    try {
      extraction = await extractor.extract(fixture.claimText);
    } catch (err: any) {
      console.log(`[ERROR] ${fixture.id}  extractor threw: ${err?.message ?? err}`);
      continue;
    }
    const report = scorePremiseExtraction(fixture, extraction);
    reports.push(report);
    const tag = report.f1 === 1 ? "PASS" : report.recall === 1 ? "OK  " : "FAIL";
    console.log(
      `[${tag}] ${fixture.id}  P=${report.precision.toFixed(2)} R=${report.recall.toFixed(2)} F1=${report.f1.toFixed(2)}  (atoms expected=${fixture.expectedAtoms.length} extracted=${extraction.premises.length})`,
    );
    if (report.unmatchedExpected.length > 0) {
      for (const u of report.unmatchedExpected) {
        console.log(`   - missed expected[${u.index}]: ${JSON.stringify(u.text)}`);
      }
    }
    if (report.unmatchedExtracted.length > 0) {
      for (const u of report.unmatchedExtracted) {
        console.log(`   + spurious extracted[${u.index}]: ${JSON.stringify(u.text)}`);
      }
    }
    if (report.warnings.length > 0) {
      for (const w of report.warnings) console.log(`   ! ${w}`);
    }
  }

  const agg = aggregateReports(reports);
  console.log(
    `\n=> Aggregate (micro): P=${agg.precision.toFixed(2)} R=${agg.recall.toFixed(2)} F1=${agg.f1.toFixed(2)} across ${agg.fixtureCount} fixture(s)`,
  );

  const baseline = {
    runAt: new Date().toISOString(),
    client: label,
    corpusVersion: corpus.version,
    aggregate: agg,
    reports: reports.map((r) => ({
      fixtureId: r.fixtureId,
      precision: r.precision,
      recall: r.recall,
      f1: r.f1,
      truePositives: r.truePositives,
      falsePositives: r.falsePositives,
      falseNegatives: r.falseNegatives,
      extraction: r.extraction,
      warnings: r.warnings,
      unmatchedExpected: r.unmatchedExpected,
      unmatchedExtracted: r.unmatchedExtracted,
    })),
  };

  const outDir = join(__dirname, "baselines");
  mkdirSync(outDir, { recursive: true });
  const defaultName = `${new Date().toISOString().slice(0, 10)}-${label.replace(/[:/]/g, "_")}-${corpus.version}.json`;
  const outPath = args.out ?? join(outDir, defaultName);
  writeFileSync(outPath, JSON.stringify(baseline, null, 2));
  console.log(`Baseline written: ${outPath}`);

  // Exit non-zero only on aggregate recall < 1 (recall is the headline
  // metric — missing an atom is worse than over-splitting once).
  if (agg.recall < 1) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[runRegression:phase2.premise] fatal:", err);
  process.exit(1);
});
