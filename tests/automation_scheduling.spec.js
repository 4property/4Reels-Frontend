import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 16 — Automation scheduling (hold / quiet hours / skip
 * weekends).
 *
 * Each scenario:
 *   1. Pins the page clock (`page.clock.install`) so `Date.now()` is
 *      deterministic.
 *   2. Seeds the mock backend with automation rules that mirror the new
 *      contract sent by `buildAutomationBody`.
 *   3. Opens the Reel editor on a `pending_review` reel and clicks
 *      "Approve & Publish".
 *   4. Asserts that the approve response carries the expected
 *      `scheduled_at` and that the banner renders
 *      "Publicará el dd/mm/yyyy a las HH:MM." with the slot formatted
 *      in the agency-local timezone (Europe/Dublin, UTC+1 in May).
 *
 * The mock backend mirrors `compute_next_publish_slot` (back feature
 * 14): hold_window_seconds → +seconds; quiet_hours_enabled →
 * publish_window_start..end is the *allowed* range; skip_weekends →
 * defer Sat/Sun to the next `publish_days` entry at
 * `publish_window_start`.
 */

const SEED_REEL = {
  site_id: 'ckp.ie',
  source_property_id: 42,
  slug: 'cranford-court',
  title: 'Cranford Court',
  featured_image_url: '/assets/property/primary.jpg',
  property_area_label: 'Stillorgan',
  property_county_label: 'Dublin',
  price: '€385,000',
  workflow_state: 'awaiting_review',
  publish_status: 'awaiting_review',
  render_status: 'ready',
  pipeline_created_at: '2026-05-12T09:00:00Z',
};

test.describe('feature 16 — automation scheduling (hold/quiet/skip)', () => {
  test('quiet hours 22:00–07:00 + approve at 23:00 local → next 07:00', async ({ browser }) => {
    // 2026-05-13T22:00:00Z = Wednesday 23:00 Europe/Dublin (UTC+1 in May).
    const fixedNowIso = '2026-05-13T22:00:00Z';
    const expectedScheduledIso = '2026-05-14T06:00:00Z';
    const context = await browser.newContext({
      timezoneId: 'Europe/Dublin',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(fixedNowIso);

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [SEED_REEL],
      automationRulesByAgency: {
        [SAMPLE_AGENCY_ID]: {
          approval_required: false,
          hold_window_seconds: 0,
          quiet_hours_enabled: true,
          skip_weekends: false,
          publish_window_start: '07:00',
          publish_window_end: '22:00',
          publish_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        },
      },
    });

    const approveResponses = await collectApproveResponses(page);

    await page.goto(`/reels/${encodeURIComponent(SEED_REEL.site_id)}/${SEED_REEL.source_property_id}`);
    const editor = page.locator('.editor-overlay');
    await expect(editor).toBeVisible();
    const approveBtn = editor.getByRole('button', { name: /^Approve & Publish$/ });
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    await expect.poll(() => approveResponses.length).toBe(1);
    expect(new Date(approveResponses[0].scheduled_at).toISOString()).toBe(
      new Date(expectedScheduledIso).toISOString(),
    );
    // Banner formatted in Dublin local: 07:00 on 14/05/2026.
    await expect(editor.getByText('Publicará el 14/05/2026 a las 07:00.')).toBeVisible();

    await context.close();
  });

  test('skip weekends + approve Saturday 10:00 → Monday 07:00', async ({ browser }) => {
    // 2026-05-16T09:00:00Z = Saturday 10:00 Europe/Dublin.
    const fixedNowIso = '2026-05-16T09:00:00Z';
    const expectedScheduledIso = '2026-05-18T06:00:00Z';
    const context = await browser.newContext({
      timezoneId: 'Europe/Dublin',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(fixedNowIso);

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [SEED_REEL],
      automationRulesByAgency: {
        [SAMPLE_AGENCY_ID]: {
          approval_required: false,
          hold_window_seconds: 0,
          quiet_hours_enabled: false,
          skip_weekends: true,
          publish_window_start: '07:00',
          publish_window_end: '22:00',
          publish_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        },
      },
    });

    const approveResponses = await collectApproveResponses(page);

    await page.goto(`/reels/${encodeURIComponent(SEED_REEL.site_id)}/${SEED_REEL.source_property_id}`);
    const editor = page.locator('.editor-overlay');
    await expect(editor).toBeVisible();
    const approveBtn = editor.getByRole('button', { name: /^Approve & Publish$/ });
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    await expect.poll(() => approveResponses.length).toBe(1);
    expect(new Date(approveResponses[0].scheduled_at).toISOString()).toBe(
      new Date(expectedScheduledIso).toISOString(),
    );
    await expect(editor.getByText('Publicará el 18/05/2026 a las 07:00.')).toBeVisible();

    await context.close();
  });

  test('hold 2h + skip weekends + approve Friday 23:00 → Monday 07:00', async ({ browser }) => {
    // 2026-05-15T22:00:00Z = Friday 23:00 Europe/Dublin. +2h = Sat 01:00
    // local → skip weekends shifts to Monday at publish_window_start.
    const fixedNowIso = '2026-05-15T22:00:00Z';
    const expectedScheduledIso = '2026-05-18T06:00:00Z';
    const context = await browser.newContext({
      timezoneId: 'Europe/Dublin',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(fixedNowIso);

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [SEED_REEL],
      automationRulesByAgency: {
        [SAMPLE_AGENCY_ID]: {
          approval_required: false,
          hold_window_seconds: 7200,
          quiet_hours_enabled: false,
          skip_weekends: true,
          publish_window_start: '07:00',
          publish_window_end: '22:00',
          publish_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        },
      },
    });

    const approveResponses = await collectApproveResponses(page);

    await page.goto(`/reels/${encodeURIComponent(SEED_REEL.site_id)}/${SEED_REEL.source_property_id}`);
    const editor = page.locator('.editor-overlay');
    await expect(editor).toBeVisible();
    const approveBtn = editor.getByRole('button', { name: /^Approve & Publish$/ });
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    await expect.poll(() => approveResponses.length).toBe(1);
    expect(new Date(approveResponses[0].scheduled_at).toISOString()).toBe(
      new Date(expectedScheduledIso).toISOString(),
    );
    await expect(editor.getByText('Publicará el 18/05/2026 a las 07:00.')).toBeVisible();

    await context.close();
  });
});

async function collectApproveResponses(page) {
  const responses = [];
  page.on('response', async (response) => {
    if (
      response.request().method() === 'POST'
      && /\/approve(\?|$)/.test(response.url())
    ) {
      try {
        responses.push(await response.json());
      } catch {
        // ignore non-JSON responses
      }
    }
  });
  return responses;
}
