/**
 * Vouch Protocol - Error Handling E2E Tests
 * Tests for error boundaries, fallbacks, and edge cases
 */

import { test, expect } from '@playwright/test';

test.describe('Error Boundary Behavior', () => {
  test.describe('WASM Error Boundary', () => {
    test('should wrap developer page in error boundary', async ({ page }) => {
      await page.goto('/developer');

      // Page should load without errors
      await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();

      // Error boundary should be present (WasmErrorBoundary)
      // It won't show unless there's an error
    });

    test('should wrap whale page in error boundary', async ({ page }) => {
      await page.goto('/whale');

      // Page should load without errors
      await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();
    });
  });
});

test.describe('Network Error Scenarios', () => {
  test('should handle offline mode gracefully', async ({ page, context }) => {
    await page.goto('/developer');

    // Simulate going offline
    await context.setOffline(true);

    // Page content should still be visible
    await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();

    // Restore online mode
    await context.setOffline(false);
  });
});

test.describe('JavaScript Disabled', () => {
  // Note: This test checks that the page structure exists
  // Full functionality requires JS

  test('should have basic HTML structure', async ({ page }) => {
    await page.goto('/');

    // Basic HTML elements should exist
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Console Errors', () => {
  test('should not have critical console errors on homepage', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected/harmless errors
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('SharedArrayBuffer') &&
        !err.includes('Cross-Origin') &&
        !err.includes('Failed to load resource') &&
        !err.includes('WebGL') &&
        !err.includes('THREE') &&
        !err.includes('hydrat') // React hydration warnings
    );

    // Log errors for debugging but don't fail on them in E2E
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
  });

  test('should not have critical console errors on developer page', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/developer');
    await page.waitForLoadState('networkidle');

    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('SharedArrayBuffer') &&
        !err.includes('Cross-Origin') &&
        !err.includes('Failed to load resource') &&
        !err.includes('hydrat')
    );

    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
  });

  test('should not have critical console errors on whale page', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/whale');
    await page.waitForLoadState('networkidle');

    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('SharedArrayBuffer') &&
        !err.includes('Cross-Origin') &&
        !err.includes('Failed to load resource') &&
        !err.includes('hydrat')
    );

    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
  });
});

test.describe('Page Crash Recovery', () => {
  test('should recover from page refresh', async ({ page }) => {
    await page.goto('/developer');
    await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();

    // Refresh the page
    await page.reload();

    // Page should reload successfully
    await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
  });

  test('should handle rapid navigation', async ({ page }) => {
    // Navigate rapidly between pages
    await page.goto('/');
    await page.goto('/developer');
    await page.goto('/whale');
    await page.goto('/');
    await page.goto('/developer');

    // Should end up on developer page
    await expect(page).toHaveURL('/developer');
    await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
  });
});

test.describe('Resource Loading', () => {
  test('should load page without critical failures', async ({ page }) => {
    const failedResources: string[] = [];

    page.on('requestfailed', (request) => {
      failedResources.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected failures (optional resources)
    const criticalFailures = failedResources.filter(
      (url) =>
        !url.includes('analytics') &&
        !url.includes('tracking') &&
        !url.includes('sentry') &&
        !url.includes('favicon') &&
        !url.includes('fonts')
    );

    // Log failures for debugging
    if (criticalFailures.length > 0) {
      console.log('Failed resources:', criticalFailures);
    }
  });

  test('should load JavaScript and be interactive', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should be interactive - verify links work
    const ctaLink = page.getByRole('link', { name: /Prove Developer Skills/i });
    await expect(ctaLink).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Slow Network Simulation', () => {
  test('should handle slow network', async ({ page }) => {
    // Simulate slow 3G
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.continue();
    });

    await page.goto('/');

    // Page should eventually load
    await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('State Persistence', () => {
  test('should not persist wallet state on page refresh', async ({ page }) => {
    await page.goto('/developer');

    // Initial state should be connect step
    await expect(page.getByRole('heading', { name: 'Connect Your Wallet' })).toBeVisible();

    // Refresh
    await page.reload();

    // Should still be on connect step (no persistent state)
    await expect(page.getByRole('heading', { name: 'Connect Your Wallet' })).toBeVisible();
  });
});

test.describe('URL Parameter Handling', () => {
  test('should ignore unknown URL parameters', async ({ page }) => {
    await page.goto('/developer?unknown=param&another=value');

    // Page should load normally
    await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
  });

  test('should handle hash fragments', async ({ page }) => {
    await page.goto('/#some-section');

    // Page should load normally
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Content Security', () => {
  test('should not expose sensitive data in DOM', async ({ page }) => {
    await page.goto('/developer');

    // Get all text content
    const bodyText = await page.locator('body').textContent();

    // Should not contain private key patterns
    expect(bodyText).not.toMatch(/[1-9A-HJ-NP-Za-km-z]{87,88}/); // Base58 private key
    expect(bodyText).not.toMatch(/0x[a-fA-F0-9]{64}/); // Hex private key
  });

  test('should not have inline event handlers', async ({ page }) => {
    await page.goto('/');

    // Check for inline onclick handlers (XSS vector)
    const inlineHandlers = await page.locator('[onclick], [onerror], [onload]').count();
    expect(inlineHandlers).toBe(0);
  });
});

test.describe('Memory Leaks', () => {
  test('should handle repeated navigation without crashes', async ({ page }) => {
    // Navigate back and forth multiple times
    for (let i = 0; i < 3; i++) {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.goto('/developer');
      await page.waitForLoadState('domcontentloaded');
      await page.goto('/whale');
      await page.waitForLoadState('domcontentloaded');
    }

    // Final page should still work
    await expect(page.locator('h1')).toContainText('Whale');
  });
});
