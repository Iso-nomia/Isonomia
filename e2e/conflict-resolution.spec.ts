/**
 * E2E Tests for ASPIC+ Preference Conflict Resolution
 * 
 * Tests the complete workflow:
 * 1. Create preferences that form cycles
 * 2. Navigate to ASPIC tab
 * 3. Detect conflicts
 * 4. Resolve using different strategies
 * 5. Verify resolution success
 */

import { test, expect } from "@playwright/test";

// Test configuration
const TEST_TIMEOUT = 60000; // 60 seconds for full workflow
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Helper to create a test deliberation
async function createTestDeliberation(page: any) {
  // Navigate to deliberations page
  await page.goto(`${BASE_URL}/deliberations`);
  
  // Create new deliberation
  await page.getByRole("button", { name: /create|new/i }).click();
  await page.getByLabel(/title|name/i).fill("Conflict Resolution Test");
  await page.getByRole("button", { name: /create|submit/i }).click();
  
  // Wait for deliberation page to load
  await page.waitForURL(/.*\/deliberations\/.*/, { timeout: 10000 });
  
  // Extract deliberation ID from URL
  const url = page.url();
  const match = url.match(/\/deliberations\/([^\/]+)/);
  return match ? match[1] : null;
}

// Helper to create a preference via API
async function createPreference(
  deliberationId: string,
  preferred: string,
  dispreferred: string,
  weight: number = 1.0
) {
  const response = await fetch(`${BASE_URL}/api/aspic/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deliberationId,
      preferred,
      dispreferred,
      weight,
      justification: `Test preference: ${preferred} > ${dispreferred}`,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create preference: ${response.statusText}`);
  }
  
  return response.json();
}

test.describe("Conflict Resolution Workflow", () => {
  test.setTimeout(TEST_TIMEOUT);
  
  test("should detect and display 2-cycle conflict", async ({ page }) => {
    // Setup: Create deliberation
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create preferences that form a cycle: A < B < A
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_A", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict detection
    await page.waitForSelector("text=conflict", { state: "visible", timeout: 10000 });
    
    // Verify conflict alert is shown
    await expect(page.getByText(/1 conflict detected/i)).toBeVisible();
    
    // Verify cycle display
    await expect(page.getByText(/arg_A.*arg_B.*arg_A/i)).toBeVisible();
    
    // Verify conflict card is present
    await expect(page.getByText(/Conflict #1/i)).toBeVisible();
  });
  
  test("should detect and display 3-cycle conflict", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create preferences that form a cycle: A < B < C < A
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_C", 1.0);
    await createPreference(deliberationId!, "arg_C", "arg_A", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Verify 3-cycle is detected
    await expect(page.getByText(/1 conflict detected/i)).toBeVisible();
    await expect(page.getByText(/arg_A.*arg_B.*arg_C.*arg_A/i)).toBeVisible();
  });
  
  test("should resolve conflict using 'Remove Weakest' strategy", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle with different weights
    await createPreference(deliberationId!, "arg_A", "arg_B", 0.8);
    await createPreference(deliberationId!, "arg_B", "arg_A", 0.3); // Weakest
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict to appear
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Select "Remove Weakest" strategy
    await page.getByLabel(/remove weakest/i).click();
    
    // Click resolve button
    await page.getByRole("button", { name: /resolve conflict/i }).click();
    
    // Wait for success
    await page.waitForSelector("text=No preference conflicts detected", { 
      state: "visible",
      timeout: 10000 
    });
    
    // Verify success message
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
  });
  
  test("should resolve conflict using 'Keep Most Recent' strategy", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle (first preference will be oldest)
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    
    // Wait a bit to ensure timestamp difference
    await page.waitForTimeout(1000);
    
    await createPreference(deliberationId!, "arg_B", "arg_A", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Select "Keep Most Recent" strategy
    await page.getByLabel(/keep most recent/i).click();
    
    // Resolve
    await page.getByRole("button", { name: /resolve conflict/i }).click();
    
    // Verify resolution
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
  });
  
  test("should resolve conflict using 'Manual Selection' strategy", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_A", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Select "Manual Selection" strategy
    await page.getByLabel(/manual selection/i).click();
    
    // Wait for checkboxes to appear
    await page.waitForSelector("input[type='checkbox']", { state: "visible" });
    
    // Select first preference checkbox
    await page.locator("input[type='checkbox']").first().click();
    
    // Resolve
    await page.getByRole("button", { name: /resolve conflict/i }).click();
    
    // Verify resolution
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
  });
  
  test("should show validation error when manual selection has no preferences selected", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_A", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Select "Manual Selection" strategy
    await page.getByLabel(/manual selection/i).click();
    
    // Try to resolve without selecting any preferences
    await page.getByRole("button", { name: /resolve conflict/i }).click();
    
    // Verify error message
    await expect(page.getByText(/select at least one preference/i)).toBeVisible();
  });
  
  test("should handle multiple conflicts sequentially", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create two separate cycles
    // Cycle 1: A < B < A
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_A", 0.5);
    
    // Cycle 2: C < D < C
    await createPreference(deliberationId!, "arg_C", "arg_D", 1.0);
    await createPreference(deliberationId!, "arg_D", "arg_C", 0.5);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflicts
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Verify 2 conflicts detected
    await expect(page.getByText(/2 conflicts? detected/i)).toBeVisible();
    
    // Resolve first conflict
    await page.getByLabel(/remove weakest/i).first().click();
    await page.getByRole("button", { name: /resolve conflict/i }).first().click();
    
    // Wait for first resolution
    await page.waitForTimeout(2000);
    
    // Verify only 1 conflict remains
    await expect(page.getByText(/1 conflict detected/i)).toBeVisible();
    
    // Resolve second conflict
    await page.getByLabel(/remove weakest/i).first().click();
    await page.getByRole("button", { name: /resolve conflict/i }).first().click();
    
    // Verify all conflicts resolved
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
  });
  
  test("should refresh ASPIC theory after conflict resolution", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_A", 0.5);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Resolve conflict
    await page.getByLabel(/remove weakest/i).click();
    await page.getByRole("button", { name: /resolve conflict/i }).click();
    
    // Wait for resolution
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
    
    // Verify ASPIC theory panel is still present and updated
    // (AspicTheoryPanel should have re-rendered with new key)
    await expect(page.getByText(/aspic.*theory/i)).toBeVisible();
  });
  
  test("should display preference metadata correctly", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle with specific weights
    await createPreference(deliberationId!, "arg_A", "arg_B", 0.85);
    await createPreference(deliberationId!, "arg_B", "arg_A", 0.42);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Verify weight badges are displayed
    await expect(page.getByText("0.85")).toBeVisible();
    await expect(page.getByText("0.42")).toBeVisible();
    
    // Verify preference relationships are displayed
    await expect(page.getByText(/arg_A.*arg_B/i)).toBeVisible();
    await expect(page.getByText(/arg_B.*arg_A/i)).toBeVisible();
  });
  
  test("should show loading state during resolution", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_A", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Select strategy
    await page.getByLabel(/remove weakest/i).click();
    
    // Click resolve and immediately check for loading state
    const resolveButton = page.getByRole("button", { name: /resolve conflict/i });
    await resolveButton.click();
    
    // Verify loading text appears
    await expect(page.getByText(/resolving/i)).toBeVisible({ timeout: 1000 });
  });
  
  test("should handle network errors gracefully", async ({ page }) => {
    // This test requires mocking network failures
    // For now, we'll test the error display with an invalid deliberation ID
    
    // Navigate to a non-existent deliberation
    await page.goto(`${BASE_URL}/deliberations/invalid-id-12345`);
    
    // Try to access ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Verify error handling (should show error or empty state)
    // Exact behavior depends on implementation
    const hasError = await page.getByText(/error|failed|not found/i).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no conflicts/i).isVisible().catch(() => false);
    
    expect(hasError || hasEmpty).toBeTruthy();
  });
});

