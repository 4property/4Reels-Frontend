import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from '../support/mock-backend.js';

/**
 * Feature 24 (agency_music_selection_rules) — smoke for the
 * "Fall back to full library if no default track exists" toggle.
 *
 * Contract (mirror of back feature 24):
 *   - GET /v1/admin/agencies/{id}/defaults surfaces
 *     `settings.music.selection_rules.fallback_to_full_library: true`
 *     by default (the back fills it in if absent on the row).
 *   - PUT /v1/admin/agencies/{id}/defaults accepts the same path under
 *     `settings`. Unknown keys under `settings.music.*` or under
 *     `settings.music.selection_rules.*` produce 422 extra_forbidden.
 *
 * The mock-backend in `tests/support/mock-backend.js` mirrors both
 * behaviours, so this spec only needs to drive the UI and watch the
 * network.
 */

const DEFAULTS_PATH = `/v1/admin/agencies/${SAMPLE_AGENCY_ID}/defaults`;

test.describe('feature 24 — agency music selection rules', () => {
  test('toggle off, on, and reload preserves the persisted value', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const defaultsPutBodies = [];
    const defaultsPutStatuses = [];
    page.on('request', (request) => {
      if (request.method() !== 'PUT') return;
      if (!request.url().endsWith(DEFAULTS_PATH)) return;
      defaultsPutBodies.push(safeParse(request.postData()));
    });
    page.on('response', (response) => {
      if (response.request().method() !== 'PUT') return;
      if (!response.url().endsWith(DEFAULTS_PATH)) return;
      defaultsPutStatuses.push(response.status());
    });

    await page.goto('/music');
    await expect(page.getByRole('heading', { name: /Music/ })).toBeVisible();

    // Switch to the "Selection rules" subtab.
    await page.getByRole('button', { name: /Selection rules/ }).click();

    // The toggle is the only one on this card. The back surfaces the
    // default `true` on GET so it starts in the `on` state without any
    // PUT being emitted.
    const fallbackCard = page.locator('[data-testid="music-rules-fallback-card"]');
    await expect(fallbackCard).toBeVisible();
    const toggle = fallbackCard.locator('button.toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(
      defaultsPutBodies.length,
      'no PUT /defaults emitted on initial render',
    ).toBe(0);

    // --- Toggle OFF ---
    await toggle.click();
    await expect.poll(() => defaultsPutBodies.length).toBeGreaterThan(0);
    await page.waitForLoadState('networkidle');

    const firstBody = defaultsPutBodies[0];
    expect(firstBody?.settings?.music?.selection_rules?.fallback_to_full_library).toBe(
      false,
    );
    expect(defaultsPutStatuses, 'PUT accepted by the mock back').toContain(200);
    expect(defaultsPutStatuses).not.toContain(422);

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // --- Reload: the persisted `false` is read back from the mock store ---
    await page.reload();
    await page.getByRole('button', { name: /Selection rules/ }).click();
    const toggleAfterReload = page
      .locator('[data-testid="music-rules-fallback-card"]')
      .locator('button.toggle');
    await expect(toggleAfterReload).toHaveAttribute('aria-pressed', 'false');

    // --- Toggle back ON ---
    const beforeSecond = defaultsPutBodies.length;
    await toggleAfterReload.click();
    await expect.poll(() => defaultsPutBodies.length).toBeGreaterThan(beforeSecond);
    await page.waitForLoadState('networkidle');

    const secondBody = defaultsPutBodies[defaultsPutBodies.length - 1];
    expect(
      secondBody?.settings?.music?.selection_rules?.fallback_to_full_library,
    ).toBe(true);
    expect(defaultsPutStatuses).not.toContain(422);
    await expect(toggleAfterReload).toHaveAttribute('aria-pressed', 'true');
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
