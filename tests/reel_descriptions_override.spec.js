import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 21 — per-reel description override UI.
 *
 * Covers:
 *   (a) Editable reel + edit instagram caption + Save → PATCH body shape and 200.
 *   (b) After Save the next GET reflects the new override (mock persists state).
 *   (c) Reel in non-editable publish_status → textareas readOnly + banner.
 *   (d) Reset clears the override (PATCH with empty map).
 */

const EDITABLE_REEL = {
  site_id: 'ckp.ie',
  source_property_id: 42,
  slug: 'cranford-court',
  title: 'Cranford Court',
  featured_image_url: '/assets/property/primary.jpg',
  property_area_label: 'Stillorgan',
  property_county_label: 'Dublin',
  price: '€385,000',
  workflow_state: 'awaiting_review',
  publish_status: 'pending_review',
  render_status: 'ready',
  pipeline_created_at: '2026-05-12T09:00:00Z',
  descriptions_override: null,
  publish_target_snapshot: {
    descriptions_by_platform: {
      instagram: 'IG · template fallback for Cranford',
      facebook: 'FB · template fallback for Cranford',
    },
  },
};

const APPROVED_REEL = {
  ...EDITABLE_REEL,
  source_property_id: 99,
  slug: 'cranford-locked',
  title: 'Cranford Locked',
  publish_status: 'published',
  workflow_state: 'published',
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
  await page.getByRole('button', { name: /^Descriptions/ }).click();
  await expect(
    page.locator('[data-testid="desc-textarea-instagram"]'),
  ).toBeVisible();
}

test.describe('feature 21 — per-reel description override UI', () => {
  test('edit instagram caption → Save → PATCH body matches contract', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
    });

    const patchRequests = [];
    const patchResponses = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        /\/descriptions(\?|$)/.test(request.url())
      ) {
        patchRequests.push({
          url: request.url(),
          body: safeParse(request.postData()),
        });
      }
    });
    page.on('response', async (response) => {
      const request = response.request();
      if (request.method() === 'PATCH' && /\/descriptions(\?|$)/.test(response.url())) {
        try {
          patchResponses.push({ status: response.status(), body: await response.json() });
        } catch {
          patchResponses.push({ status: response.status(), body: null });
        }
      }
    });

    await openEditor(page, EDITABLE_REEL);

    // Hydration: instagram textarea pre-filled from the snapshot.
    await expect(
      page.locator('[data-testid="desc-textarea-instagram"]'),
    ).toHaveValue('IG · template fallback for Cranford');

    // Save buttons disabled while the textarea matches the baseline.
    await expect(
      page.locator('[data-testid="desc-save-instagram"]'),
    ).toBeDisabled();

    const newCaption = 'IG · OVERRIDDEN by the human · v1';
    await page
      .locator('[data-testid="desc-textarea-instagram"]')
      .fill(newCaption);

    await expect(
      page.locator('[data-testid="desc-save-instagram"]'),
    ).toBeEnabled();
    await page.locator('[data-testid="desc-save-instagram"]').click();

    await expect.poll(() => patchRequests.length).toBe(1);
    const sent = patchRequests[0];
    expect(sent.url).toContain(
      `/v1/admin/agencies/${SAMPLE_AGENCY_ID}/reels/${encodeURIComponent(
        EDITABLE_REEL.site_id,
      )}/${EDITABLE_REEL.source_property_id}/descriptions`,
    );
    expect(sent.body).toEqual({
      descriptions_by_platform: { instagram: newCaption },
    });
    // The response listener parses JSON asynchronously, so poll until it
    // lands instead of racing against the patchRequests counter.
    await expect.poll(() => patchResponses.length).toBe(1);
    expect(patchResponses[0].status).toBe(200);
    expect(patchResponses[0].body.status).toBe('saved');
    expect(patchResponses[0].body.descriptions_override).toEqual({
      instagram: newCaption,
    });

    // Success banner.
    await expect(page.locator('[data-testid="desc-feedback"]')).toContainText(
      /Saved description for instagram/i,
    );

    // After refetch the override flag is visible for instagram.
    await expect(
      page.locator('[data-testid="desc-override-flag-instagram"]'),
    ).toBeVisible();
  });

  test('approved reel: textareas read-only + banner visible', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [APPROVED_REEL],
    });

    await openEditor(page, APPROVED_REEL);

    await expect(
      page.locator('[data-testid="desc-readonly-banner"]'),
    ).toBeVisible();
    const textarea = page.locator(
      '[data-testid="desc-textarea-instagram"]',
    );
    await expect(textarea).toHaveAttribute('readonly', '');
    await expect(
      page.locator('[data-testid="desc-save-instagram"]'),
    ).toBeDisabled();
  });

  test('reset clears the override (PATCH with empty map)', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [
        {
          ...EDITABLE_REEL,
          descriptions_override: {
            instagram: 'IG · STORED override before reset',
          },
        },
      ],
    });

    const patchRequests = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        /\/descriptions(\?|$)/.test(request.url())
      ) {
        patchRequests.push(safeParse(request.postData()));
      }
    });

    await openEditor(page, EDITABLE_REEL);

    // Override is hydrated from `descriptions_override`, not the snapshot.
    await expect(
      page.locator('[data-testid="desc-textarea-instagram"]'),
    ).toHaveValue('IG · STORED override before reset');

    await page.getByRole('button', { name: /Reset to template/ }).click();

    await expect.poll(() => patchRequests.length).toBe(1);
    expect(patchRequests[0]).toEqual({ descriptions_by_platform: {} });

    // After reset + refetch the snapshot value re-hydrates.
    await expect(
      page.locator('[data-testid="desc-textarea-instagram"]'),
    ).toHaveValue('IG · template fallback for Cranford');
    await expect(
      page.locator('[data-testid="desc-override-flag-instagram"]'),
    ).toHaveCount(0);
  });

  test('PATCH with disallowed platform → 422 PLATFORM_NOT_ENABLED banner', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
      // Whitelist excludes facebook → the PATCH must 422 when fb is edited.
      enabledPlatformsByAgency: {
        [SAMPLE_AGENCY_ID]: ['instagram', 'tiktok', 'linkedin'],
      },
    });

    await openEditor(page, EDITABLE_REEL);

    await page
      .locator('[data-testid="desc-textarea-facebook"]')
      .fill('FB · should fail');
    await page.locator('[data-testid="desc-save-facebook"]').click();

    const feedback = page.locator('[data-testid="desc-feedback"]');
    await expect(feedback).toContainText(/facebook/i);
    await expect(feedback).toContainText(/not enabled/i);
  });
});
