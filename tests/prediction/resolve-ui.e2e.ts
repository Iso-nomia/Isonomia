import { test, expect } from "@playwright/test";

test.skip("creator resolves closed market via UI", async ({ page }) => {
  // This test requires a running server with authentication.
  // The workflow: create market, fast-forward close, resolve to YES,
  // then verify UI shows resolved outcome and no Trade button.
  await page.goto("/");
});
