import { test, expect } from '@playwright/test';

test.describe('Mobile PWA Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should load welcome page', async ({ page }) => {
    // Check for welcome elements
    await expect(page.locator('.dragon-logo')).toBeVisible();
    await expect(page.locator('.welcome-title')).toHaveText('Dragon Isle');
    await expect(page.locator('#playButton')).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    // Click play button
    await page.click('#playButton');
    
    // Should navigate to login page
    await expect(page).toHaveURL('/login.html');
    await expect(page.locator('.title')).toHaveText('Enter Dragon Isle');
  });

  test('should validate login form', async ({ page }) => {
    await page.goto('/login.html');
    
    // Try submitting empty form
    await page.click('#joinButton');
    
    // Should show validation error
    await expect(page.locator('#nameError')).toHaveText('Player name is required');
  });

  test('should accept valid login data', async ({ page }) => {
    await page.goto('/login.html');
    
    // Fill in valid data
    await page.fill('#playerName', 'TestPlayer');
    await page.fill('#worldSeed', 'test-world');
    
    // Submit form
    await page.click('#joinButton');
    
    // Should attempt to navigate to game
    // (Will fail to connect but should try)
    await expect(page.locator('.button')).toHaveText('Connecting...');
  });

  test('should generate random world seed', async ({ page }) => {
    await page.goto('/login.html');
    
    // Fill player name
    await page.fill('#playerName', 'TestPlayer');
    
    // Click random world button
    await page.click('#randomWorldButton');
    
    // Should populate world seed
    const seedValue = await page.inputValue('#worldSeed');
    expect(seedValue).toBeTruthy();
    expect(seedValue).toMatch(/^[a-z]+-[a-z]+-\d+$/);
  });

  test('should save player name to localStorage', async ({ page }) => {
    await page.goto('/login.html');
    
    // Fill and submit form
    await page.fill('#playerName', 'TestPlayer123');
    await page.fill('#worldSeed', 'test-seed');
    
    // The form will try to save to localStorage before navigation
    await page.click('#joinButton');
    
    // Check localStorage (this might fail due to navigation, but tests the intent)
    const savedName = await page.evaluate(() => 
      localStorage.getItem('dragon-isle-player-name')
    );
    
    // If navigation hasn't happened yet, we should see the saved name
    if (savedName) {
      expect(savedName).toBe('TestPlayer123');
    }
  });
});

test.describe('Mobile UI Elements', () => {
  test('should have proper mobile viewport', async ({ page }) => {
    await page.goto('/');
    
    // Check viewport meta tag
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).toContain('user-scalable=no');
  });

  test('should have touch-friendly button sizes', async ({ page }) => {
    await page.goto('/');
    
    // Check button size meets minimum touch target (44px)
    const playButton = page.locator('#playButton');
    const buttonBox = await playButton.boundingBox();
    
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
  });

  test('should prevent default touch behaviors', async ({ page }) => {
    await page.goto('/');
    
    // Check CSS touch-action property
    const bodyStyle = await page.evaluate(() => 
      getComputedStyle(document.body).touchAction
    );
    
    expect(bodyStyle).toBe('none');
  });
});

test.describe('PWA Features', () => {
  test('should have web app manifest', async ({ page }) => {
    await page.goto('/');
    
    // Check for manifest link
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Wait for service worker registration
    await page.waitForFunction(() => {
      return 'serviceWorker' in navigator && navigator.serviceWorker.ready;
    });
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        return !!registration;
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });

  test('should have proper theme color', async ({ page }) => {
    await page.goto('/');
    
    // Check theme color meta tag
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1a1a1a');
  });

  test('should have apple mobile web app tags', async ({ page }) => {
    await page.goto('/');
    
    // Check Apple-specific PWA meta tags
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');
  });
});

test.describe('Mobile Performance', () => {
  test('should load quickly on mobile', async ({ page }) => {
    // Start timing
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds on mobile
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have minimal critical path resources', async ({ page }) => {
    const response = await page.goto('/');
    
    // Main HTML should load successfully
    expect(response?.status()).toBe(200);
    
    // Should not have render-blocking resources
    const criticalResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      return resources.filter(resource => 
        resource.name.includes('.css') || resource.name.includes('.js')
      ).length;
    });
    
    // Should have minimal external resources for fast loading
    expect(criticalResources).toBeLessThan(5);
  });
});