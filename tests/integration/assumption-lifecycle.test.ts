import { test, expect } from "@playwright/test";

test.describe("Assumption Lifecycle Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to deliberation page
    await page.goto("/deliberations/test-delib-123");
  });

  test("user can create a new assumption", async ({ page }) => {
    // Navigate to assumptions tab/section
    await page.click("text=Assumptions");

    // Fill out create assumption form
    await page.fill(
      'textarea[placeholder*="assumption"]',
      "Test assumption: All participants are domain experts"
    );

    // Select role
    await page.selectOption('select[name="role"]', "BACKGROUND");

    // Add optional description
    await page.fill(
      'textarea[placeholder*="description"]',
      "This assumption underlies our discussion framework"
    );

    // Submit form
    await page.click('button:has-text("Create Assumption")');

    // Wait for assumption card to appear
    await page.waitForSelector(
      'text=All participants are domain experts'
    );

    // Verify status is PROPOSED
    expect(await page.textContent('[data-testid="assumption-status"]')).toContain(
      "PROPOSED"
    );
  });

  test("user can accept an assumption", async ({ page }) => {
    // Go to assumptions page with existing PROPOSED assumption
    await page.goto("/deliberations/test-delib-123/assumptions");

    // Click Accept button on first assumption
    await page.click('button:has-text("Accept")');

    // Wait for status update
    await page.waitForSelector('text=ACCEPTED', { timeout: 5000 });

    // Verify Accept button replaced with Retract button
    expect(await page.isVisible('button:has-text("Retract")')).toBeTruthy();
  });

  test("user can challenge an assumption with reason", async ({ page }) => {
    await page.goto("/deliberations/test-delib-123/assumptions");

    // Click Challenge button
    await page.click('button:has-text("Challenge")');

    // Fill challenge reason
    await page.fill(
      'textarea[placeholder*="reason"]',
      "This assumption may not hold in all contexts"
    );

    // Submit challenge
    await page.click('button:has-text("Submit Challenge")');

    // Wait for status update
    await page.waitForSelector('text=CHALLENGED');

    // Verify challenge reason is displayed
    expect(
      await page.textContent('[data-testid="challenge-reason"]')
    ).toContain("This assumption may not hold in all contexts");
  });

  test("user can retract an accepted assumption", async ({ page }) => {
    await page.goto("/deliberations/test-delib-123/assumptions");

    // Assume we have an ACCEPTED assumption
    await page.waitForSelector('text=ACCEPTED');

    // Click Retract button
    await page.click('button:has-text("Retract")');

    // Wait for status update
    await page.waitForSelector('text=RETRACTED', { timeout: 5000 });

    // Verify no action buttons visible for retracted assumption
    expect(await page.isVisible('button:has-text("Accept")')).toBeFalsy();
    expect(await page.isVisible('button:has-text("Challenge")')).toBeFalsy();
  });

  test("user can view assumption dependencies", async ({ page }) => {
    await page.goto("/deliberations/test-delib-123/assumptions/assumption-456");

    // Wait for dependency graph to load
    await page.waitForSelector('[data-testid="dependency-graph"]');

    // Verify dependent arguments are listed
    const dependentArgs = page.locator('[data-testid="dependent-argument"]');
    expect(await dependentArgs.count()).toBeGreaterThan(0);

    // Verify impact warning for retraction
    expect(
      await page.textContent('[data-testid="retraction-impact"]')
    ).toContain("would affect");
  });

  test("assumption lifecycle updates active assumptions panel", async ({
    page,
  }) => {
    await page.goto("/deliberations/test-delib-123");

    // Open active assumptions panel
    await page.click('[data-testid="active-assumptions-button"]');

    // Count initial active assumptions
    const initialCount = await page
      .locator('[data-testid="active-assumption-card"]')
      .count();

    // Accept a proposed assumption
    await page.click('button:has-text("Accept")');
    await page.waitForSelector('text=ACCEPTED');

    // Verify active assumptions count increased
    await page.waitForTimeout(1000); // Allow for panel update
    const newCount = await page
      .locator('[data-testid="active-assumption-card"]')
      .count();
    expect(newCount).toBe(initialCount + 1);
  });

  test("challenged assumptions display in separate section", async ({
    page,
  }) => {
    await page.goto("/deliberations/test-delib-123/assumptions");

    // Challenge an assumption
    await page.click('button:has-text("Challenge")');
    await page.fill('textarea[placeholder*="reason"]', "Test challenge");
    await page.click('button:has-text("Submit Challenge")');

    // Navigate to challenged assumptions tab
    await page.click('button:has-text("Challenged")');

    // Verify challenged assumption appears
    await page.waitForSelector('text=CHALLENGED');
    expect(await page.textContent('[data-testid="challenge-reason"]')).toContain(
      "Test challenge"
    );
  });
});
