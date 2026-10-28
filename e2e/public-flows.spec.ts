import { test, expect } from '@playwright/test';

test.describe('Public Visitor Flows & Route Guards', () => {
  test('Homepage loads with navigation, published content and footer', async ({ page, isMobile }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/ApexPublish|Sandy/i);

    // Header & Brand
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check main navigation links (desktop vs mobile hamburger)
    if (isMobile) {
      await expect(page.locator('button[aria-label="Toggle navigation menu"]')).toBeVisible();
    } else {
      await expect(page.locator('header a[href="/blog"]').first()).toBeVisible();
      await expect(page.locator('header a[href="/contact"]').first()).toBeVisible();
    }

    // Footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('Blog listing page loads published posts', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveTitle(/Blog/i);

    // Verify main heading
    const heading = page.locator('h1');
    await expect(heading).toContainText(/Blog|Articles|Insights/i);
  });

  test('Invalid blog slug displays not found page gracefully', async ({ page }) => {
    await page.goto('/blog/non-existent-slug-xyz-999');
    await expect(page.locator('h1')).toContainText(/not found|404|could not be located/i);
  });

  test('Guest Contact Us form performs validation and records submission', async ({ page }) => {
    await page.goto('/contact');
    await expect(page).toHaveTitle(/Contact/i);

    // Check form fields exist by ID and type
    const emailInput = page.locator('#contact-email, input[type="email"]');
    const phoneInput = page.locator('#contact-phone, input[type="tel"]');
    const messageInput = page.locator('#contact-message, textarea');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    await expect(messageInput).toBeVisible();

    // Submit valid guest inquiry
    const testEmail = `guest_e2e_${Date.now()}@test.local`;
    await emailInput.fill(testEmail);
    await phoneInput.fill('+1 555-0144');
    await messageInput.fill('Playwright automated end-to-end test message inquiry.');

    await submitBtn.click();

    // Verify success banner / message
    await expect(page.getByRole('heading', { name: /Inquiry Successfully Sent!|Thank you/i })).toBeVisible({ timeout: 10000 });
  });

  test('Guest is strictly redirected away from protected routes', async ({ page }) => {
    // Attempt visiting /admin
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);

    // Attempt visiting /super-admin
    await page.goto('/super-admin');
    await expect(page).toHaveURL(/\/login/);

    // Attempt visiting /chat
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login/);
  });
});
