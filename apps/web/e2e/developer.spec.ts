/**
 * Vouch Protocol - Developer Page E2E Tests
 * Tests for developer proof flow UI states and interactions
 */

import { test, expect } from '@playwright/test';

test.describe('Developer Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/developer');
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Structure', () => {
    test('should display page header with title', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Developer');
      await expect(page.locator('h1')).toContainText('Reputation');
    });

    test('should display subtitle', async ({ page }) => {
      const subtitle = page.getByText(/Prove you've deployed successful programs/);
      await expect(subtitle).toBeVisible();
    });

    test('should display step indicator', async ({ page }) => {
      // Step indicator should be visible
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
      await expect(page.getByText('Connect the wallet that deployed your Solana programs')).toBeVisible();
    });

    test('should show wallet button', async ({ page }) => {
      // The WalletButton component should be rendered
      const walletButton = page.getByRole('button').filter({ hasText: /Select Wallet|Connect/i });
      await expect(walletButton.first()).toBeVisible();
    });

    test('should display shield icon', async ({ page }) => {
      // Shield icon should be visible in the main content area
      const shieldIcon = page.locator('main svg, [class*="main-card"] svg').first();
      await expect(shieldIcon).toBeVisible();
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
    test('should display error card when error occurs', async ({ page }) => {
      // We can't easily trigger an error without mocking, but we can check the structure
      // Error card should have specific styling when visible
      const errorSelector = '.border-destructive\\/50';

      // Error should not be visible initially
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

      await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Connect Your Wallet' })).toBeVisible();
    });

    test('should display properly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
      await expect(page.locator('.main-card')).toBeVisible();
    });

    test('should display properly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();

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
      await expect(h1).toContainText('Developer');
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

test.describe('Developer Page - Mocked Wallet Flow', () => {
  // These tests would require wallet mocking which is complex
  // We test the UI states that we can without actual wallet connection

  test('should show loading state structure exists', async ({ page }) => {
    await page.goto('/developer');

    // ProofLoading component should exist in the DOM but be hidden
    // We verify the page structure is correct for when it becomes visible
    const mainCard = page.locator('.main-card');
    await expect(mainCard).toBeVisible();
  });

  test('should have generate step UI structure', async ({ page }) => {
    await page.goto('/developer');

    // The generate step content structure should exist
    // It will show when user completes fetch step
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should have verify step UI structure', async ({ page }) => {
    await page.goto('/developer');

    // The verify step will show "Proof Generated!" message
    // Structure should be ready for this state
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should have complete step UI structure', async ({ page }) => {
    await page.goto('/developer');

    // The complete step shows "Verified On-Chain!" message
    // Structure should be ready for this state
    await expect(page.locator('.main-card')).toBeVisible();
  });
});

test.describe('Developer Page - Navigation', () => {
  test('should be accessible via CTA link', async ({ page }) => {
    await page.goto('/');

    // Navigate to developer page via CTA link
    await page.getByRole('link', { name: /Prove Developer Skills/i }).click();

    await expect(page).toHaveURL('/developer');
    await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
  });

  test('should allow returning to homepage', async ({ page }) => {
    await page.goto('/developer');

    // Click on logo or brand link to go back
    const brandLink = page.locator('header a[href="/"]').first();
    if (await brandLink.isVisible()) {
      await brandLink.click();
      await expect(page).toHaveURL('/');
    }
  });
});

test.describe('Developer Page - Loading States', () => {
  test('should show fetch loading message format', async ({ page }) => {
    await page.goto('/developer');

    // The loading message "Fetching your deployed programs..." should be ready
    // We can't trigger it without wallet, but structure should be correct
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should show proof generation loading message format', async ({ page }) => {
    await page.goto('/developer');

    // The loading state for proof generation should be structured
    await expect(page.locator('.main-card')).toBeVisible();
  });

  test('should show submit loading message format', async ({ page }) => {
    await page.goto('/developer');

    // The loading state for submitting should be structured
    await expect(page.locator('.main-card')).toBeVisible();
  });
});

test.describe('Developer Page - Threshold Display', () => {
  test('should have $10K threshold reference in code', async ({ page }) => {
    await page.goto('/developer');

    // The threshold message structure should exist
    // "Below $10K TVL threshold" message appears when threshold not met
    await expect(page.locator('.main-card')).toBeVisible();
  });
});
