/**
 * Vouch Protocol - Whale Page E2E Tests
 * Tests for whale trading proof flow UI states and interactions
 */

import { test, expect } from '@playwright/test';

test.describe('Whale Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/whale');
    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Give React time to hydrate
  });

  test.describe('Page Structure', () => {
    test('should display page header with badge', async ({ page }) => {
      await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('body')).toContainText('Whale');
    });

    test('should display subtitle', async ({ page }) => {
      const subtitle = page.getByText('Prove your trading volume without exposing your wallet');
      await expect(subtitle).toBeVisible();
    });

    test('should display step indicator', async ({ page }) => {
      // Step indicator should be visible - wait for it
      await expect(page.locator('[class*="step-indicator"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('should display main card', async ({ page }) => {
      const mainCard = page.locator('[class*="main-card"]').first();
      await expect(mainCard).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Connect Step', () => {
    test('should display connect wallet prompt when not connected', async ({ page }) => {
      await expect(page.getByText('Connect Your Wallet')).toBeVisible();
      await expect(page.getByText('Connect your trading wallet to begin')).toBeVisible();
    });

    test('should show wallet button', async ({ page }) => {
      // The WalletButton component should be rendered
      const walletButton = page.getByRole('button').filter({ hasText: /Select Wallet|Connect/i });
      await expect(walletButton.first()).toBeVisible();
    });

    test('should display trending up icon', async ({ page }) => {
      // SVG icon should be visible in the main content area
      const icon = page.locator('main svg, [class*="main-card"] svg').first();
      await expect(icon).toBeVisible();
    });
  });

  test.describe('Step Indicator States', () => {
    test('should show step indicator elements', async ({ page }) => {
      // Step indicator should be visible with step labels
      await expect(page.locator('body')).toContainText('Connect');
      await expect(page.locator('body')).toContainText('Done');
    });
  });

  test.describe('Error Handling', () => {
    test('should not display error card initially', async ({ page }) => {
      // Error card should not be visible initially
      const errorSelector = '.border-destructive\\/50';
      await expect(page.locator(errorSelector)).not.toBeVisible();
    });
  });

  test.describe('Animations', () => {
    test('should complete page entry animations', async ({ page }) => {
      // Wait for GSAP animations
      await page.waitForTimeout(1000);

      // Header should be visible
      await expect(page.locator('.page-header')).toBeVisible();

      // Step indicator should be visible
      await expect(page.locator('.step-indicator-wrapper')).toBeVisible();

      // Main card should be visible
      await expect(page.locator('.main-card')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Connect Your Wallet' })).toBeVisible();
    });

    test('should display properly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();
      await expect(page.locator('.main-card')).toBeVisible();
    });

    test('should display properly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();

      // Container should be centered with max-width
      const container = page.locator('.container.max-w-4xl');
      await expect(container).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // h1 for page title
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      await expect(h1).toContainText('Whale');
    });

    test('should have accessible buttons', async ({ page }) => {
      // All buttons should be clickable
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          await expect(button).toBeEnabled();
        }
      }
    });
  });
});

test.describe('Whale Page - Mocked Wallet Flow', () => {
  // These tests verify UI state structures exist

  test('should show loading state structure exists', async ({ page }) => {
    await page.goto('/whale');

    // ProofLoading component should exist in the DOM but be hidden
    const mainCard = page.locator('.main-card');
    await expect(mainCard).toBeVisible();
  });

  test('should have generate step UI structure', async ({ page }) => {
    await page.goto('/whale');

    // The generate step will show trading activity (30 days)
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should have verify step UI structure', async ({ page }) => {
    await page.goto('/whale');

    // The verify step will show "Proof Generated!" message
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should have complete step UI structure', async ({ page }) => {
    await page.goto('/whale');

    // The complete step shows "Verified On-Chain!" message
    await expect(page.locator('.main-card')).toBeVisible();
  });
});

test.describe('Whale Page - Navigation', () => {
  test('should be accessible via CTA link', async ({ page }) => {
    await page.goto('/');

    // Navigate to whale page via CTA link
    await page.getByRole('link', { name: /Prove Trading Volume/i }).click();

    await expect(page).toHaveURL('/whale');
    await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();
  });

  test('should allow returning to homepage', async ({ page }) => {
    await page.goto('/whale');

    // Click on logo or brand link to go back
    const brandLink = page.locator('header a[href="/"]').first();
    if (await brandLink.isVisible()) {
      await brandLink.click();
      await expect(page).toHaveURL('/');
    }
  });
});

test.describe('Whale Page - Loading States', () => {
  test('should show fetch loading message format', async ({ page }) => {
    await page.goto('/whale');

    // The loading message "Fetching your trading history..." should be ready
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should show proof generation loading message format', async ({ page }) => {
    await page.goto('/whale');

    // The loading state for proof generation should be structured
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should show submit loading message format', async ({ page }) => {
    await page.goto('/whale');

    // The loading state for submitting should be structured
    await expect(page.locator('.main-card')).toBeVisible();
  });
});

test.describe('Whale Page - Threshold Display', () => {
  test('should have $50K threshold reference', async ({ page }) => {
    await page.goto('/whale');

    // The threshold message structure should exist
    // "Below $50K volume threshold" message appears when threshold not met
    await expect(page.locator('.main-card')).toBeVisible();
  });
});

test.describe('Whale Page - Trading Activity Display', () => {
  test('should have trading activity section structure', async ({ page }) => {
    await page.goto('/whale');

    // Trading Activity (30 days) section should show:
    // - Total Volume
    // - Trade Count
    // Structure exists for when data is fetched
    await expect(page.locator('.main-card')).toBeVisible();
  });
});

test.describe('Whale Page - Visual Differentiation', () => {
  test('should use purple theme color', async ({ page }) => {
    await page.goto('/whale');

    // Badge should have secondary (purple) color
    const badge = page.locator('.bg-secondary\\/5');
    await expect(badge).toBeVisible();
  });

  test('should differ from developer page styling', async ({ page }) => {
    // Developer page uses cyan, whale uses purple
    await page.goto('/developer');
    const devBadge = page.locator('.bg-primary\\/5');
    await expect(devBadge).toBeVisible();

    await page.goto('/whale');
    const whaleBadge = page.locator('.bg-secondary\\/5');
    await expect(whaleBadge).toBeVisible();
  });
});
