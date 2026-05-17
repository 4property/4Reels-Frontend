import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 39 — live state sync (Dashboard refetch on editor close)
 * + global toast feedback for Dashboard approve / reject.
 *
 * Covers:
 *   (1) Open the Dashboard with reels [A, B, C]. Open the editor for B,
 *       trigger a music override PATCH, close the editor. The Dashboard
 *       reorders to [B, A, C] WITHOUT a manual reload — the editor's
 *       close-time refetch fires and consumes a list response we stub
 *       (the back already serves by `updated_at DESC`).
 *   (2) Approve from the Dashboard → toast `role="status"` "Reel approved".
 *   (3) Approve fails 500 → toast `role="alert"` with the error message.
 */

const SITE_ID = 'ckp.ie';

function reel(id, title, opts = {}) {
  return {
    site_id: SITE_ID,
    source_property_id: id,
    slug: `reel-${id}`,
    title,
    featured_image_url: '/assets/property/primary.jpg',
    property_area_label: 'Stillorgan',
    property_county_label: 'Dublin',
    price: '€385,000',
    workflow_state: opts.workflowState || 'awaiting_review',
    publish_status: opts.publishStatus || 'pending_review',
    render_status: 'ready',
    pipeline_created_at: '2026-05-12T09:00:00Z',
    music_track_id: null,
    music: null,
    ...opts.extra,
  };
}

const TRACKS = [
  {
    music_id: 'mock-music-alpha',
    agency_id: SAMPLE_AGENCY_ID,
    display_name: 'Alpha Theme',
    object_key: 'agencies/ckp/music/alpha.mp3',
    duration_seconds: 30,
    is_default: true,
    created_at: '2026-05-06T09:00:00Z',
  },
];

test.describe('feature 39 — Dashboard live sync + global toasts', () => {
  test('editor close after a mutation refetches Dashboard → modified reel rises to top', async ({
    page,
  }) => {
    const A = reel(101, 'Alpha House');
    const B = reel(202, 'Bravo Bungalow');
    const C = reel(303, 'Charlie Cottage');

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [A, B, C],
      musicTracks: TRACKS,
    });

    // Track each list fetch so we can serve a re-ordered slice after the
    // mutation lands. Playwright route handlers added AFTER
    // installMockBackend take precedence (LIFO).
    let listFetches = 0;
    let bWasMutated = false;
    await page.route(
      /\/v1\/admin\/agencies\/[^/]+\/reels(\?|$)/,
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        listFetches += 1;
        const items = bWasMutated ? [B, A, C] : [A, B, C];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items,
            count_total: items.length,
            page: 1,
            page_size: 25,
            has_more: false,
            count: items.length,
          }),
        });
      },
    );

    // Watch for the PATCH music to know when to flip the re-ordering flag.
    page.on('response', async (response) => {
      const request = response.request();
      if (
        request.method() === 'PATCH' &&
        /\/reels\/[^/]+\/[^/]+\/music(\?|$)/.test(response.url()) &&
        response.status() === 200
      ) {
        bWasMutated = true;
      }
    });

    await page.goto('/reels');

    // Initial order: A first, B second.
    const cards = page.locator('.reel-card .reel-card-title');
    await expect(cards.first()).toContainText('Alpha House');
    await expect(cards.nth(1)).toContainText('Bravo Bungalow');
    const initialListFetches = listFetches;
    expect(initialListFetches).toBeGreaterThanOrEqual(1);

    // Open the editor for reel B by navigating directly (the cover click
    // navigates the same way; using the URL keeps the test stable across
    // viewport projects where the grid layout shifts the click target).
    await page.goto(`/reels/${encodeURIComponent(SITE_ID)}/${B.source_property_id}`);
    await expect(page.locator('.editor-overlay')).toBeVisible();
    const select = page.locator('[data-testid="music-override-select"]');
    await expect(select).toBeEnabled();
    await expect.poll(async () => await select.locator('option').count()).toBe(2);

    // Trigger the music override PATCH.
    await select.selectOption('mock-music-alpha');
    await expect(
      page.locator('[data-testid="music-override-feedback"]'),
    ).toContainText(/Re-rendering with new track/i);
    await expect.poll(() => bWasMutated).toBe(true);

    // Toast confirmation for the mutation.
    const successToast = page.locator('[data-testid="toast-success"]').first();
    await expect(successToast).toContainText(/Music override saved/i);

    // Close the editor (Back to reels button). The close handler triggers
    // the Dashboard's refetch because the editor session was mutated.
    const backButton = page.locator('.editor-header').getByRole('button', { name: /Back to reels/ });
    await backButton.click();
    await expect(page.locator('.editor-overlay')).toHaveCount(0);

    // The Dashboard refetched. The new list serves [B, A, C].
    await expect.poll(() => listFetches).toBeGreaterThan(initialListFetches);
    await expect(cards.first()).toContainText('Bravo Bungalow');
    await expect(cards.nth(1)).toContainText('Alpha House');
  });

  test('Approve from Dashboard fires a success toast (role="status")', async ({
    page,
  }) => {
    // Reel needs `publish_status === 'needs-approval'` for the inline buttons.
    const needsApproval = reel(401, 'Awaiting Approval', {
      publishStatus: 'needs-approval',
      workflowState: 'needs_approval',
    });

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [needsApproval],
    });

    await page.goto('/reels');
    await expect(page.getByText('Awaiting Approval')).toBeVisible();

    const approveBtn = page
      .locator(`[data-testid="reel-approve-${SITE_ID}:${needsApproval.source_property_id}"]`)
      .first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Toast appears with role="status" (success/info) and contains the
    // confirmation copy referencing the reel title.
    const toast = page.locator('[role="status"][data-testid="toast-success"]').first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Reel approved/i);
    await expect(toast).toContainText(/Awaiting Approval/);
  });

  test('Approve failure surfaces an error toast (role="alert")', async ({
    page,
  }) => {
    const needsApproval = reel(501, 'Will Fail', {
      publishStatus: 'needs-approval',
      workflowState: 'needs_approval',
    });

    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      reels: [needsApproval],
    });

    // Override the approve endpoint to return 500.
    await page.route(
      /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/approve(\?|$)/,
      async (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'INTERNAL_ERROR',
            message: 'Boom — simulated 500 from the worker.',
          }),
        });
      },
    );

    await page.goto('/reels');
    await expect(page.getByText('Will Fail')).toBeVisible();

    const approveBtn = page
      .locator(`[data-testid="reel-approve-${SITE_ID}:${needsApproval.source_property_id}"]`)
      .first();
    await approveBtn.click();

    const errToast = page.locator('[role="alert"][data-testid="toast-error"]').first();
    await expect(errToast).toBeVisible();
    await expect(errToast).toContainText(/INTERNAL_ERROR|simulated 500|Failed to approve/i);
  });
});
