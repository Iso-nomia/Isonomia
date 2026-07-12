/**
 * Initial spec set for corpus-v2 capture.
 *
 * Specs are deliberately minimal. The goal of slice 1 is to prove the
 * end-to-end seed → readout → JSON pipeline on at least one shape;
 * additional shapes (co-equal hubs, diffuse, refusal-rich, hierarchical)
 * are added incrementally in follow-up commits as their seed parameters
 * are tuned against `computeSyntheticReadout`'s actual output.
 */

import type { CaptureSpec, DeliberationSpec, FromExistingSpec } from "./types";

const EXPERT_OPINION: DeliberationSpec["arguments"][number]["scheme"] = {
  key: "expert-opinion",
  name: "Expert Opinion",
  summary: "Argument from expert testimony.",
  cqs: [
    { cqKey: "EO1", text: "Is the source actually an expert in the domain?" },
    { cqKey: "EO2", text: "Is the expert's claim consistent with other experts?" },
  ],
};

/**
 * "Single dominant hub" via DB snapshot.
 *
 * Topology design:
 *   - `a-hub` is the only argument concluding the main claim `c-main`,
 *     so it picks up the +2 main-conclusion-path bonus.
 *   - `a-hub` emits 3 support edges (→ a2, a3, a4), giving supportOut=3.
 *   - Total loadBearingness for `a-hub`: 3 + 2 - 0 = 5.
 *   - Supporting arguments score 0 → `a-hub` is a single dominant hub.
 *   - `p-shared` is used by `a-hub` + `a2` (cascade score = 5+0 = 5),
 *     so it qualifies as a load-bearing premise (threshold ≥ 4).
 *   - One unanswered CQ on `a-hub` → frontier surfaces it.
 */
export const SMALL_SINGLE_HUB_DB: DeliberationSpec = {
  slug: "small-single-hub-db",
  description:
    "DB-snapshot fixture: small (4 args) deliberation with one clearly dominant hub, one shared load-bearing premise, and one unanswered CQ.",
  adversarialGates: [],
  claims: [
    { id: "c-main", text: "We should adopt the proposal." },
    { id: "p-shared", text: "The proposal addresses the core constraint." },
    { id: "p-a2", text: "Supporting consideration A2." },
    { id: "p-a3", text: "Supporting consideration A3." },
    { id: "p-a4", text: "Supporting consideration A4." },
  ],
  arguments: [
    {
      id: "a-hub",
      text: "Adopt the proposal because it addresses the core constraint, on expert advice.",
      conclusionClaimId: "c-main",
      premiseClaimIds: ["p-shared"],
      scheme: EXPERT_OPINION,
    },
    {
      id: "a2",
      text: "Supporting argument A2.",
      premiseClaimIds: ["p-shared", "p-a2"],
    },
    {
      id: "a3",
      text: "Supporting argument A3.",
      premiseClaimIds: ["p-a3"],
    },
    {
      id: "a4",
      text: "Supporting argument A4.",
      premiseClaimIds: ["p-a4"],
    },
  ],
  edges: [
    // Hub supports three downstream arguments.
    { from: "a-hub", to: "a2", type: "support" },
    { from: "a-hub", to: "a3", type: "support" },
    { from: "a-hub", to: "a4", type: "support" },
  ],
  cqStatuses: [
    // Leave EO1 unanswered (no row OR explicit OPEN both produce the
    // same frontier behavior; we set explicit OPEN for clarity).
    {
      targetArgumentId: "a-hub",
      schemeKey: "expert-opinion",
      cqKey: "EO1",
      status: "OPEN",
    },
    // Mark EO2 as satisfied so we can verify the OPEN/SATISFIED split
    // is round-tripping correctly through the pipeline.
    {
      targetArgumentId: "a-hub",
      schemeKey: "expert-opinion",
      cqKey: "EO2",
      status: "SATISFIED",
    },
  ],
};

/**
 * "Co-equal hubs" via DB snapshot.
 *
 * Topology design (target shape: `co-equal-cluster`):
 *   - Three hub args (`a-hub-1`, `a-hub-2`, `a-hub-3`) each conclude
 *     `c-main`, so each picks up the +2 main-conclusion-path bonus.
 *   - Each hub emits 2 support edges → 2 of its own leaves, giving
 *     supportOut=2. Per-hub score = 2 + 2 = 4. All three tie.
 *   - With topScore=4 and HUB_COEQUAL_FRACTION=0.2, coequalThreshold =
 *     max(1, ceil(0.8)) = 1; cutoff = 3. All 3 hubs (score=4) join the
 *     hub set; leaves (score=0) are excluded. set.length=3 →
 *     `co-equal-cluster`, hubAmbiguity = "medium".
 *   - No shared premise → no load-bearing premises.
 *   - One unanswered CQ on `a-hub-1` (expert-opinion) for frontier
 *     coverage; the other two hubs are unschemed.
 */
