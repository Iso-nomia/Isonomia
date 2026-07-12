/**
 * Round 4 — challenge-CQ client island e2e (Dev Spec §12.3/§12.5 step 11).
 *
 * Drives the `ChallengeCqAffordance` + `ChallengeCqDialog` islands mounted in
 * the server `AnsweredCriticalQuestions` card via the harness page at
 * /test/challenge-cq-island. The DB is never touched — `/api/me` (session gate)
 * and `/api/cqs/challenge` (the write) are mocked with `page.route()`.
 *
 * Cases (mirroring the answer-flow surface):
 *   1. happy path  — signed in → file a REBUT → optimistic DISPUTED confirm.
 *   2. signed-out  — no session → "Sign in to challenge" link, no form.
 *   3. 422 evidence — UNDERMINE without evidence is blocked client-side, then
 *      the server 422 (CQ_CHALLENGE_NEEDS_EVIDENCE) is surfaced inline.
 */
import { test, expect } from "@playwright/test";

const HARNESS = "/test/challenge-cq-island";

const MOCK_SESSION = {
  uid: "auth-harness-1",
  userId: "42",
  email: "tester@example.com",
  name: "Test Filer",
};

test.describe("§12 — challenge-CQ island", () => {
  test("signed-out renders a sign-in link, not the form", async ({ page }) => {
    await page.route("**/api/me", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: "null" }),
    );

    await page.goto(HARNESS);

    await expect(page.getByText("Sign in to challenge")).toBeVisible();
    await expect(page.getByTestId("challenge-cq-button")).toHaveCount(0);
  });

  test("happy path — file a REBUT, card flips to optimistic DISPUTED", async ({ page }) => {
    await page.route("**/api/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION),
      }),
    );

    let posted: any = null;
    await page.route("**/api/cqs/challenge", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          cqStatusId: "cqs-1",
          challengeClaimId: "claim-challenge-1",
          answerClaimId: "claim-answer-1",
          claimEdgeId: "edge-1",
          cqAttackId: "attack-1",
          cqStatusEnum: "DISPUTED",
          attackType: "REBUT",
          permalink: null,
        }),
      });
    });

    await page.goto(HARNESS);

    await page.getByTestId("challenge-cq-button").click();
    const dialog = page.getByRole("dialog", { name: "Challenge this answer" });
    await expect(dialog).toBeVisible();

    // REBUT is selected by default; fill grounds and file.
    await dialog
      .getByPlaceholder("Explain why this answer should be re-examined…")
      .fill("The cited author's chair is in an unrelated discipline.");
    await dialog.getByRole("button", { name: "File challenge" }).click();

    // Optimistic confirmation; dialog closes.
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("this answer is now disputed")).toBeVisible();

    // Verify the posted payload shape.
    expect(posted.argumentId).toBe("arg-harness-0001");
    expect(posted.cqKey).toBe("EO1");
    expect(posted.attackType).toBe("REBUT");
    expect(typeof posted.requestId).toBe("string");
    expect(posted.requestId.length).toBeGreaterThan(0);
  });

  test("UNDERMINE without evidence is blocked, then 422 is surfaced", async ({ page }) => {
    await page.route("**/api/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION),
      }),
    );

    let hitServer = false;
    await page.route("**/api/cqs/challenge", async (route) => {
      hitServer = true;
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "This CQ requires evidence to challenge.",
          code: "CQ_CHALLENGE_NEEDS_EVIDENCE",
        }),
      });
    });

    await page.goto(HARNESS);
    await page.getByTestId("challenge-cq-button").click();
    const dialog = page.getByRole("dialog", { name: "Challenge this answer" });
    await expect(dialog).toBeVisible();

    // Select UNDERMINE.
    await dialog.getByText("The evidence cited doesn't hold").click();
    await dialog
      .getByPlaceholder("Explain why this answer should be re-examined…")
      .fill("The linked study was retracted in 2024.");

    // Client mirror: evidence required → File challenge disabled, no round-trip.
    const fileBtn = dialog.getByRole("button", { name: "File challenge" });
    await expect(fileBtn).toBeDisabled();
    await expect(
      dialog.getByText(
        "Undermining the cited evidence requires you to cite at least one claim or source.",
      ),
    ).toBeVisible();
    expect(hitServer).toBe(false);

    // Add a source URL → submit enabled → server 422 surfaces inline.
    await dialog.getByPlaceholder("https://source-url…").fill("https://example.com/retraction");
    await dialog.getByRole("button", { name: "Add" }).nth(1).click();
    await expect(fileBtn).toBeEnabled();
    await fileBtn.click();

    expect(hitServer).toBe(true);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("This challenge needs evidence", { exact: false }),
    ).toBeVisible();
  });
});
