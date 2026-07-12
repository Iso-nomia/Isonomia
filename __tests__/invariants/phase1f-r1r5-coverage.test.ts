/**
 * Phase 1f invariant tests — end-to-end R1–R5 invalidation coverage (A8.4).
 *
 * Closes the gap flagged in the Ludics S1/S2 spec review §4.6:
 *   "R1–R5 fingerprint invalidation rules: 0/5 exercised against real data
 *    through end of Session 2 (A8.4)."
 *
 * Existing coverage in phase1f-fossil-fingerprint.test.ts is unit-level
 * against `evaluateStalenessRules` directly. This file drives each rule
 * end-to-end through the public API:
 *
 *   1. `computeBriefingFingerprint` (initial) — seeds module cache + history
 *   2. mutate the mocked readout to trigger exactly ONE rule
 *   3. `computeBriefingFingerprint` (second) — asserts:
 *        - `lastMaterialChangeRule === "Rx"`
 *        - matching B5 component digest moved
 *        - the other three component digests are unchanged (disjointness pin)
 *   4. `checkBriefingFingerprint(prevHash)` — asserts `{ stale: "Rx" }`
 *
 * Together these pin the wiring from readout → MaterialFields → contentHash
 *  → ComponentHashVector → rule attribution → checkBriefingFingerprint.
 * Each test also exercises the B5 component-diff fast-path, since
 * `evaluateStalenessRules` is now called with the cached + current
 * component vectors under the hood.
 */

import {
  computeBriefingFingerprint,
  checkBriefingFingerprint,
  diffComponents,
  type ComponentName,
} from "@/server/ludics/briefingFingerprint";

// ── Mocks (mirror phase1f-fossil-fingerprint.test.ts) ────────────────────────

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    witnessRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/deliberation/syntheticReadout", () => ({
  computeSyntheticReadout: jest.fn(),
}));

jest.mock("@/lib/deliberation/cqPrioritizer", () => ({
  derivePrioritizedOpenCqs: jest.fn(),
}));

jest.mock("@/server/ludics/deliberationSchema", () => ({
  getDeliberationSchema: jest.fn(),
}));

const { computeSyntheticReadout } = jest.requireMock(
  "@/lib/deliberation/syntheticReadout",
);
const { derivePrioritizedOpenCqs } = jest.requireMock(
  "@/lib/deliberation/cqPrioritizer",
);
const { getDeliberationSchema } = jest.requireMock(
  "@/server/ludics/deliberationSchema",
);

// ── Readout / schema fixtures ────────────────────────────────────────────────

function baseReadout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    topology: {
      hubs: {
        set: [{ argumentId: "arg-hub-1", score: 95 }],
        shape: "single-dominant",
        topScore: 95,
        coequalThreshold: 19,
      },
    },
    frontier: {
      loadBearingnessRanking: [
        "arg-1", "arg-2", "arg-3", "arg-4", "arg-5",
        "arg-6", "arg-7", "arg-8", "arg-9", "arg-10",
      ],
    },
    refusalSurface: {
      cannotConcludeBecause: [
        { conclusionClaimId: "claim-A" },
        { conclusionClaimId: "claim-B" },
      ],
    },
    ...overrides,
  };
}

function baseCqs(ids: string[] = ["arg-1::CQ1", "arg-2::CQ2"]) {
  return ids.map((id) => ({
    id,
    targetArgumentId: id.split("::")[0],
    targetsHub: false,
  }));
}

function baseSchema(witnessableLoci = 5, latentLoci = 3) {
  return {
    witnessingSummary: {
      walkedLoci: 10,
      witnessableLoci,
      latentLoci,
      coverageRatio: 0.5,
    },
    openExposurePoints: witnessableLoci + latentLoci,
  };
}

// Each test uses a unique deliberation id to keep the module-level
// history/cache buckets isolated (the cache cannot be reset from
// outside the module).
let counter = 0;
function nextDelibId(rule: string): string {
  counter += 1;
  return `delib-r1r5-${rule}-${counter}`;
}

