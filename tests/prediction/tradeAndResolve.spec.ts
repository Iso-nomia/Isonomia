import { test, expect } from "@playwright/test";

test.skip("trade then resolve via UI", async ({ page }) => {
  // Requires running server with auth and cron
  await page.goto("/");
  // steps: login as B, trade, fast-forward close, creator resolves
});
