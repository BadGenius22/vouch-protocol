/**
 * Vouch Protocol - Homepage E2E Tests
 * Tests for homepage content rendering, navigation, and responsive design
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Content Rendering', () => {
    test('should display hero section with title', async ({ page }) => {
      // Check hero badge
      const badge = page.locator('text=Zero-Knowledge Proofs on Solana');
      await expect(badge).toBeVisible();

      // Check main title - use h1 with specific text
      const title = page.locator('h1');
      await expect(title).toContainText('Prove');
      await expect(title).toContainText('Without');
      await expect(title).toContainText('Revealing');
    });

    test('should display hero subtitle', async ({ page }) => {
      const subtitle = page.locator('.hero-subtitle');
      await expect(subtitle).toContainText('Anonymous reputation proofs');
    });

    test('should display CTA buttons', async ({ page }) => {
      // Developer button
      const devButton = page.getByRole('button', { name: 'Prove Developer Skills' });
      await expect(devButton).toBeVisible();

      // Whale button
      const whaleButton = page.getByRole('button', { name: 'Prove Trading Volume' });
      await expect(whaleButton).toBeVisible();
    });

    test('should display stats section', async ({ page }) => {
      // Stats section should be visible
      const statsSection = page.locator('.stats-section');
      await statsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500); // Wait for scroll animations

      await expect(page.getByText('Privacy Preserved')).toBeVisible();
      await expect(page.getByText('On-Chain Verified')).toBeVisible();
    });

    test('should display features section', async ({ page }) => {
      // Wait for scroll trigger animations
      const featuresSection = page.locator('.features-section');
      await featuresSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000); // Wait for scroll animations

      await expect(page.getByText('True Privacy')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Client-Side Proofs')).toBeVisible({ timeout: 10000 });
    });

    test('should display use cases section', async ({ page }) => {
      const useCasesSection = page.locator('.use-cases-section');
      await useCasesSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000); // Wait for scroll animations

      await expect(page.getByText('For Developers')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('For Traders')).toBeVisible({ timeout: 10000 });

      // Check developer use case details
      await expect(page.getByText('Deployed 3+ programs on Solana')).toBeVisible({ timeout: 10000 });

      // Check trader use case details
      await expect(page.getByText('Traded $50K+ volume in 30 days')).toBeVisible({ timeout: 10000 });
    });

    test('should display how it works section', async ({ page }) => {
      const howItWorksSection = page.locator('.how-it-works-section');
      await howItWorksSection.scrollIntoViewIfNeeded();

      // Check step titles using headings
      await expect(page.locator('.step-card').getByRole('heading', { name: 'Connect' })).toBeVisible();
      await expect(page.locator('.step-card').getByRole('heading', { name: 'Fetch' })).toBeVisible();
    });

    test('should display CTA section at bottom', async ({ page }) => {
      const ctaSection = page.locator('.cta-section');
      await ctaSection.scrollIntoViewIfNeeded();

      await expect(ctaSection.getByRole('heading')).toContainText('Ready to');
      await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'View on GitHub' })).toBeVisible();
    });

    test('should display footer', async ({ page }) => {
      const footer = page.locator('footer');
      await footer.scrollIntoViewIfNeeded();

      await expect(page.locator('text=Vouch Protocol')).toBeVisible();
      await expect(page.locator('footer >> text=GitHub')).toBeVisible();
      await expect(page.locator('footer >> text=Solana')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to developer page via CTA button', async ({ page }) => {
      // Use getByRole for better reliability
      const devLink = page.getByRole('link', { name: /Prove Developer Skills/i });
      await devLink.click();

      await expect(page).toHaveURL('/developer');
      await expect(page.getByRole('heading', { name: /Developer.*Reputation/ })).toBeVisible();
    });

    test('should navigate to whale page via CTA button', async ({ page }) => {
      const whaleLink = page.getByRole('link', { name: /Prove Trading Volume/i });
      await whaleLink.click();

      await expect(page).toHaveURL('/whale');
      await expect(page.getByRole('heading', { name: /Whale.*Trading/ })).toBeVisible();
    });

    test('should navigate to developer page via use case card', async ({ page }) => {
      const useCasesSection = page.locator('.use-cases-section');
      await useCasesSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500); // Wait for scroll animations

      const startLink = page.getByRole('link', { name: /Start Developer Proof/i });
      await startLink.click();

      await expect(page).toHaveURL('/developer');
    });

    test('should navigate to whale page via use case card', async ({ page }) => {
      const useCasesSection = page.locator('.use-cases-section');
      await useCasesSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500); // Wait for scroll animations

      const startLink = page.getByRole('link', { name: /Start Whale Proof/i });
      await startLink.click();

      await expect(page).toHaveURL('/whale');
    });

    test('should navigate to developer page via Get Started button', async ({ page }) => {
      const ctaSection = page.locator('.cta-section');
      await ctaSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500); // Wait for scroll animations

      const getStartedLink = page.getByRole('link', { name: /Get Started/i });
      await getStartedLink.click();

      await expect(page).toHaveURL('/developer');
    });

    test('should open GitHub link in new tab', async ({ page, context }) => {
      const ctaSection = page.locator('.cta-section');
      await ctaSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Listen for new page
      const pagePromise = context.waitForEvent('page');
      const githubLink = page.getByRole('link', { name: /View on GitHub/i });
      await githubLink.click();
      const newPage = await pagePromise;

      expect(newPage.url()).toContain('github.com');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // Check for h1
      const h1 = page.locator('h1');
      await expect(h1.first()).toBeVisible();

      // Check for h2 section headings
      const h2s = page.locator('h2');
      expect(await h2s.count()).toBeGreaterThan(0);
    });

    test('should have accessible link labels', async ({ page }) => {
      // External links should have proper attributes
      const externalLinks = page.locator('a[target="_blank"]');
      const count = await externalLinks.count();

      for (let i = 0; i < count; i++) {
        const link = externalLinks.nth(i);
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });
  });
});

test.describe('Responsive Design', () => {
  test('should display properly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Hero should still be visible
    await expect(page.locator('h1')).toBeVisible();

    // CTA buttons should stack vertically on mobile (flex-col)
    const heroButtons = page.locator('.hero-buttons');
    await expect(heroButtons).toBeVisible();

    // Navigation should still work
    const devLink = page.getByRole('link', { name: /Prove Developer Skills/i });
    await devLink.click();
    await expect(page).toHaveURL('/developer');
  });

  test('should display properly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // All main sections should be visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h2:has-text("Why Vouch")')).toBeVisible();
  });

  test('should display properly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // Features should be in 3-column grid
    const featuresSection = page.locator('.features-section');
    await featuresSection.scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'True Privacy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client-Side Proofs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'On-Chain Verification' })).toBeVisible();
  });
});

test.describe('Animations', () => {
  test('should complete hero animations', async ({ page }) => {
    await page.goto('/');

    // Wait for animations to complete
    await page.waitForTimeout(1500);

    // Elements should be visible after animations
    await expect(page.locator('.hero-badge')).toBeVisible();
    await expect(page.locator('.hero-subtitle')).toBeVisible();
    await expect(page.locator('.hero-buttons')).toBeVisible();
  });

  test('should trigger scroll animations', async ({ page }) => {
    await page.goto('/');

    // Scroll to features section to trigger animations
    await page.locator('.features-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Feature cards should be visible
    const featureCards = page.locator('.feature-card');
    expect(await featureCards.count()).toBe(3);
  });
});
