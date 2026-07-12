import { test, expect } from "@playwright/test";

test.skip("user can create market via UI", async ({ page }) => {
  // Requires running server with auth
  await page.goto("/");
  // steps: fill form, submit, see card
});
