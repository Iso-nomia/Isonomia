/**
 * Round E — premiseExtractor wired into the briefing → LLM pipeline.
 *
 * Covers two coupled transforms in `lib/deliberation/briefing.ts`:
 *
 *   1. `atomizeReadoutForLlm(readout, extractor?)` — async pre-pass
 *      that enriches `topArguments` / `mostContested` with atomized
 *      `premises[]` so the eval harness (which bypasses
 *      `buildBriefingPayload` and consumes fixture readouts directly)
 *      still gets atom-granularity payloads.
 *
 *   2. `toCompactForLlm(readout)` — sync compaction; now also drops
 *      the bulky prose `argumentText` blob from any argument carrying
 *      a non-empty `premises[]` (Reading A: never strip a signal
 *      unless a structured replacement is present).
 *
 * These tests pin the "lossless replacement" contract so a future
 * regression that silently drops prose without atoms — or keeps both
 * (token bloat) — fails CI.
 */

import {
  atomizeReadoutForLlm,
  toCompactForLlm,
} from "@/lib/deliberation/briefing";
import { mockPremiseExtractor } from "@/lib/deliberation/premiseExtractor";
import type { SyntheticReadout } from "@/lib/deliberation/syntheticReadout";

// Minimal readout fixture. Only the fields the transforms read are
// populated; everything else is stubbed to satisfy the type. The
// transforms must be pure on this shape.
function makeReadout(overrides?: Partial<SyntheticReadout>): SyntheticReadout {
  const baseArg = {
    rankIndex: 0,
    authorId: "u1",
    authorKind: "HUMAN" as const,
    conclusionClaimId: "c1",
    conclusionText: "C",
    primarySchemeKey: null,
    standing: "claimed" as const,
    standingDepth: "thin" as const,
    challengerCount: 0,
    reviewerCount: 0,
    cqAnswered: 0,
    cqRequired: 0,
    fitness: 0,
  };
  return {
    deliberationId: "delib-1",
    contentHash: "hash-1",
    fingerprint: {} as SyntheticReadout["fingerprint"],
    frontier: {
      unansweredCqs: [],
      terminalLeaves: [],
      loadBearingnessRanking: [],
      loadBearingnessScores: {},
      contestednessRanking: [],
    } as unknown as SyntheticReadout["frontier"],
    missingMoves: {
      perArgument: {},
    } as unknown as SyntheticReadout["missingMoves"],
    chains: {} as SyntheticReadout["chains"],
    cross: null,
    topology: {} as SyntheticReadout["topology"],
    refusalSurface: { cannotConcludeBecause: [] },
    topArguments: [
      {
        ...baseArg,
        id: "a1",
        argumentText: "The bill should pass because it closes a tax loophole.",
      },
    ],
    mostContested: [
      {
        ...baseArg,
        id: "a2",
        argumentText: "The policy is sound and the evidence is clear.",
        unansweredAttackCount: 1,
      },
    ],
    honestyLine: "",
    writingConstraints: {} as SyntheticReadout["writingConstraints"],
    ...overrides,
  };
}

