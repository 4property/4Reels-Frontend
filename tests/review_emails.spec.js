import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 26 — review-emails chip editor.
 *
 * Three viewport-scoped scenarios:
 *   1. Add + dedup + invalid → only 2 chips survive; PUT carries the
 *      normalised list[str].
 *   2. Legacy CSV hydration → mock returns a CSV string; UI splits it
 *      into 2 chips.
 *   3. Backspace on empty input → removes the last chip.
 */

const REVIEW_EMAIL_KEY = 'automation.reviewEmails';

async function gotoReviewMode(page) {
  await page.goto('/automation');
  await page.waitForLoadState('networkidle');
  // Switch to review-first mode so the chip editor is mounted.
  await page.getByRole('button', { name: /Send email before publishing/ }).click();
  await expect(page.getByTestId('review-emails-editor')).toBeVisible();
}

test.describe('feature 26 — review_emails chip editor', () => {
  test('add, dedup and reject invalid then save as list[str]', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const defaultsPuts = [];
    page.on('request', (request) => {
      if (request.method() !== 'PUT') return;
      if (!request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/defaults`)) return;
      try {
        defaultsPuts.push(JSON.parse(request.postData() || '{}'));
      } catch {
        defaultsPuts.push({});
      }
    });

    await gotoReviewMode(page);

    const input = page.getByTestId('review-emails-input');
    await input.click();
    await input.type('ops@4pm.ie');
    await input.press('Enter');

    // Duplicate (different casing) — silently ignored.
    await input.type('OPS@4pm.ie');
    await input.press('Enter');

    await input.type('boss@4pm.ie');
    await input.press('Enter');

    // Invalid — error banner appears, chip not added.
    await input.type('not-an-email');
    await input.press('Enter');
    await expect(page.getByTestId('review-emails-error')).toBeVisible();

    const chips = page.getByTestId('review-emails-chip');
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toContainText('ops@4pm.ie');
    await expect(chips.nth(1)).toContainText('boss@4pm.ie');

    await page.getByRole('button', { name: /Save/ }).first().click();

    await expect.poll(() => defaultsPuts.length).toBeGreaterThan(0);
    const body = defaultsPuts[defaultsPuts.length - 1];
    expect(body?.settings?.[REVIEW_EMAIL_KEY]).toEqual([
      'ops@4pm.ie',
      'boss@4pm.ie',
    ]);
  });

  test('legacy CSV hydration renders two chips', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      defaultsByAgency: {
        [SAMPLE_AGENCY_ID]: {
          platforms: ['instagram'],
          duration_seconds: 30,
          intro_enabled: true,
          settings: {
            [REVIEW_EMAIL_KEY]: 'a@x.com, b@y.com',
          },
        },
      },
    });

    await gotoReviewMode(page);

    const chips = page.getByTestId('review-emails-chip');
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toContainText('a@x.com');
    await expect(chips.nth(1)).toContainText('b@y.com');
  });

  test('backspace on empty input removes the last chip', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    await gotoReviewMode(page);

    const input = page.getByTestId('review-emails-input');
    await input.click();
    await input.type('one@x.com');
    await input.press('Enter');
    await input.type('two@y.com');
    await input.press('Enter');

    let chips = page.getByTestId('review-emails-chip');
    await expect(chips).toHaveCount(2);

    // Empty input → Backspace removes last.
    await expect(input).toHaveValue('');
    await input.press('Backspace');

    chips = page.getByTestId('review-emails-chip');
    await expect(chips).toHaveCount(1);
    await expect(chips.nth(0)).toContainText('one@x.com');
  });
});