export const SMALL_COEQUAL_HUBS_DB: DeliberationSpec = {
  slug: "small-coequal-hubs-db",
  description:
    "DB-snapshot fixture: small (9 args) deliberation with three co-equal hub arguments converging on the main claim. Tests co-equal-cluster shape + medium hub ambiguity.",
  adversarialGates: [],
  claims: [
    { id: "c-main", text: "We should adopt the proposal." },
    { id: "p-h1", text: "Hub-1 premise: cost analysis is favorable." },
    { id: "p-h2", text: "Hub-2 premise: timeline is achievable." },
    { id: "p-h3", text: "Hub-3 premise: risk profile is acceptable." },
    { id: "c-l1a", text: "Downstream consideration 1a." },
    { id: "c-l1b", text: "Downstream consideration 1b." },
    { id: "c-l2a", text: "Downstream consideration 2a." },
    { id: "c-l2b", text: "Downstream consideration 2b." },
    { id: "c-l3a", text: "Downstream consideration 3a." },
    { id: "c-l3b", text: "Downstream consideration 3b." },
  ],
  arguments: [
    {
      id: "a-hub-1",
      text: "Adopt the proposal because the cost analysis is favorable (expert).",
      conclusionClaimId: "c-main",
      premiseClaimIds: ["p-h1"],
      scheme: EXPERT_OPINION,
    },
    {
      id: "a-hub-2",
      text: "Adopt the proposal because the timeline is achievable.",
      conclusionClaimId: "c-main",
      premiseClaimIds: ["p-h2"],
    },
    {
      id: "a-hub-3",
      text: "Adopt the proposal because the risk profile is acceptable.",
      conclusionClaimId: "c-main",
      premiseClaimIds: ["p-h3"],
    },
    { id: "a-l1a", text: "Leaf 1a.", premiseClaimIds: ["c-l1a"] },
    { id: "a-l1b", text: "Leaf 1b.", premiseClaimIds: ["c-l1b"] },
    { id: "a-l2a", text: "Leaf 2a.", premiseClaimIds: ["c-l2a"] },
    { id: "a-l2b", text: "Leaf 2b.", premiseClaimIds: ["c-l2b"] },
    { id: "a-l3a", text: "Leaf 3a.", premiseClaimIds: ["c-l3a"] },
    { id: "a-l3b", text: "Leaf 3b.", premiseClaimIds: ["c-l3b"] },
  ],
  edges: [
    { from: "a-hub-1", to: "a-l1a", type: "support" },
    { from: "a-hub-1", to: "a-l1b", type: "support" },
    { from: "a-hub-2", to: "a-l2a", type: "support" },
    { from: "a-hub-2", to: "a-l2b", type: "support" },
    { from: "a-hub-3", to: "a-l3a", type: "support" },
    { from: "a-hub-3", to: "a-l3b", type: "support" },
  ],
  cqStatuses: [
    {
      targetArgumentId: "a-hub-1",
      schemeKey: "expert-opinion",
      cqKey: "EO1",
      status: "OPEN",
    },
    {
      targetArgumentId: "a-hub-1",
      schemeKey: "expert-opinion",
      cqKey: "EO2",
      status: "SATISFIED",
    },
  ],
};

/**
 * "Diffuse hubs" via DB snapshot.
 *
 * Topology design (target shape: `diffuse`):
 *   - Six hub args each conclude `c-main` (+2 main-path bonus each).
 *   - Each hub emits 1 support edge → 1 leaf (supportOut=1).
 *   - Per-hub score = 1 + 2 = 3. Top=3. coequalThreshold = max(1,
 *     ceil(0.6)) = 1; cutoff = 2. All 6 hubs at score=3 ≥ 2 → join hub
 *     set. set.length=6 > HUB_DIFFUSE_THRESHOLD (=5) → `diffuse`,
 *     hubAmbiguity = "high".
 *   - Leaves score 0 → excluded.
 *   - No shared premises → no load-bearing premises.
 *   - No CQ statuses; one hub uses expert-opinion to verify CQ surface
 *     still appears on a diffuse graph.
 */
