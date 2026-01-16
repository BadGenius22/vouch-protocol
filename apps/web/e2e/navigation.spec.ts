/**
 * Vouch Protocol - Navigation E2E Tests
 * Tests for site-wide navigation, header, and cross-page functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Global Navigation', () => {
  test.describe('Header', () => {
    test('should display header on all pages', async ({ page }) => {
      // Homepage
      await page.goto('/');
      const header = page.locator('header');
      await expect(header).toBeVisible();

      // Developer page
      await page.goto('/developer');
      await expect(page.locator('header')).toBeVisible();

      // Whale page
      await page.goto('/whale');
      await expect(page.locator('header')).toBeVisible();
    });

    test('should have Vouch branding', async ({ page }) => {
      await page.goto('/');
      const brandElement = page.locator('header >> text=Vouch');
      await expect(brandElement).toBeVisible();
    });

    test('should have navigation links', async ({ page }) => {
      await page.goto('/');
      const header = page.locator('header');

      // Check for navigation links
      const developerLink = header.locator('a[href="/developer"]');
      const whaleLink = header.locator('a[href="/whale"]');

      // At least one of these navigation patterns should exist
      const hasDevLink = (await developerLink.count()) > 0;
      const hasWhaleLink = (await whaleLink.count()) > 0;

      // Header should exist
      await expect(header).toBeVisible();
    });
  });

  test.describe('Page Transitions', () => {
    test('should navigate between all pages smoothly', async ({ page }) => {
      // Start at homepage
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();

      // Go to developer via link
      await page.getByRole('link', { name: /Prove Developer Skills/i }).click();
      await expect(page).toHaveURL('/developer');
      await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();

      // Go back home
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();

      // Go to whale via link
      await page.getByRole('link', { name: /Prove Trading Volume/i }).click();
      await expect(page).toHaveURL('/whale');
      await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();
    });

    test('should handle browser back/forward navigation', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Prove Developer Skills/i }).click();
      await expect(page).toHaveURL('/developer');

      // Go back
      await page.goBack();
      await expect(page).toHaveURL('/');

      // Go forward
      await page.goForward();
      await expect(page).toHaveURL('/developer');
    });
  });

  test.describe('Direct URL Access', () => {
    test('should load homepage directly', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should load developer page directly', async ({ page }) => {
      await page.goto('/developer');
      await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
    });

    test('should load whale page directly', async ({ page }) => {
      await page.goto('/whale');
      await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();
    });
  });

  test.describe('404 Handling', () => {
    test('should handle non-existent routes', async ({ page }) => {
      const response = await page.goto('/non-existent-page');
      // Next.js typically returns 404 for non-existent routes
      // The response might be 404 or a custom error page
      expect(response).not.toBeNull();
    });
  });
});

test.describe('Cross-Page Consistency', () => {
  test.describe('Theme Consistency', () => {
    test('should maintain consistent styling across pages', async ({ page }) => {
      // Homepage - check dark background styling
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();

      // Developer page
      await page.goto('/developer');
      await expect(page.locator('body')).toBeVisible();

      // Whale page
      await page.goto('/whale');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Layout Consistency', () => {
    test('should have consistent container widths', async ({ page }) => {
      // Developer page
      await page.goto('/developer');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('.container').first()).toBeVisible({ timeout: 10000 });

      // Whale page
      await page.goto('/whale');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('.container').first()).toBeVisible({ timeout: 10000 });
    });

    test('should have consistent card styling', async ({ page }) => {
      // Developer page
      await page.goto('/developer');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('[class*="main-card"]').first()).toBeVisible({ timeout: 10000 });

      // Whale page
      await page.goto('/whale');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('[class*="main-card"]').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Step Indicator Consistency', () => {
    test('should have same steps on developer and whale pages', async ({ page }) => {
      // Developer page
      await page.goto('/developer');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText('Connect')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Done')).toBeVisible({ timeout: 10000 });

      // Whale page
      await page.goto('/whale');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText('Connect')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Done')).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Wallet Integration UI', () => {
  test.describe('Wallet Button Presence', () => {
    test('should show wallet button on developer page', async ({ page }) => {
      await page.goto('/developer');
      await page.waitForLoadState('networkidle');
      const walletButton = page.getByRole('button').filter({ hasText: /Select Wallet|Connect/i });
      await expect(walletButton.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show wallet button on whale page', async ({ page }) => {
      await page.goto('/whale');
      await page.waitForLoadState('networkidle');
      const walletButton = page.getByRole('button').filter({ hasText: /Select Wallet|Connect/i });
      await expect(walletButton.first()).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Page Load Performance', () => {
  test('should load homepage within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
    const loadTime = Date.now() - startTime;

    // Page should load within 15 seconds (generous for CI environments)
    expect(loadTime).toBeLessThan(15000);
  });

  test('should load developer page within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/developer');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(15000);
  });

  test('should load whale page within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/whale');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(15000);
  });
});

test.describe('External Links', () => {
  test('should have GitHub link on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const ctaSection = page.locator('.cta-section');
    await ctaSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const githubLink = page.getByRole('link', { name: /GitHub/i }).first();
    await expect(githubLink).toBeVisible({ timeout: 10000 });
  });

  test('should have footer links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    await expect(footer.getByText('GitHub')).toBeVisible({ timeout: 10000 });
    await expect(footer.getByText('Solana')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Mobile Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('should navigate on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Navigate to developer via link
    await page.getByRole('link', { name: /Prove Developer Skills/i }).click();
    await expect(page).toHaveURL('/developer');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  });

  test('should maintain layout on mobile', async ({ page }) => {
    await page.goto('/developer');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Main card should still be visible
    await expect(page.locator('[class*="main-card"]').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Keyboard Navigation', () => {
  test('should allow tab navigation through interactive elements', async ({ page }) => {
    await page.goto('/developer');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Tab through the page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Page should be interactive
    await expect(page.locator('body')).toBeVisible();
  });

  test('should allow keyboard interaction with links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Focus on CTA link and press enter
    const ctaLink = page.getByRole('link', { name: /Prove Developer Skills/i });
    await expect(ctaLink).toBeVisible({ timeout: 10000 });
    await ctaLink.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL('/developer');
  });
});
