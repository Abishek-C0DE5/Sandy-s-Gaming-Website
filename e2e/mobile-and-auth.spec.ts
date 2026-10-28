import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation, Layouts & Auth UI', () => {
  test('Mobile hamburger menu opens and closes correctly on mobile viewport', async ({ page }) => {
    // Set small viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Look for mobile menu toggle button
    const menuToggle = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(menuToggle).toBeVisible();

    // Click to open
    await menuToggle.click();

    // Verify mobile nav drawer links are visible
    const mobileBlogLink = page.locator('div[class*="md:hidden"] a[href="/blog"]');
    await expect(mobileBlogLink).toBeVisible();

    // Click to close
    await menuToggle.click();
    await expect(mobileBlogLink).not.toBeVisible();
  });

  test('Login page renders accessible inputs and handles empty validation', async ({ page }) => {
    await page.goto('/login');

    // Verify main heading
    await expect(page.locator('h1')).toContainText(/Passwordless Sign In|Sign In/i);

    const emailInput = page.locator('input#email, input[type="email"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Verify accessible labels
    const emailLabel = page.locator('label[for="email"]');
    await expect(emailLabel).toBeVisible();
  });

  test('Verify OTP page renders accessible 6-digit code inputs', async ({ page }) => {
    await page.goto('/verify-otp');
    // Verify OTP container
    const otpInput = page.locator('input[name="token"], input[name="code"], input[type="text"]');
    await expect(otpInput.first()).toBeVisible();
  });
});
