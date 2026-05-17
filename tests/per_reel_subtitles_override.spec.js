import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 36 — per-reel subtitles override UI.
 *
 * Covers:
 *   (a) Edit cue text → debounce 1 s → ONE PATCH with the new text.
 *   (b) Edit in/out timing → ONE PATCH with the new times.
 *   (c) Add cue → PATCH includes the new cue.
 *   (d) Delete cue → PATCH excludes the deleted cue.
 *   (e) Validation: in >= out → inline error + no PATCH fired.
 *   (f) Validation: overlap with previous cue → inline error + no PATCH.
 *   (g) 409 path: opening an approved-state reel renders the locked banner
 *       and no PATCH fires on attempted edit.
 *   (h) PATCH fails with 500 → optimistic state rolls back + feedback shown.
 *   (i) Server-side 409 SUBTITLES_OVERRIDE_LOCKED → locked banner appears.
 */

const SITE_ID = 'ckp.ie';

const SEED_SUBTITLES = [
  { index: 0, text: 'Welcome to Cranford Court', in_seconds: 0, out_seconds: 4 },
  { index: 1, text: 'Stillorgan, Dublin 4', in_seconds: 4, out_seconds: 8 },
  { index: 2, text: 'Book a viewing', in_seconds: 8, out_seconds: 12 },
];

const EDITABLE_REEL = {
  site_id: SITE_ID,
  source_property_id: 42,
  slug: 'cranford-court',
  title: 'Cranford Court',
  featured_image_url: '/assets/property/primary.jpg',
  property_area_label: 'Stillorgan',
  property_county_label: 'Dublin',
  price: '€385,000',
  workflow_state: 'awaiting_review',
  publish_status: 'pending_review',
  render_status: 'done',
  pipeline_created_at: '2026-05-12T09:00:00Z',
  subtitles_override: SEED_SUBTITLES,
};

const APPROVED_REEL = {
  ...EDITABLE_REEL,
  source_property_id: 99,
  slug: 'cranford-locked',
  title: 'Cranford Locked',
  publish_status: 'published',
  workflow_state: 'approved',
};

