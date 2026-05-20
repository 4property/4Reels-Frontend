import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 32 — paginated, filtered reel list.
 *
 * Covers:
 *   (a) The Dashboard renders the new pagination + filter controls and the
 *       table without console errors (smoke for feature 32).
 *   (b) Navigating page 1 → 2 issues a fresh GET with `?page=2` and the
 *       results change.
 *   (c) The `workflow_state` dropdown filters server-side and resets to
 *       page 1.
 *   (d) The search input debounces 300ms (only ONE request per typed word)
 *       and the URL reflects the final value.
 *   (e) Reloading the page with `?page=2&q=cranford` reproduces the state
 *       (URL → fetch → matching results).
 */

function makeReels(count) {
  // Three "buckets" so workflow_state filtering has at least 2 hits to
  // distinguish from "everything". The first 7 belong to `needs_approval`,
  // the next 6 to `published`, the rest to `rejected`. The 4th item carries
  // 'Cranford' in the title so the search filter has a unique hit.
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const workflow =
      i < 7 ? 'needs_approval' : i < 13 ? 'published' : 'rejected';
    const publish =
      workflow === 'needs_approval'
        ? 'pending_review'
        : workflow === 'published'
          ? 'published'
          : 'rejected';
    items.push({
      site_id: 'ckp.ie',
      source_property_id: 1000 + i,
      slug: `property-${i}`,
      title: i === 3 ? 'Cranford Court' : `Property ${i + 1}`,
      featured_image_url: '/assets/property/primary.jpg',
      property_area_label: 'Stillorgan',
      property_county_label: 'Dublin',
      price: '€385,000',
      workflow_state: workflow,
      publish_status: publish,
      render_status: 'ready',
      pipeline_created_at: '2026-05-12T09:00:00Z',
    });
  }
  return items;
}

async function seedReels(page, items) {
  await seedAgencyLocalStorage(page);
  await installMockBackend(page, {
    agencies: [SAMPLE_AGENCY],
    ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    reels: items,
  });
}

test.describe('feature 32 — reels list pagination + filters', () => {
  test('renders pagination, filters and table without console errors', async ({ page }) => {
    const items = makeReels(30);
    await seedReels(page, items);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    await page.goto('/reels');

    await expect(page.getByRole('heading', { name: /Reels/ })).toBeVisible();
    // Pagination summary present and matches default page_size=10.
    await expect(
      page.getByTestId('reels-pagination-summary'),
    ).toHaveText(/Showing 1–10 of 30/);
    // Page-size selector exposes 10 / 25 / 50.
    const size = page.getByLabel('Rows per page');
    await expect(size).toHaveValue('10');
    await expect(size.locator('option')).toHaveCount(3);
    // Workflow + publish filter dropdowns present.
    await expect(page.getByLabel('Filter by workflow state')).toBeVisible();
    await expect(page.getByLabel('Filter by publish status')).toBeVisible();
    // Search input present.
    await expect(page.getByLabel('Search reels')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('navigates page 1 → 2 and updates the table', async ({ page }) => {
    const items = makeReels(30);
    await seedReels(page, items);

    const listRequests = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/\/v1\/admin\/agencies\/[^/]+\/reels(\?|$)/.test(url) && req.method() === 'GET') {
        listRequests.push(new URL(url));
      }
    });

    await page.goto('/reels');
    await expect(page.getByText('Property 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Property 11', { exact: true })).toHaveCount(0);

    await page.getByTestId('reels-pagination-next').click();

    await expect(page.getByTestId('reels-pagination-summary')).toHaveText(
      /Showing 11–20 of 30/,
    );
    await expect(page.getByText('Property 11', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/[?&]page=2(\b|&|$)/);

    // The page 2 request actually carried page=2 in the query.
    const lastUrl = listRequests[listRequests.length - 1];
    expect(lastUrl.searchParams.get('page')).toBe('2');
    expect(lastUrl.searchParams.get('page_size')).toBe('10');
  });

  test('workflow_state filter filters server-side and resets to page 1', async ({ page }) => {
    const items = makeReels(30);
    await seedReels(page, items);

    await page.goto('/reels?page=2');
    await expect(page.getByTestId('reels-pagination-summary')).toHaveText(
      /Showing 11–20 of 30/,
    );

    await page.getByLabel('Filter by workflow state').selectOption('needs_approval');

    // 7 items match → on default page size 10 we see them all on page 1.
    await expect(page.getByTestId('reels-pagination-summary')).toHaveText(
      /Showing 1–7 of 7/,
    );
    await expect(page).toHaveURL(/workflow_state=needs_approval/);
    await expect(page).not.toHaveURL(/[?&]page=2(\b|&|$)/);
  });

  test('search input is debounced and reflects in the URL', async ({ page }) => {
    const items = makeReels(30);
    await seedReels(page, items);

    const listRequests = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/\/v1\/admin\/agencies\/[^/]+\/reels(\?|$)/.test(url) && req.method() === 'GET') {
        listRequests.push(url);
      }
    });

    await page.goto('/reels');
    await page.waitForLoadState('networkidle');
    const requestsBefore = listRequests.length;

    const search = page.getByLabel('Search reels');
    await search.type('cra', { delay: 50 });
    // Wait long enough for the 300ms debounce to fire.
    await page.waitForTimeout(400);
    await search.type('nford', { delay: 50 });
    await page.waitForTimeout(500);

    // After the dust settles, the URL should carry q=cranford.
    await expect(page).toHaveURL(/q=cranford/);
    // The mock filtered down to the single Cranford entry.
    await expect(page.getByTestId('reels-pagination-summary')).toHaveText(
      /Showing 1–1 of 1/,
    );
    await expect(page.getByText('Cranford Court')).toBeVisible();

    // Debounce sanity: typing 8 chars in two bursts must not produce 8 fresh
    // list requests. We expect at most 3 (one per burst + maybe a trailing
    // re-render). The whole point of the debounce is < N keystrokes.
    const debounceRequests = listRequests.length - requestsBefore;
    expect(debounceRequests).toBeLessThanOrEqual(3);
  });

  test('reloading ?page=2&page_size=10&q=cranford reproduces the state', async ({ page }) => {
    // Seed enough Cranford-titled items so page=2 + page_size=10 makes sense.
    const items = makeReels(40).map((item, idx) => {
      if (idx % 3 === 0) return { ...item, title: `Cranford ${idx}` };
      return item;
    });
    await seedReels(page, items);

    await page.goto('/reels?page=2&page_size=10&q=cranford');
    // 14 Cranford titles → page 2 of 10 shows the last 4.
    await expect(page.getByTestId('reels-pagination-summary')).toHaveText(
      /Showing 11–14 of 14/,
    );
    // The dropdowns reflect the URL state.
    await expect(page.getByLabel('Rows per page')).toHaveValue('10');
    await expect(page.getByLabel('Search reels')).toHaveValue('cranford');
  });

  test('empty state appears when count_total is 0 (distinct from loading)', async ({ page }) => {
    await seedReels(page, makeReels(5));

    await page.goto('/reels?q=nope-no-match');
    await expect(page.getByTestId('reels-empty')).toBeVisible();
    await expect(page.getByTestId('reels-empty')).toContainText(
      /No reels match the current filters/,
    );
    // The skeleton must have been replaced — not co-rendered with the empty.
    await expect(page.getByTestId('reels-skeleton')).toHaveCount(0);
  });
});
