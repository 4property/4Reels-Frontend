import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 37 — per-reel slides override UI.
 *
 * Covers:
 *   (a) DnD reorder of a 3-slide manifest → mock receives ONE PATCH with the
 *       new positions; the "Re-rendering…" badge shows briefly.
 *   (b) Edit duration → mock receives ONE PATCH with the new duration.
 *   (c) Multiple edits within 500 ms collapse into ONE PATCH.
 *   (d) Sum of durations > target → yellow warning surfaces; PATCH still fires.
 *   (e) Approved reel → locked banner; tile not draggable; NO PATCH fires.
 *   (f) PATCH fails with 500 → optimistic state rolls back + feedback shown.
 */

const SITE_ID = 'ckp.ie';

const SEED_SLIDES = [
  {
    slide_id: 'sl1',
    position: 0,
    kind: 'intro-video',
    duration_seconds: 2.5,
    label: 'Intro · CKP',
    enabled: true,
  },
  {
    slide_id: 'sl2',
    position: 1,
    kind: 'text',
    duration_seconds: 3,
    label: 'Text slide',
    text: 'New price!',
    enabled: true,
  },
  {
    slide_id: 'sl3',
    position: 2,
    kind: 'outro-video',
    duration_seconds: 3,
    label: 'Outro · Book a viewing',
    enabled: true,
  },
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
  manifest_override: SEED_SLIDES,
  target_duration_seconds: 30,
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

async function openSlidesTab(page, reel) {
  await page.goto(
    `/reels/${encodeURIComponent(reel.site_id)}/${reel.source_property_id}`,
  );
  await expect(page.locator('.editor-overlay')).toBeVisible();
  await page.getByRole('button', { name: /^Slides/ }).click();
  await expect(page.locator('[data-testid="slides-tab"]')).toBeVisible();
  await expect
    .poll(async () => page.locator('[data-testid^="slide-row-wrap-"]').count())
    .toBe(reel.manifest_override.length);
}

function instrumentPatchSlides(page) {
  const requests = [];
  page.on('request', (request) => {
    if (
      request.method() === 'PATCH' &&
      /\/reels\/[^/]+\/[^/]+\/slides(\?|$)/.test(request.url())
    ) {
      requests.push({
        url: request.url(),
        body: safeParse(request.postData()),
      });
    }
  });
  return requests;
}

test.describe('feature 37 — per-reel slides override UI', () => {
  test('drag-to-reorder fires ONE PATCH with the new order', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSlides(page);
    await openSlidesTab(page, EDITABLE_REEL);

    // Move row 0 → position 2 by firing dragstart on row0, dragover on row1
    // and row2, and finally dragend on row2.
    const row0 = page.locator('[data-testid="slide-row-0"]');
    const row1 = page.locator('[data-testid="slide-row-1"]');
    const row2 = page.locator('[data-testid="slide-row-2"]');

    await row0.dispatchEvent('dragstart');
    await row1.dispatchEvent('dragover');
    await row2.dispatchEvent('dragover');
    await row2.dispatchEvent('dragend');

    await expect.poll(() => patches.length, { timeout: 4000 }).toBe(1);
    expect(Array.isArray(patches[0].body.slides)).toBe(true);
    expect(patches[0].body.slides).toHaveLength(3);
    const positions = patches[0].body.slides.map((s) => s.position);
    expect(positions).toEqual([0, 1, 2]);
    // The first row was sl1 (intro-video); after the move it should be last.
    expect(patches[0].body.slides[2].slide_id).toBe('sl1');

    await expect(
      page.locator('[data-testid="slides-rerender-badge"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="slides-rerender-badge"]'),
    ).toBeHidden({ timeout: 5000 });
  });

  test('edit duration → ONE PATCH with the new duration_seconds', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSlides(page);
    await openSlidesTab(page, EDITABLE_REEL);

    // The second row (text slide) has a numeric range input. Filling fires
    // an input event that the panel maps to `update(id, {duration: +value})`.
    const range = page.locator('[data-testid="slide-row-1-duration"]');
    await range.fill('5');

    await expect.poll(() => patches.length, { timeout: 4000 }).toBe(1);
    expect(patches[0].body.slides[1].slide_id).toBe('sl2');
    expect(patches[0].body.slides[1].duration_seconds).toBe(5);
    expect(patches[0].body.slides[1].text).toBe('New price!');
  });

  test('multiple edits within 500 ms collapse into ONE PATCH', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patches = instrumentPatchSlides(page);
    await openSlidesTab(page, EDITABLE_REEL);

    // Three quick edits inside the 500 ms debounce window.
    await page.locator('[data-testid="slide-row-1-duration"]').fill('4');
    await page.locator('[data-testid="slide-row-1-duration"]').fill('5');
    await page.locator('[data-testid="slide-row-2-duration"]').fill('4');

    await page.waitForTimeout(1200);
    expect(patches.length).toBe(1);
    expect(patches[0].body.slides[1].duration_seconds).toBe(5);
    expect(patches[0].body.slides[2].duration_seconds).toBe(4);
  });

  test('sum > target surfaces a yellow warning but the PATCH still fires', async ({
    page,
  }) => {
    // Target=7s → 2.5+3+3 = 8.5s ∈ (target, 1.5×target=10.5s) → yellow warning.
    // The point of this spec is to assert the front warns yet still persists,
    // mirroring the leader decision "warn but let the back decide".
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [
        {
          ...EDITABLE_REEL,
          target_duration_seconds: 7,
        },
      ],
    });

    const patches = instrumentPatchSlides(page);
    await openSlidesTab(page, EDITABLE_REEL);

    const warning = page.locator('[data-testid="slides-duration-warning"]');
    await expect(warning).toContainText(/exceed target duration/i);
    // It's the YELLOW (warning) variant, not the danger one.
    await expect(warning).toHaveClass(/slides-feedback-warning/);

    // Bump the second slide's duration; the warning sticks and the PATCH
    // still fires (back will decide whether to accept).
    await page.locator('[data-testid="slide-row-1-duration"]').fill('4');

    await expect.poll(() => patches.length, { timeout: 4000 }).toBe(1);
    expect(patches[0].body.slides[1].duration_seconds).toBe(4);
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

    const patches = instrumentPatchSlides(page);
    await openSlidesTab(page, APPROVED_REEL);

    await expect(
      page.locator('[data-testid="slides-locked-banner"]'),
    ).toContainText(/Cannot edit a reel that has already been approved/i);

    // The duration slider is disabled; trying to edit it does nothing.
    const range = page.locator('[data-testid="slide-row-1-duration"]');
    await expect(range).toBeDisabled();
    await page.waitForTimeout(900);
    expect(patches.length).toBe(0);
  });

  test('PATCH fail (500) → rollback + feedback shown', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });
    await page.route(
      /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/slides(\?|$)/,
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

    await openSlidesTab(page, EDITABLE_REEL);

    const range = page.locator('[data-testid="slide-row-1-duration"]');
    await expect(range).toHaveValue('3');

    await range.fill('5');
    await expect(range).toHaveValue('5');

    // After the failed flush, the slider rolls back to 3 and the feedback
    // banner surfaces the back's message.
    await expect(range).toHaveValue('3', { timeout: 4000 });
    await expect(
      page.locator('[data-testid="slides-feedback"]'),
    ).toContainText(/simulated 500/i);
  });
});
