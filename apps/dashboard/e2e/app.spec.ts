import { test, expect } from '@playwright/test';

test.describe('ArcSwarm Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the header and brand', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /ArcSwarm/i })).toBeVisible();
  });

  test('wallet connect button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
  });

  test('page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('has proper page title', async ({ page }) => {
    await expect(page).toHaveTitle(/ArcSwarm/);
  });
});
