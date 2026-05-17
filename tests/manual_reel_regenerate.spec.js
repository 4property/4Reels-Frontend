import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 40 — manual reel regenerate button.
 *
 * Covers:
 *   (a) Happy path: completed reel → open editor → click `Render again` →
 *       confirm modal → click confirm → mock receives POST /regenerate, the
 *       `<RerenderBadge />` appears, and after the mock flips status it
 *       disappears.
 *   (b) Published reel: button is visible but disabled with the tooltip;
 *       clicking does not fire a POST.
 *   (c) In-flight reel (`_rerendering=true` seeded): click → confirm → toast
 *       surfaces the "already in progress" copy from the back's 409.
 *   (d) Cancel modal: open modal → click Cancel → no POST is sent.
 */

const SITE_ID = 'ckp.ie';

const COMPLETED_REEL = {
  site_id: SITE_ID,
  source_property_id: 142,
  slug: 'cranford-court',
  title: 'Cranford Court',
  featured_image_url: '/assets/property/primary.jpg',
  property_area_label: 'Stillorgan',
  property_county_label: 'Dublin',
  price: '€385,000',
  workflow_state: 'awaiting_review',
  publish_status: 'pending_review',
  render_status: 'completed',
  pipeline_created_at: '2026-05-12T09:00:00Z',
};

const PUBLISHED_REEL = {
  ...COMPLETED_REEL,
  source_property_id: 143,
  slug: 'cranford-published',
  title: 'Cranford Published',
  workflow_state: 'approved',
  publish_status: 'published',
  render_status: 'completed',
};

const IN_FLIGHT_REEL = {
  ...COMPLETED_REEL,
  source_property_id: 144,
  slug: 'cranford-in-flight',
  title: 'Cranford In Flight',
  render_status: 'completed',
  // The mock backend's /regenerate handler short-circuits with 409 when this
  // flag is true (the realistic case: a render is already queued for this
  // reel and the back refuses to enqueue a second one).
  _rerendering: true,
};

function safeParse(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

function instrumentRegenerate(page) {
  const requests = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /\/reels\/[^/]+\/[^/]+\/regenerate(\?|$)/.test(request.url())
    ) {
      requests.push({
        url: request.url(),
        body: safeParse(request.postData()),
      });
    }
  });
  return requests;
}

async function openEditor(page, reel) {
  await page.goto(
    `/reels/${encodeURIComponent(reel.site_id)}/${reel.source_property_id}`,
  );
  await expect(page.locator('.editor-overlay')).toBeVisible();
}

test.describe('feature 40 — manual reel regenerate button', () => {
  test('happy path: confirm modal → POST → badge appears, then clears', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [COMPLETED_REEL],
    });

    const requests = instrumentRegenerate(page);
    await openEditor(page, COMPLETED_REEL);

    const button = page.locator('[data-testid="regenerate-reel-button"]');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();

    const modal = page.locator('[data-testid="regenerate-confirm-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(
      /This will re-render the reel using the current photos, subtitles and slides settings\. Continue\?/,
    );

    await page.locator('[data-testid="regenerate-confirm"]').click();

    await expect.poll(() => requests.length, { timeout: 4000 }).toBe(1);
    expect(requests[0].body).toEqual({});

    await expect(
      page.locator('[data-testid="regenerate-rerender-badge"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="regenerate-rerender-badge"]'),
    ).toBeHidden({ timeout: 5000 });
  });

  test('published reel: button disabled with tooltip + no POST fires on click', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [PUBLISHED_REEL],
    });

    const requests = instrumentRegenerate(page);
    await openEditor(page, PUBLISHED_REEL);

    const button = page.locator('[data-testid="regenerate-reel-button"]');
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute(
      'title',
      /Re-rendering is disabled for published reels/,
    );

    // Force-click confirms the button is truly inert (a disabled button
    // shouldn't dispatch any handlers; the test guards against a regression
    // where someone wires the click through anyway).
    await button.click({ force: true });
    await page.waitForTimeout(500);
    expect(requests.length).toBe(0);
  });

  test('in-flight reel: confirm → 409 ALREADY_IN_FLIGHT → toast surfaces', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [IN_FLIGHT_REEL],
    });

    const requests = instrumentRegenerate(page);
    await openEditor(page, IN_FLIGHT_REEL);

    await page.locator('[data-testid="regenerate-reel-button"]').click();
    await expect(
      page.locator('[data-testid="regenerate-confirm-modal"]'),
    ).toBeVisible();
    await page.locator('[data-testid="regenerate-confirm"]').click();

    await expect.poll(() => requests.length, { timeout: 4000 }).toBe(1);

    await expect(page.locator('[data-testid="toast-error"]')).toContainText(
      /A render is already in progress for this reel/,
    );
  });

  test('cancel modal: click cancel → no POST is sent', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [COMPLETED_REEL],
    });

    const requests = instrumentRegenerate(page);
    await openEditor(page, COMPLETED_REEL);

    await page.locator('[data-testid="regenerate-reel-button"]').click();
    const modal = page.locator('[data-testid="regenerate-confirm-modal"]');
    await expect(modal).toBeVisible();

    await page.locator('[data-testid="regenerate-cancel"]').click();
    await expect(modal).toBeHidden();

    await page.waitForTimeout(500);
    expect(requests.length).toBe(0);
  });
});
