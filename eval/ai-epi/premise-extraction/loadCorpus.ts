/**
 * Loader for premise-extraction corpora. Same shape as the Phase 1
 * `loadCorpus.ts` — JSON manifest + per-fixture files.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  LoadedPremiseExtractionCorpus,
  PremiseExtractionCorpusIndex,
  PremiseExtractionFixture,
} from "./types";

export function loadPremiseExtractionCorpus(
  manifestPath: string,
): LoadedPremiseExtractionCorpus {
  const indexRaw = readFileSync(manifestPath, "utf8");
  const index = JSON.parse(indexRaw) as PremiseExtractionCorpusIndex;
  const dir = dirname(manifestPath);
  const fixtures: PremiseExtractionFixture[] = index.fixtures.map((entry) => {
    const raw = readFileSync(join(dir, entry.path), "utf8");
    return JSON.parse(raw) as PremiseExtractionFixture;
  });
  return { version: index.version, fixtures };
}