function safeParse(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

async function openEditor(page, reel) {
  await page.goto(
    `/reels/${encodeURIComponent(reel.site_id)}/${reel.source_property_id}`,
  );
  await expect(page.locator('.editor-overlay')).toBeVisible();
  // The Subtitles tab is the initial tab (see ReelEditor's useState).
  // Click it anyway to be explicit and to stay robust against future changes.
  await page.getByRole('button', { name: /^Subtitles/ }).click();
  await expect(page.locator('[data-testid="subtitles-tab"]')).toBeVisible();
  await expect.poll(async () =>
    page.locator('[data-testid^="subtitle-row-"]').count(),
  ).toBe(reel.subtitles_override.length);
}

function instrumentPatchSubtitles(page) {
  const requests = [];
  page.on('request', (request) => {
    if (
      request.method() === 'PATCH' &&
      /\/reels\/[^/]+\/[^/]+\/subtitles(\?|$)/.test(request.url())
    ) {
      requests.push({
        url: request.url(),
        body: safeParse(request.postData()),
      });
    }
  });
  return requests;
}

test.describe('feature 36 — per-reel subtitles override UI', () => {
  test('edit cue text → ONE debounced PATCH with the new text', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSubtitles(page);
    await openEditor(page, EDITABLE_REEL);

    const textInput = page.locator('[data-testid="subtitle-text-0"]');
    await textInput.fill('Welcome to Cranford Court — UPDATED');

    await expect.poll(() => patches.length, { timeout: 5000 }).toBe(1);
    expect(patches[0].body).toEqual({
      cues: [
        {
          index: 0,
          text: 'Welcome to Cranford Court — UPDATED',
          in_seconds: 0,
          out_seconds: 4,
        },
        { index: 1, text: 'Stillorgan, Dublin 4', in_seconds: 4, out_seconds: 8 },
        { index: 2, text: 'Book a viewing', in_seconds: 8, out_seconds: 12 },
      ],
    });

    await expect(
      page.locator('[data-testid="subtitles-rerender-badge"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="subtitles-rerender-badge"]'),
    ).toBeHidden({ timeout: 5000 });
  });

  test('edit in/out timing → ONE PATCH with the new times', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSubtitles(page);
    await openEditor(page, EDITABLE_REEL);

    // Shift cue #2 (index 1): in=4 → in=5, out=8 → out=8 (still > in, no overlap).
    const inInput = page.locator('[data-testid="subtitle-in-1"]');
    await inInput.fill('5');

    await expect.poll(() => patches.length, { timeout: 5000 }).toBe(1);
    expect(patches[0].body.cues[1]).toEqual({
      index: 1,
      text: 'Stillorgan, Dublin 4',
      in_seconds: 5,
      out_seconds: 8,
    });
  });

  test('add cue → PATCH includes the new cue', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSubtitles(page);
    await openEditor(page, EDITABLE_REEL);

    await page.locator('[data-testid="subtitles-add"]').click();

    await expect.poll(() => patches.length, { timeout: 5000 }).toBe(1);
    expect(patches[0].body.cues).toHaveLength(4);
    expect(patches[0].body.cues[3]).toEqual({
      index: 3,
      text: 'New subtitle',
      in_seconds: 12,
      out_seconds: 14,
    });
  });

  test('delete cue → PATCH excludes the deleted cue', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSubtitles(page);
    await openEditor(page, EDITABLE_REEL);

    await page.locator('[data-testid="subtitle-delete-1"]').click();

    await expect.poll(() => patches.length, { timeout: 5000 }).toBe(1);
    expect(patches[0].body.cues).toHaveLength(2);
    expect(patches[0].body.cues.map((c) => c.text)).toEqual([
      'Welcome to Cranford Court',
      'Book a viewing',
    ]);
  });

  test('validation in >= out → inline error + no PATCH fired', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSubtitles(page);
    await openEditor(page, EDITABLE_REEL);

    // Make cue #1 end <= start: set out=0 while in=0 (in>=out invalid).
    const outInput = page.locator('[data-testid="subtitle-out-0"]');
    await outInput.fill('0');

    await expect(
      page.locator('[data-testid="subtitle-error-0"]'),
    ).toContainText(/End must be greater than start/i);

    await page.waitForTimeout(1500);
    expect(patches.length).toBe(0);
  });

  test('validation overlap → inline error on the offending row + no PATCH', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSubtitles(page);
    await openEditor(page, EDITABLE_REEL);

    // Cue 1 starts at 4, cue 0 ends at 4. Push cue 1 to start at 2 → overlap.
    await page.locator('[data-testid="subtitle-in-1"]').fill('2');

    await expect(
      page.locator('[data-testid="subtitle-error-1"]'),
    ).toContainText(/Overlaps/i);

    await page.waitForTimeout(1500);
    expect(patches.length).toBe(0);
  });

  test('approved reel: locked banner + no PATCH fires on attempted edits', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [APPROVED_REEL],
    });

    const patches = instrumentPatchSubtitles(page);
    await openEditor(page, APPROVED_REEL);

    await expect(
      page.locator('[data-testid="subtitles-locked-banner"]'),
    ).toContainText(/Cannot edit a reel that has already been approved/i);

    // The text input is `disabled`; force-click does nothing meaningful here,
    // but the bigger guarantee is that NO PATCH fires.
    const input = page.locator('[data-testid="subtitle-text-0"]');
    await expect(input).toBeDisabled();
    await page.waitForTimeout(1500);
    expect(patches.length).toBe(0);
  });

  test('PATCH fail (500) → rollback to pre-edit text + feedback shown', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    await page.route(
      /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/subtitles(\?|$)/,
      async (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'INTERNAL',
            message: 'Boom — simulated 500 from the worker.',
          }),
        });
      },
    );

    await openEditor(page, EDITABLE_REEL);

    const textInput = page.locator('[data-testid="subtitle-text-0"]');
    await expect(textInput).toHaveValue('Welcome to Cranford Court');

    await textInput.fill('Updated text that will fail');
    // Optimistic update: input reflects the new value immediately.
    await expect(textInput).toHaveValue('Updated text that will fail');

    // After the failed flush, the text rolls back to the original and the
    // feedback area shows the back's message.
    await expect(textInput).toHaveValue('Welcome to Cranford Court', {
      timeout: 5000,
    });
    await expect(
      page.locator('[data-testid="subtitles-feedback"]'),
    ).toContainText(/simulated 500/i);
  });

  test('server-side 409 SUBTITLES_OVERRIDE_LOCKED → locked banner', async ({
    page,
  }) => {
    const sneakyReel = {
      ...EDITABLE_REEL,
      workflow_state: 'awaiting_review',
      publish_status: 'pending_review',
    };
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [sneakyReel],
    });
    await page.route(
      /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/subtitles(\?|$)/,
      async (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'SUBTITLES_OVERRIDE_LOCKED',
            message: 'Cannot edit a reel that has already been approved',
          }),
        });
      },
    );

    await openEditor(page, sneakyReel);

    await page
      .locator('[data-testid="subtitle-text-0"]')
      .fill('This edit will be rejected');

    await expect(
      page.locator('[data-testid="subtitles-locked-banner"]'),
    ).toContainText(/Cannot edit a reel that has already been approved/i);
  });
});
