import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 25 — per-reel music-track override UI.
 *
 * Covers:
 *   (a) Editable reel + agency with 2 tracks → dropdown lists "Agency default
 *       pool" + both tracks; selecting a track PATCHes `{music_id: <id>}`,
 *       feedback "Re-rendering with new track…" appears.
 *   (b) Reverting to "Agency default pool" PATCHes `{music_id: null}`,
 *       feedback shows the cleared state.
 *   (c) Reel in non-editable publish_status → dropdown disabled + readonly
 *       banner.
 */

const TWO_TRACKS = [
  {
    music_id: 'mock-music-alpha',
    agency_id: SAMPLE_AGENCY_ID,
    display_name: 'Alpha Theme',
    object_key: 'agencies/ckp/music/alpha.mp3',
    duration_seconds: 30,
    is_default: true,
    created_at: '2026-05-06T09:00:00Z',
  },
  {
    music_id: 'mock-music-beta',
    agency_id: SAMPLE_AGENCY_ID,
    display_name: 'Beta Vibes',
    object_key: 'agencies/ckp/music/beta.mp3',
    duration_seconds: 28,
    is_default: false,
    created_at: '2026-05-06T09:00:00Z',
  },
];

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
  music_track_id: null,
  music: null,
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
  await expect(
    page.locator('[data-testid="music-override-panel"]'),
  ).toBeVisible();
}

test.describe('feature 25 — per-reel music-track override UI', () => {
  test('editable reel: dropdown lists default + tracks → select PATCHes music_id', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [EDITABLE_REEL],
      musicTracks: TWO_TRACKS,
    });

    const patchRequests = [];
    const patchResponses = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        /\/reels\/[^/]+\/[^/]+\/music(\?|$)/.test(request.url())
      ) {
        patchRequests.push({
          url: request.url(),
          body: safeParse(request.postData()),
        });
      }
    });
    page.on('response', async (response) => {
      const request = response.request();
      if (
        request.method() === 'PATCH' &&
        /\/reels\/[^/]+\/[^/]+\/music(\?|$)/.test(response.url())
      ) {
        try {
          patchResponses.push({
            status: response.status(),
            body: await response.json(),
          });
        } catch {
          patchResponses.push({ status: response.status(), body: null });
        }
      }
    });

    await openEditor(page, EDITABLE_REEL);

    const select = page.locator('[data-testid="music-override-select"]');
    await expect(select).toBeEnabled();
    // Wait for tracks to hydrate so the option list isn't just the default.
    await expect.poll(async () => await select.locator('option').count()).toBe(3);

    const optionTexts = await select.locator('option').allTextContents();
    expect(optionTexts).toEqual([
      'Agency default pool',
      'Alpha Theme',
      'Beta Vibes',
    ]);

    // Initially the override is empty → the default pool option is selected.
    await expect(select).toHaveValue('');

    // Pick the first real track.
    await select.selectOption('mock-music-alpha');

    await expect.poll(() => patchRequests.length).toBe(1);
    const sent = patchRequests[0];
    expect(sent.url).toContain(
      `/v1/admin/agencies/${SAMPLE_AGENCY_ID}/reels/${encodeURIComponent(
        EDITABLE_REEL.site_id,
      )}/${EDITABLE_REEL.source_property_id}/music`,
    );
    expect(sent.body).toEqual({ music_id: 'mock-music-alpha' });

    await expect.poll(() => patchResponses.length).toBe(1);
    expect(patchResponses[0].status).toBe(200);
    expect(patchResponses[0].body).toMatchObject({
      status: 'saved',
      music_id: 'mock-music-alpha',
    });
    expect(typeof patchResponses[0].body.reel_id).toBe('string');

    await expect(
      page.locator('[data-testid="music-override-feedback"]'),
    ).toContainText(/Re-rendering with new track/i);

    // After the refetch the select stays on the chosen track (mock persisted).
    await expect(select).toHaveValue('mock-music-alpha');
  });

  test('clearing the override PATCHes music_id=null', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [
        {
          ...EDITABLE_REEL,
          // Pre-seeded override so the dropdown starts on Beta.
          music_track_id: 'mock-music-beta',
          music: { music_id: 'mock-music-beta', display_name: 'Beta Vibes' },
        },
      ],
      musicTracks: TWO_TRACKS,
    });

    const patchRequests = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        /\/reels\/[^/]+\/[^/]+\/music(\?|$)/.test(request.url())
      ) {
        patchRequests.push(safeParse(request.postData()));
      }
    });

    await openEditor(page, EDITABLE_REEL);

    const select = page.locator('[data-testid="music-override-select"]');
    await expect.poll(async () => await select.locator('option').count()).toBe(3);
    await expect(select).toHaveValue('mock-music-beta');

    // Switch back to the empty option ("Agency default pool").
    await select.selectOption('');

    await expect.poll(() => patchRequests.length).toBe(1);
    expect(patchRequests[0]).toEqual({ music_id: null });

    await expect(
      page.locator('[data-testid="music-override-feedback"]'),
    ).toContainText(/agency default pool/i);

    // The mock persisted the null override, so the select reflects it.
    await expect(select).toHaveValue('');
  });

  test('approved reel: dropdown disabled + readonly banner', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [APPROVED_REEL],
      musicTracks: TWO_TRACKS,
    });

    await openEditor(page, APPROVED_REEL);

    await expect(
      page.locator('[data-testid="music-override-select"]'),
    ).toBeDisabled();
    await expect(
      page.locator('[data-testid="music-override-readonly"]'),
    ).toBeVisible();
  });
});