export const SMALL_DIFFUSE_HUBS_DB: DeliberationSpec = {
  slug: "small-diffuse-hubs-db",
  description:
    "DB-snapshot fixture: small (12 args) deliberation with six co-equal hub arguments. Tests diffuse hub shape + high hub ambiguity.",
  adversarialGates: ["diffuse-topology-not-named-as-hub"],
  claims: [
    { id: "c-main", text: "We should adopt the policy." },
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `p-h${i + 1}`,
      text: `Hub-${i + 1} premise.`,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `c-l${i + 1}`,
      text: `Leaf ${i + 1} claim.`,
    })),
  ],
  arguments: [
    ...Array.from({ length: 6 }, (_, i) => {
      const n = i + 1;
      const arg: DeliberationSpec["arguments"][number] = {
        id: `a-hub-${n}`,
        text: `Adopt the policy because of hub-${n}.`,
        conclusionClaimId: "c-main",
        premiseClaimIds: [`p-h${n}`],
      };
      // Attach expert-opinion only to hub-1 so we still exercise the
      // CQ frontier path on a diffuse graph.
      if (n === 1) arg.scheme = EXPERT_OPINION;
      return arg;
    }),
    ...Array.from({ length: 6 }, (_, i) => {
      const n = i + 1;
      return {
        id: `a-leaf-${n}`,
        text: `Leaf ${n}.`,
        premiseClaimIds: [`c-l${n}`],
      };
    }),
  ],
  edges: Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    return { from: `a-hub-${n}`, to: `a-leaf-${n}`, type: "support" as const };
  }),
  cqStatuses: [],
};

/**
 * "Refusal-rich" via DB snapshot.
 *
 * Topology design (target: non-empty `refusalSurface.cannotConcludeBecause`):
 *   - `a-target` concludes `c-main` (the would-be conclusion).
 *   - `a-undercut` issues an `undercut` edge → `a-target`. Because the
 *     edge is on a real arrow (not just a scheme-typical placeholder),
 *     it surfaces as a non-scheme-typical unanswered undercut, which
 *     `syntheticReadout` treats as a "cannot-license" blocker on
 *     `c-main`.
 *   - `a-undermine` issues an `undermine` edge → `a-target.p-shared`,
 *     adding a second blocker (unanswered-undermine) on the same
 *     conclusion.
 *   - Result: refusalSurface contains entries for `c-main` with both
 *     blocker types.
 *   - We deliberately leave the attackers unanswered (no rebut edges).
 */
export const SMALL_REFUSAL_RICH_DB: DeliberationSpec = {
  slug: "small-refusal-rich-db",
  description:
    "DB-snapshot fixture: small (3 args) deliberation where the only path to the main conclusion is blocked by an unanswered undercut and an unanswered undermine. Tests refusalSurface population.",
  adversarialGates: ["refusal-not-overridden"],
  claims: [
    { id: "c-main", text: "We should green-light the launch." },
    { id: "p-shared", text: "The readiness review passed." },
    { id: "p-undercut", text: "The reviewer was conflicted." },
    { id: "p-undermine", text: "The readiness review used outdated criteria." },
  ],
  arguments: [
    {
      id: "a-target",
      text: "Green-light the launch because the readiness review passed.",
      conclusionClaimId: "c-main",
      premiseClaimIds: ["p-shared"],
    },
    {
      id: "a-undercut",
      text: "The reviewer was conflicted, so the inference doesn't go through.",
      premiseClaimIds: ["p-undercut"],
    },
    {
      id: "a-undermine",
      text: "The readiness review used outdated criteria, so its passing finding is unreliable.",
      premiseClaimIds: ["p-undermine"],
    },
  ],
  edges: [
    { from: "a-undercut", to: "a-target", type: "undercut" },
    // An undermine is encoded at the DB level as `type: "rebut"` with a
    // `targetPremiseId` set (see `frontier.ts:223` —
    // `if (e.type !== "rebut" || !e.targetPremiseId) continue;`).
    {
      from: "a-undermine",
      to: "a-target",
      type: "rebut",
      targetPremiseClaimId: "p-shared",
    },
  ],
  cqStatuses: [],
};

/**
 * Read-only snapshot of an existing real deliberation.
 *
 * As of capture, the database's largest deliberation has 143 arguments,
 * placing it in the `large` size tier (>80, ≤250). It does NOT trip
 * `hierarchicalMode` (which requires >250 = `very-large`). It is still
 * the only fixture exercising:
 *   - Real argument prose and claim text (not synthetic stubs).
 *   - Real `large` size-tier code paths (size disclosure, etc.).
 *   - Real edge mix + scheme distribution + chain inference at scale.
 *
 * Stability comes from `stabilizeReadout`'s lexical-sort-then-substitute
 * pass over every db cuid; re-captures against the same DB are byte-
 * identical.
 */
export const LARGE_REAL_DB: FromExistingSpec = {
  kind: "from-existing",
  slug: "large-real-db",
  description:
    "DB-snapshot fixture: real production deliberation (143 args, large tier). Exercises real argument text, real chain inference, real refusal surface, and the `large` size-tier code paths.",
  adversarialGates: [
    "diffuse-topology-not-named-as-hub",
    "refusal-not-overridden",
  ],
  deliberationId: "cmoxol76e03748cssx07tvkhd",
};

export const ALL_SPECS: CaptureSpec[] = [
  SMALL_SINGLE_HUB_DB,
  SMALL_COEQUAL_HUBS_DB,
  SMALL_DIFFUSE_HUBS_DB,
  SMALL_REFUSAL_RICH_DB,
  LARGE_REAL_DB,
];
