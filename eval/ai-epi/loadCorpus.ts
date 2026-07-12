/**
 * Corpus loader: reads `corpus/<version>/manifest.json` and the
 * referenced fixture files from disk. Pure node-fs; no Prisma.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { CorpusIndex, Fixture } from "./types";

export interface LoadedCorpus {
  version: string;
  fixtures: Fixture[];
}

export function loadCorpus(corpusManifestPath: string): LoadedCorpus {
  const indexRaw = readFileSync(corpusManifestPath, "utf8");
  const index = JSON.parse(indexRaw) as CorpusIndex;
  const corpusDir = dirname(corpusManifestPath);
  const fixtures: Fixture[] = index.fixtures.map((entry) => {
    const fixtureRaw = readFileSync(join(corpusDir, entry.path), "utf8");
    const fixture = JSON.parse(fixtureRaw) as Fixture;
    // Drift detection: when the index pins a contentHash, validate it.
    if (entry.contentHash && fixture.readout.contentHash !== entry.contentHash) {
      throw new Error(
        `Corpus drift on fixture "${entry.id}": manifest pins contentHash=${entry.contentHash} but fixture file has contentHash=${fixture.readout.contentHash}. Re-capture the fixture or update the manifest.`,
      );
    }
    return fixture;
  });
  return { version: index.version, fixtures };
}
