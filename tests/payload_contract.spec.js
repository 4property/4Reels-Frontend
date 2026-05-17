import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 6 — payload contract smoke. The mock-backend rejects (422) any
 * field the live backend's Pydantic models also reject with extra='forbid'.
 *
 * Goal: a happy-path save in Sources / Brand / Automation must NOT trigger
 * 422 from the strict mock. Any 422 here means the front sneaked a retired
 * key back into a body — fix the front, do not relax the mock.
 */

test.describe('feature 6 — payload contract', () => {
  test('Brand save sends only the canonical Pydantic body', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const seenBodies = [];
    const seenStatuses = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PUT' &&
        request.url().includes(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand`)
      ) {
        seenBodies.push(safeParse(request.postData()));
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (
        url.includes(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand`) &&
        response.request().method() === 'PUT'
      ) {
        seenStatuses.push(response.status());
      }
    });

    await page.goto('/brand');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Save brand/ }).click();
    await page.waitForLoadState('networkidle');

    expect(seenBodies.length, 'brand PUT was emitted').toBeGreaterThan(0);
    const body = seenBodies[0];
    // Feature 28 — primary_color / secondary_color / font_family are now
    // `str | None`: `null` means "fall back to the default at render time".
    // The contract is that the key is *present* (the front never omits it),
    // not that the value is a string. logo_position is still always a string.
    expect(body).toHaveProperty('primary_color');
    expect(body).toHaveProperty('secondary_color');
    expect(body).toHaveProperty('font_family');
    expect(body).toMatchObject({ logo_position: expect.any(String) });
    expect(
      body.primary_color === null || typeof body.primary_color === 'string',
    ).toBe(true);
    expect(
      body.secondary_color === null || typeof body.secondary_color === 'string',
    ).toBe(true);
    expect(
      body.font_family === null || typeof body.font_family === 'string',
    ).toBe(true);
    for (const banned of [
      'font',
      'tagline',
      'watermark_enabled',
      'outro_enabled',
      'outro_headline',
      'outro_sub',
    ]) {
      expect(body, `brand body must not contain ${banned}`).not.toHaveProperty(banned);
    }
    expect(seenStatuses, 'brand PUT was accepted').toContain(200);
    expect(seenStatuses, 'brand PUT was not 422').not.toContain(422);
  });

  test('Automation save splits between /automation and /defaults', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const automationBodies = [];
    const defaultsBodies = [];
    const automationStatuses = [];
    const defaultsStatuses = [];
    page.on('request', (request) => {
      const url = request.url();
      if (request.method() !== 'PUT') return;
      if (url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/automation`)) {
        automationBodies.push(safeParse(request.postData()));
      }
      if (url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/defaults`)) {
        defaultsBodies.push(safeParse(request.postData()));
      }
    });
    page.on('response', (response) => {
      if (response.request().method() !== 'PUT') return;
      const url = response.url();
      if (url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/automation`)) {
        automationStatuses.push(response.status());
      }
      if (url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/defaults`)) {
        defaultsStatuses.push(response.status());
      }
    });

    await page.goto('/automation');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Save/ }).first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    expect(automationBodies.length, '/automation PUT emitted').toBeGreaterThan(0);
    const automationBody = automationBodies[0];
    expect(automationBody).toMatchObject({
      approval_required: expect.any(Boolean),
      hold_window_seconds: expect.any(Number),
      quiet_hours_enabled: expect.any(Boolean),
      skip_weekends: expect.any(Boolean),
      publish_days: expect.any(Array),
    });
    // Front feature 16: the scheduling toggles moved to /automation, so
    // the banned list shrinks. Captions/regen/review-emails stay banned —
    // they still live on /defaults.
    for (const banned of [
      'publish_mode',
      'platforms',
      'review_window_enabled',
      'review_window_hours',
      'auto_captions',
      'regen_on_update',
      'review_emails',
    ]) {
      expect(automationBody, `/automation must not contain ${banned}`).not.toHaveProperty(
        banned,
      );
    }

    expect(defaultsBodies.length, '/defaults PUT emitted').toBeGreaterThan(0);
    const defaultsBody = defaultsBodies[0];
    expect(Array.isArray(defaultsBody.platforms), 'platforms array on /defaults').toBe(
      true,
    );
    expect(defaultsBody.settings).toBeTruthy();
    // Pass keys as arrays so the literal "automation.x" key is matched
    // (Playwright/Jest treats string args as nested path).
    expect(defaultsBody.settings).toHaveProperty(['automation.autoCaptions']);
    expect(defaultsBody.settings).toHaveProperty(['automation.regenOnUpdate']);
    // The hold / quiet / skip keys are no longer written via /defaults.
    expect(defaultsBody.settings).not.toHaveProperty(['automation.quietHoursEnabled']);
    expect(defaultsBody.settings).not.toHaveProperty(['automation.skipWeekends']);
    expect(defaultsBody.settings).not.toHaveProperty(['automation.reviewWindowEnabled']);
    expect(defaultsBody.settings).not.toHaveProperty(['automation.reviewWindowHours']);

    expect(automationStatuses, 'no 422 on /automation').not.toContain(422);
    expect(defaultsStatuses, 'no 422 on /defaults').not.toContain(422);
  });
});

function safeParse(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
