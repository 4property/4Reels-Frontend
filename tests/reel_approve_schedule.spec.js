import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 10 (wire_automation_publish_window_to_ghl_schedule) — smoke for
 * the post-approve scheduled-slot indicator.
 *
 * Acceptance:
 *   A) `scheduled_at` present in the POST `/approve` response → the
 *      banner shows "Publicará el dd/mm/yyyy a las HH:MM" (browser-local
 *      TZ).
 *   B) `scheduled_at` null → legacy copy "Reel approved." (regression).
 *
 * Determinism: the desktop Playwright project runs Chromium with the
 * host's default TZ (Europe/Dublin on the CI/dev box). The smoke
 * forces the page's `Intl` resolver into UTC via `--timezone-id` is
 * impractical here (Playwright projects already locked), so we instead
 * pin an emulated context TZ per-test through `context.newPage()` with
 * `timezoneId`. With `timezoneId: 'UTC'` the helper formats the input
 * 2026-05-15T09:00:00Z as 15/05/2026 a las 09:00.
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

test.describe('feature 10 — post-approve scheduled-slot indicator', () => {
  test('shows the scheduled banner when /approve returns scheduled_at', async ({ browser }) => {
    const context = await browser.newContext({
      timezoneId: 'UTC',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [SEED_REEL],
      approveScheduledAt: '2026-05-15T09:00:00Z',
    });

    const approveRequests = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/approve(\?|$)/.test(request.url())) {
        approveRequests.push(request.url());
      }
    });

    await page.goto(`/reels/${encodeURIComponent(SEED_REEL.site_id)}/${SEED_REEL.source_property_id}`);

    // Editor mounted with the seeded reel. Scope to the editor overlay so we
    // don't collide with the ReelCard Approve button rendered by Dashboard
    // behind the overlay.
    const editor = page.locator('.editor-overlay');
    await expect(editor).toBeVisible();
    const approveBtn = editor.getByRole('button', { name: /^Approve & Publish$/ });
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    await expect.poll(() => approveRequests.length).toBe(1);

    // Banner shows the formatted slot in Spanish, NOT the legacy copy.
    await expect(
      editor.getByText('Publicará el 15/05/2026 a las 09:00.'),
    ).toBeVisible();
    await expect(editor.getByText(/^Reel approved\.$/)).toHaveCount(0);

    await context.close();
  });

  test('hold 1h → mock backend computes scheduled_at ~1h in the future', async ({ browser }) => {
    // Front feature 16: hold_window_seconds is wired into /automation
    // and the mock backend mirrors compute_next_publish_slot. We pin the
    // clock so the mock + the formatScheduledAt helper agree on the
    // expected instant.
    const fixedNowIso = '2026-05-13T10:00:00Z';
    const expectedScheduledIso = '2026-05-13T11:00:00Z'; // +1h.
    const context = await browser.newContext({
      timezoneId: 'UTC',
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
          hold_window_seconds: 3600,
          quiet_hours_enabled: false,
          skip_weekends: false,
          publish_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        },
      },
    });

    const approveResponses = [];
    page.on('response', async (response) => {
      if (
        response.request().method() === 'POST'
        && /\/approve(\?|$)/.test(response.url())
      ) {
        try {
          approveResponses.push(await response.json());
        } catch {
          // ignore
        }
      }
    });

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

    // Banner shows the +1h slot formatted in UTC (11:00).
    await expect(editor.getByText('Publicará el 13/05/2026 a las 11:00.')).toBeVisible();

    await context.close();
  });

  test('falls back to "Reel approved." when scheduled_at is null', async ({ browser }) => {
    const context = await browser.newContext({
      timezoneId: 'UTC',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [SEED_REEL],
      approveScheduledAt: null,
    });

    const approveRequests = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/approve(\?|$)/.test(request.url())) {
        approveRequests.push(request.url());
      }
    });

    await page.goto(`/reels/${encodeURIComponent(SEED_REEL.site_id)}/${SEED_REEL.source_property_id}`);

    const editor = page.locator('.editor-overlay');
    await expect(editor).toBeVisible();
    const approveBtn = editor.getByRole('button', { name: /^Approve & Publish$/ });
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    await expect.poll(() => approveRequests.length).toBe(1);

    // Legacy copy preserved; no schedule banner anywhere.
    await expect(editor.getByText('Reel approved.')).toBeVisible();
    await expect(editor.getByText(/Publicará el/)).toHaveCount(0);

    await context.close();
  });
});