// Helper: assert that exactly the expected component(s) changed.
function expectChangedComponents(
  prev: Record<ComponentName, string>,
  curr: Record<ComponentName, string>,
  expected: ComponentName[],
) {
  const changed = diffComponents(prev, curr);
  expect([...changed].sort()).toEqual([...expected].sort());
}

// ── End-to-end coverage per rule ─────────────────────────────────────────────

describe("R1–R5 end-to-end invalidation coverage (A8.4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("R1 — hubSet changed", () => {
    it("end-to-end: lastMaterialChangeRule === R1, only `hubs` component moves, checkBriefingFingerprint returns R1", async () => {
      const delib = nextDelibId("R1");

      // — Round 1: seed —
      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const first = await computeBriefingFingerprint(delib);
      expect(first).not.toBeNull();
      expect(first!.lastMaterialChangeRule).toBeNull(); // first computation

      // — Round 2: hubSet changes —
      computeSyntheticReadout.mockResolvedValueOnce(
        baseReadout({
          topology: {
            hubs: {
              set: [{ argumentId: "arg-hub-2", score: 95 }], // ← changed
              shape: "single-dominant",
              topScore: 95,
              coequalThreshold: 19,
            },
          },
        }),
      );
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const second = await computeBriefingFingerprint(delib);
      expect(second).not.toBeNull();
      expect(second!.lastMaterialChangeRule).toBe("R1");
      expect(second!.contentHash).not.toBe(first!.contentHash);
      expectChangedComponents(first!.components, second!.components, ["hubs"]);

      // — Round 3: checkBriefingFingerprint(prevHash) round-trip —
      computeSyntheticReadout.mockResolvedValueOnce(
        baseReadout({
          topology: {
            hubs: {
              set: [{ argumentId: "arg-hub-2", score: 95 }],
              shape: "single-dominant",
              topScore: 95,
              coequalThreshold: 19,
            },
          },
        }),
      );
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const stale = await checkBriefingFingerprint(delib, first!.contentHash);
      expect(stale).toEqual({ stale: "R1" });
    });
  });

  describe("R2 — new refusal-surface conclusion", () => {
    it("end-to-end: lastMaterialChangeRule === R2, only `refusal` component moves, checkBriefingFingerprint returns R2", async () => {
      const delib = nextDelibId("R2");

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const first = await computeBriefingFingerprint(delib);

      computeSyntheticReadout.mockResolvedValueOnce(
        baseReadout({
          refusalSurface: {
            cannotConcludeBecause: [
              { conclusionClaimId: "claim-A" },
              { conclusionClaimId: "claim-B" },
              { conclusionClaimId: "claim-NEW" }, // ← new entry
            ],
          },
        }),
      );
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const second = await computeBriefingFingerprint(delib);
      expect(second!.lastMaterialChangeRule).toBe("R2");
      expectChangedComponents(first!.components, second!.components, ["refusal"]);

      computeSyntheticReadout.mockResolvedValueOnce(
        baseReadout({
          refusalSurface: {
            cannotConcludeBecause: [
              { conclusionClaimId: "claim-A" },
              { conclusionClaimId: "claim-B" },
              { conclusionClaimId: "claim-NEW" },
            ],
          },
        }),
      );
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const stale = await checkBriefingFingerprint(delib, first!.contentHash);
      expect(stale).toEqual({ stale: "R2" });
    });
  });

  describe("R3 — top-5 load-bearing ranking shift", () => {
    it("end-to-end: lastMaterialChangeRule === R3, only `frontier` component moves, checkBriefingFingerprint returns R3", async () => {
      const delib = nextDelibId("R3");

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const first = await computeBriefingFingerprint(delib);

      const shifted = baseReadout({
        frontier: {
          loadBearingnessRanking: [
            "arg-2", "arg-1", "arg-3", "arg-4", "arg-5", // swapped 1↔2
            "arg-6", "arg-7", "arg-8", "arg-9", "arg-10",
          ],
        },
      });
      computeSyntheticReadout.mockResolvedValueOnce(shifted);
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const second = await computeBriefingFingerprint(delib);
      expect(second!.lastMaterialChangeRule).toBe("R3");
      expectChangedComponents(first!.components, second!.components, ["frontier"]);

      computeSyntheticReadout.mockResolvedValueOnce(shifted);
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const stale = await checkBriefingFingerprint(delib, first!.contentHash);
      expect(stale).toEqual({ stale: "R3" });
    });
  });

  describe("R4 — new hub-targeting CQ in top-15", () => {
    it("end-to-end: lastMaterialChangeRule === R4, only `frontier` component moves, checkBriefingFingerprint returns R4", async () => {
      const delib = nextDelibId("R4");

      // Initial CQ list: nothing targets the hub.
      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs(["arg-1::CQ1", "arg-2::CQ2"]));
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const first = await computeBriefingFingerprint(delib);

      // New CQ entering top-15 targets the existing hub `arg-hub-1`.
      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(
        baseCqs(["arg-1::CQ1", "arg-hub-1::CQ_HUB"]),
      );
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const second = await computeBriefingFingerprint(delib);
      expect(second!.lastMaterialChangeRule).toBe("R4");
      expectChangedComponents(first!.components, second!.components, ["frontier"]);

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(
        baseCqs(["arg-1::CQ1", "arg-hub-1::CQ_HUB"]),
      );
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());

      const stale = await checkBriefingFingerprint(delib, first!.contentHash);
      expect(stale).toEqual({ stale: "R4" });
    });
  });

  describe("R5 — openExposurePoints +≥10", () => {
    it("end-to-end: lastMaterialChangeRule === R5, only `witnessing` component moves, checkBriefingFingerprint returns R5", async () => {
      const delib = nextDelibId("R5");

      // Initial exposure = 5 + 3 = 8
      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema(5, 3));

      const first = await computeBriefingFingerprint(delib);

      // New exposure = 12 + 6 = 18 — Δ = 10 ≥ R5_THRESHOLD
      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema(12, 6));

      const second = await computeBriefingFingerprint(delib);
      expect(second!.lastMaterialChangeRule).toBe("R5");
      expectChangedComponents(
        first!.components,
        second!.components,
        ["witnessing"],
      );

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema(12, 6));

      const stale = await checkBriefingFingerprint(delib, first!.contentHash);
      expect(stale).toEqual({ stale: "R5" });
    });
  });

  // ── Negative + priority controls ───────────────────────────────────────────

  describe("no-change control", () => {
    it("identical readouts ⇒ lastMaterialChangeRule null, no component moves, checkBriefingFingerprint stale: false", async () => {
      const delib = nextDelibId("noop");

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());
      const first = await computeBriefingFingerprint(delib);

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());
      const second = await computeBriefingFingerprint(delib);

      expect(second!.contentHash).toBe(first!.contentHash);
      expect(second!.lastMaterialChangeRule).toBeNull();
      expectChangedComponents(first!.components, second!.components, []);

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema());
      const stale = await checkBriefingFingerprint(delib, first!.contentHash);
      expect(stale).toEqual({ stale: false });
    });
  });

  describe("priority order — R1 wins over later rules when multiple fire", () => {
    it("when hubSet changes AND exposure jumps by 10, end-to-end attribution is R1 (and both `hubs` + `witnessing` components move)", async () => {
      const delib = nextDelibId("priority");

      computeSyntheticReadout.mockResolvedValueOnce(baseReadout());
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema(5, 3));
      const first = await computeBriefingFingerprint(delib);

      computeSyntheticReadout.mockResolvedValueOnce(
        baseReadout({
          topology: {
            hubs: {
              set: [{ argumentId: "arg-hub-X", score: 95 }],
              shape: "single-dominant",
              topScore: 95,
              coequalThreshold: 19,
            },
          },
        }),
      );
      derivePrioritizedOpenCqs.mockReturnValueOnce(baseCqs());
      getDeliberationSchema.mockResolvedValueOnce(baseSchema(12, 6));
      const second = await computeBriefingFingerprint(delib);

      expect(second!.lastMaterialChangeRule).toBe("R1");
      expectChangedComponents(
        first!.components,
        second!.components,
        ["hubs", "witnessing"],
      );
    });
  });
});