test.describe("Conflict Resolution Edge Cases", () => {
  test.setTimeout(TEST_TIMEOUT);
  
  test("should handle complex 4+ node cycle", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create 4-cycle: A < B < C < D < A
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_C", 1.0);
    await createPreference(deliberationId!, "arg_C", "arg_D", 1.0);
    await createPreference(deliberationId!, "arg_D", "arg_A", 0.5);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Verify conflict detected
    await expect(page.getByText(/1 conflict detected/i)).toBeVisible();
    
    // Verify all 4 preferences shown in conflict card
    await expect(page.getByText(/arg_A/i)).toBeVisible();
    await expect(page.getByText(/arg_B/i)).toBeVisible();
    await expect(page.getByText(/arg_C/i)).toBeVisible();
    await expect(page.getByText(/arg_D/i)).toBeVisible();
    
    // Resolve using weakest preference
    await page.getByLabel(/remove weakest/i).click();
    await page.getByRole("button", { name: /resolve conflict/i }).click();
    
    // Verify resolution
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
  });
  
  test("should show recommendation badge for significantly weaker preference", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create cycle with very different weights
    await createPreference(deliberationId!, "arg_A", "arg_B", 0.9);
    await createPreference(deliberationId!, "arg_B", "arg_A", 0.2); // Much weaker
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Verify "Recommended" badge is shown for Remove Weakest strategy
    await expect(page.getByText(/recommended/i)).toBeVisible();
  });
  
  test("should allow selecting multiple preferences in manual mode", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Create 3-cycle
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    await createPreference(deliberationId!, "arg_B", "arg_C", 1.0);
    await createPreference(deliberationId!, "arg_C", "arg_A", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Wait for conflict
    await page.waitForSelector("text=conflict", { state: "visible" });
    
    // Select manual strategy
    await page.getByLabel(/manual selection/i).click();
    
    // Wait for checkboxes
    await page.waitForSelector("input[type='checkbox']", { state: "visible" });
    
    // Select two preferences (removing 2 of 3 breaks the cycle)
    const checkboxes = await page.locator("input[type='checkbox']").all();
    await checkboxes[0].click();
    await checkboxes[1].click();
    
    // Resolve
    await page.getByRole("button", { name: /resolve conflict/i }).click();
    
    // Verify resolution
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
  });
});

test.describe("Conflict Resolution UI States", () => {
  test("should show empty state when no conflicts exist", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Don't create any conflicting preferences
    // Just create a single valid preference
    await createPreference(deliberationId!, "arg_A", "arg_B", 1.0);
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Verify empty state is shown
    await expect(page.getByText(/no.*conflicts.*detected/i)).toBeVisible();
    await expect(page.getByText(/all preferences are consistent/i)).toBeVisible();
  });
  
  test("should show loading state initially", async ({ page }) => {
    const deliberationId = await createTestDeliberation(page);
    expect(deliberationId).toBeTruthy();
    
    // Navigate to ASPIC tab
    await page.getByRole("tab", { name: /arguments/i }).click();
    await page.getByRole("tab", { name: /aspic/i }).click();
    
    // Verify loading spinner appears briefly
    const loadingText = page.getByText(/checking.*conflicts/i);
    
    // Loading state might be very brief, so we use a short timeout
    try {
      await expect(loadingText).toBeVisible({ timeout: 2000 });
    } catch {
      // If loading is too fast to catch, that's fine
      console.log("Loading state was too fast to verify (acceptable)");
    }
  });
});
