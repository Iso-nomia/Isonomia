/**
 * H2 invariant — `I-No-Legacy-Read`.
 *
 * No file under `lib/ludics/substrate/**` may read legacy Ludics
 * tables (`prisma.ludicDesign`, `prisma.ludicAct`,
 * `prisma.ludicChronicle`, `prisma.ludicChronicleCache`).
 *
 * Mirrors the rule enforced by
 * `scripts/lint-no-legacy-ludics-read.ts`; this test guarantees the
 * invariant is checked even when the standalone lint script is not
 * wired into a given CI job.
 */

import * as path from "node:path";
import { lintNoLegacyLudicsRead } from "@/scripts/lint-no-legacy-ludics-read";

describe("H2 — I-No-Legacy-Read invariant", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  it("no file under lib/ludics/substrate/** reads prisma.ludicDesign|ludicAct|ludicChronicle|ludicChronicleCache", () => {
    const offences = lintNoLegacyLudicsRead(repoRoot);
    if (offences.length > 0) {
      // Build a useful failure message so the test report points at the
      // exact line that needs to be migrated.
      const detail = offences
        .map((o) => `  ${o.file}:${o.line} /${o.pattern}/ → ${o.text}`)
        .join("\n");
      throw new Error(
        `Expected zero legacy Ludics reads under lib/ludics/substrate/**, found ${offences.length}:\n${detail}`,
      );
    }
    expect(offences).toEqual([]);
  });
});
