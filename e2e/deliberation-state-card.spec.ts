/**
 * AI-EPI Pt. 4 §6 — DeliberationStateCard + FrontierLane e2e.
 *
 * Mocks the synthetic-readout and frontier endpoints so the spec runs
 * without a seeded database, and asserts the UI surface contracts:
 *   - State card renders the honesty line.
 *   - State card renders the articulation-only chip when the
 *     fingerprint flags articulationOnly.
 *   - State card renders a refusal-count chip when refusalSurface is
 *     non-empty.
 *   - FrontierLane renders one card per frontier item.
 *   - "Open this thread" CTA dispatches `mesh:openComposer` with a
 *     structured payload that names the target argument.
 *
 * The host page is a tiny test harness at
 * /test/embeddable-widget-pt4 (created alongside this spec).
 */
import { test, expect } from "@playwright/test";

const DELIB_ID = "mock-delib-pt4";
const ARG_A = "arg-aaaaaaaa";
const ARG_B = "arg-bbbbbbbb";

const MOCK_FRONTIER = {
  deliberationId: DELIB_ID,
  unansweredUndercuts: [
    {
      targetArgumentId: ARG_A,
      inferenceLocator: null,
      challengerArgumentId: null,
      schemeTypical: true,
      undercutTypeKey: "false-cause",
      severity: "scheme-required",
    },
  ],
  unansweredUndermines: [],
  unansweredCqs: [
    {
      targetArgumentId: ARG_B,
      schemeKey: "expert-opinion",
      cqKey: "EO1",
      cqPrompt: "Is the source actually an expert in the relevant field?",
      severity: "scheme-required",
    },
  ],
  terminalLeaves: [],
  loadBearingnessRanking: [ARG_A, ARG_B],
};

const MOCK_READOUT = {
  deliberationId: DELIB_ID,
  contentHash: "deadbeefcafebabe1234567890abcdef",
  fingerprint: {
    deliberationId: DELIB_ID,
    contentHash: "deadbeefcafebabe1234567890abcdef",
    argumentCount: 2,
    claimCount: 4,
    edgeCount: { support: 1, attack: 0, ca: 0 },
    schemeDistribution: { "cause-to-effect": 1, "expert-opinion": 1 },
    authorCount: { human: 0, ai: 2, hybrid: 0 },
    participantCount: 1,
    standingDistribution: {
      "untested-default": 2,
      "untested-supported": 0,
      "tested-attacked": 0,
      "tested-undermined": 0,
      "tested-survived": 0,
    },
    depthDistribution: { thin: 2, moderate: 0, dense: 0 },
    medianChallengerCount: 0,
    meanChallengerCount: 0,
    challengerCoverage: 0,
    medianChallengerCountAmongChallenged: 0,
    cqCoverage: { answered: 0, partial: 0, unanswered: 1, total: 1 },
    evidenceCoverage: { withProvenance: 0, total: 0 },
    chainCount: 0,
    extraction: {
      aiSeededCount: 2,
      aiSeededRatio: 1,
      humanEngagementRateOnAiSeeds: null,
      articulationOnly: true,
    },
    computedAt: new Date().toISOString(),
  },
  frontier: MOCK_FRONTIER,
  missingMoves: {
    deliberationId: DELIB_ID,
    perArgument: {},
    perDeliberation: {
      schemesUnused: ["practical-reasoning"],
      metaArgumentsAbsent: true,
      crossSchemeMediatorsAbsent: true,
    },
  },
  chains: { deliberationId: DELIB_ID, chains: [], uncoveredClaims: [] },
  cross: null,
  refusalSurface: {
    cannotConcludeBecause: [
      {
        attemptedConclusion: "<deliberation-scope>",
        conclusionClaimId: "",
        blockedBy: "depth-thin",
        blockerIds: [],
        blockerSummaries: [],
      },
    ],
  },
  honestyLine:
    "This deliberation has 2 argument(s), 0 median challenger(s) per argument, and 0% catalog-CQ coverage. 0 chain(s) on file; 1 potential conclusion(s) are not licensed by the current graph.",
};

test.describe("Pt. 4 §6 — DeliberationStateCard + FrontierLane", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(
      `**/api/v3/deliberations/${DELIB_ID}/synthetic-readout`,
      (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_READOUT) }),
    );
    await page.route(
      `**/api/v3/deliberations/${DELIB_ID}/frontier**`,
      (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FRONTIER) }),
    );
  });

  test("state card renders the honesty line + articulation chip + refusal chip", async ({ page }) => {
    await page.goto(`/test/embeddable-widget-pt4?deliberationId=${DELIB_ID}`);

    const card = page.getByTestId("deliberation-state-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(MOCK_READOUT.honestyLine);
    await expect(page.getByTestId("chip-articulation-only")).toBeVisible();
    await expect(page.getByTestId("chip-refusal-count")).toContainText("1 refusal");
    await expect(page.getByTestId("stat-arguments")).toContainText("2");
  });

  test("frontier lane renders one card per frontier item", async ({ page }) => {
    await page.goto(`/test/embeddable-widget-pt4?deliberationId=${DELIB_ID}`);

    const lane = page.getByTestId("frontier-lane");
    await expect(lane).toBeVisible();
    const cards = page.getByTestId("frontier-item-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText("false-cause");
  });

  test("open-thread CTA dispatches mesh:openComposer with structured payload", async ({ page }) => {
    await page.goto(`/test/embeddable-widget-pt4?deliberationId=${DELIB_ID}`);

    // Capture the next mesh:openComposer event into a window field.
    await page.evaluate(() => {
      (window as any).__lastComposerEvent = null;
      window.addEventListener("mesh:openComposer", (e) => {
        (window as any).__lastComposerEvent = (e as CustomEvent).detail;
      });
    });

    await page.getByTestId("frontier-item-open-thread").first().click();
    const detail = await page.evaluate(() => (window as any).__lastComposerEvent);

    expect(detail).toBeTruthy();
    expect(detail.deliberationId).toBe(DELIB_ID);
    expect(detail.targetArgumentId).toBe(ARG_A);
    expect(detail.kind).toBe("raise-undercut");
    expect(detail.undercutTypeKey).toBe("false-cause");
  });
});
