import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads the main page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ArcSwarm/);
  });

  test('connect wallet button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button', { hasText: /Connect Wallet/i })).toBeVisible();
  });

  test('renders the header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('has proper page structure', async ({ page }) => {
    await page.goto('/');
    // Check that the page has a root div and basic structure
    await expect(page.locator('#root')).toBeVisible();
  });
});