describe("E: atomizeReadoutForLlm", () => {
  it("populates premises[] on topArguments and mostContested using the mock extractor", async () => {
    const readout = makeReadout();

    const atomized = await atomizeReadoutForLlm(readout);

    const top = atomized.topArguments[0] as typeof atomized.topArguments[0] & {
      premises?: { text: string }[];
    };
    const contested = atomized
      .mostContested[0] as typeof atomized.mostContested[0] & {
      premises?: { text: string }[];
    };
    expect(top.premises?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(contested.premises?.length ?? 0).toBeGreaterThanOrEqual(2);
    // Original argumentText is preserved at this stage — compaction
    // drops it, not atomization.
    expect(top.argumentText).toBeTruthy();
    expect(contested.argumentText).toBeTruthy();
  });

  it("is a no-op for arguments lacking argumentText", async () => {
    const readout = makeReadout();
    readout.topArguments[0].argumentText = null;

    const atomized = await atomizeReadoutForLlm(readout);

    const top = atomized.topArguments[0] as typeof atomized.topArguments[0] & {
      premises?: unknown;
    };
    expect(top.premises).toBeUndefined();
  });

  it("is deterministic with the mock extractor (same input ⇒ same atoms)", async () => {
    const r1 = await atomizeReadoutForLlm(makeReadout(), mockPremiseExtractor);
    const r2 = await atomizeReadoutForLlm(makeReadout(), mockPremiseExtractor);
    expect(r1.topArguments).toEqual(r2.topArguments);
    expect(r1.mostContested).toEqual(r2.mostContested);
  });
});

describe("E: toCompactForLlm — atom-aware prose dropping", () => {
  it("drops argumentText from arguments that carry a non-empty premises[]", async () => {
    const atomized = await atomizeReadoutForLlm(makeReadout());

    const compact = toCompactForLlm(atomized);

    const top = compact.topArguments[0] as typeof compact.topArguments[0] & {
      premises?: unknown;
    };
    const contested = compact
      .mostContested[0] as typeof compact.mostContested[0] & {
      premises?: unknown;
    };
    expect(top.argumentText).toBeUndefined();
    expect(contested.argumentText).toBeUndefined();
    // The structured replacement is still there.
    expect(top.premises).toBeDefined();
    expect(contested.premises).toBeDefined();
  });

  it("preserves argumentText when premises[] is absent (back-compat)", () => {
    // Non-atomized readout — toCompactForLlm must not silently drop
    // prose just because we're in compact mode.
    const readout = makeReadout();

    const compact = toCompactForLlm(readout);

    expect(compact.topArguments[0].argumentText).toBe(
      readout.topArguments[0].argumentText,
    );
    expect(compact.mostContested[0].argumentText).toBe(
      readout.mostContested[0].argumentText,
    );
  });

  it("preserves argumentText when premises[] is present but empty", () => {
    // Edge case: an extractor returned an empty array (e.g. blank
    // input). We must not treat that as a structured replacement.
    const readout = makeReadout();
    (readout.topArguments[0] as { premises?: unknown[] }).premises = [];

    const compact = toCompactForLlm(readout);

    expect(compact.topArguments[0].argumentText).toBe(
      readout.topArguments[0].argumentText,
    );
  });

  it("drops bytes vs the prose+atoms shape an enriched payload would otherwise carry", async () => {
    // The compaction win for E is prose+atoms → atoms-only, not
    // prose → atoms. (Atoms add JSON overhead per entry — they pay
    // for themselves as LLM-citable handles, not as a compression
    // device.) The new prose-dropping branch of `toCompactForLlm` is
    // what unlocks the actual token savings on an *enriched* payload.
    const longProse =
      "The bill should pass because it closes a tax loophole " +
      "and it raises revenue for public schools " +
      "and it reduces the deficit over ten years " +
      "and it has bipartisan sponsorship " +
      "and the Congressional Budget Office scored it favorably " +
      "and similar measures have worked in three other states " +
      "since 2018.";
    const readout = makeReadout();
    readout.topArguments[0].argumentText = longProse;
    readout.mostContested[0].argumentText = longProse;

    const atomized = await atomizeReadoutForLlm(readout);
    // Baseline: enriched payload WITHOUT the atom-aware compaction
    // branch — argumentText kept alongside premises[]. We construct
    // it by serializing `atomized` directly (toCompactForLlm-without-
    // the-new-branch would yield the same shape for these fields).
    const enrichedSize = JSON.stringify({
      topArguments: atomized.topArguments,
      mostContested: atomized.mostContested,
    }).length;
    const compacted = toCompactForLlm(atomized);
    const compactedSize = JSON.stringify({
      topArguments: compacted.topArguments,
      mostContested: compacted.mostContested,
    }).length;

    expect(compactedSize).toBeLessThan(enrichedSize);
  });
});
