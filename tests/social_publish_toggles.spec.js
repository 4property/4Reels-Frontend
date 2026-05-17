import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 30 (social_per_platform_publish_toggle) — /social grows a row
 * of per-network toggles backed by `agency_reel_defaults.platforms`. The
 * canonical owner of the array is `PUT /v1/admin/agencies/{id}/defaults`
 * (back features 6 + 19), so this suite verifies:
 *   (a) flipping a toggle off sends a PUT with `platforms` minus that id;
 *   (b) reload hydrates the toggle state from the persisted array;
 *   (c) flipping back on sends the platform id again in the PUT body;
 *   (d) a disconnected social yields a disabled toggle (no PUT fires);
 *   (e) the template subtab for an off-publish network is attenuated.
 */

const ALL_PLATFORMS = [
  'instagram',
  'tiktok',
  'facebook',
  'linkedin',
  'youtube',
  'gbp',
  'pinterest',
];

function fullyConnectedSocialAccounts() {
  // Mirror the back's `SocialAccountResponse` minimally — TenantProvider's
  // adapter only reads platform, name, id, is_expired, account_type.
  return ALL_PLATFORMS.map((platform, index) => ({
    id: `acct-${platform}-${index}`,
    platform,
    name: `@ckp_${platform}`,
    account_type: 'page',
    is_expired: false,
  }));
}

function defaultsRow(platforms) {
  return {
    agency_id: SAMPLE_AGENCY_ID,
    platforms,
    intro_enabled: true,
    duration_seconds: 30,
    settings: {},
  };
}

function trackDefaultsPuts(page) {
  const bodies = [];
  const statuses = [];
  page.on('request', (request) => {
    if (
      request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/defaults`) &&
      request.method() === 'PUT'
    ) {
      try {
        bodies.push(JSON.parse(request.postData() || '{}'));
      } catch {
        bodies.push({});
      }
    }
  });
  page.on('response', (response) => {
    if (
      response.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/defaults`) &&
      response.request().method() === 'PUT'
    ) {
      statuses.push(response.status());
    }
  });
  return { bodies, statuses };
}

test.describe('feature 30 — per-platform publish toggle', () => {
  test('flipping TikTok off sends PUT with platforms minus tiktok', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      socialAccountsByAgency: {
        [SAMPLE_AGENCY_ID]: fullyConnectedSocialAccounts(),
      },
      defaultsByAgency: {
        [SAMPLE_AGENCY_ID]: defaultsRow(ALL_PLATFORMS),
      },
    });

    const { bodies, statuses } = trackDefaultsPuts(page);

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();
    await expect(page.locator('[data-testid="publishing-strip"]')).toBeVisible();

    const tiktokToggle = page.locator('[data-testid="publishing-toggle-tiktok"]');
    await expect(tiktokToggle).toBeEnabled();
    await expect(tiktokToggle).toHaveAttribute('aria-pressed', 'true');

    await tiktokToggle.click();

    await expect.poll(() => bodies.length).toBe(1);
    await expect.poll(() => statuses.length).toBeGreaterThan(0);
    expect(statuses).not.toContain(422);
    expect(statuses).toContain(200);

    const body = bodies[0];
    expect(Array.isArray(body.platforms)).toBe(true);
    expect(body.platforms).not.toContain('tiktok');
    expect(body.platforms).toEqual(
      expect.arrayContaining(['instagram', 'facebook', 'linkedin', 'youtube', 'gbp', 'pinterest']),
    );
    expect(typeof body.intro_enabled).toBe('boolean');
    expect(typeof body.duration_seconds).toBe('number');
    expect(body.settings).toBeDefined();

    // Optimistic UI: toggle is now OFF.
    await expect(tiktokToggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('reload re-hydrates toggles from persisted defaults.platforms', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      socialAccountsByAgency: {
        [SAMPLE_AGENCY_ID]: fullyConnectedSocialAccounts(),
      },
      defaultsByAgency: {
        [SAMPLE_AGENCY_ID]: defaultsRow(ALL_PLATFORMS),
      },
    });

    await page.goto('/social');
    await expect(page.locator('[data-testid="publishing-strip"]')).toBeVisible();

    const tiktokToggle = page.locator('[data-testid="publishing-toggle-tiktok"]');
    await expect(tiktokToggle).toHaveAttribute('aria-pressed', 'true');

    await tiktokToggle.click();
    await expect(tiktokToggle).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    await expect(page.locator('[data-testid="publishing-strip"]')).toBeVisible();

    await expect(
      page.locator('[data-testid="publishing-toggle-tiktok"]'),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.locator('[data-testid="publishing-toggle-instagram"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('flipping TikTok back on sends PUT including tiktok', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      socialAccountsByAgency: {
        [SAMPLE_AGENCY_ID]: fullyConnectedSocialAccounts(),
      },
      defaultsByAgency: {
        // Start with tiktok already off; flipping back on must add it.
        [SAMPLE_AGENCY_ID]: defaultsRow(
          ALL_PLATFORMS.filter((p) => p !== 'tiktok'),
        ),
      },
    });

    const { bodies } = trackDefaultsPuts(page);

    await page.goto('/social');
    await expect(page.locator('[data-testid="publishing-strip"]')).toBeVisible();

    const tiktokToggle = page.locator('[data-testid="publishing-toggle-tiktok"]');
    await expect(tiktokToggle).toHaveAttribute('aria-pressed', 'false');

    await tiktokToggle.click();

    await expect.poll(() => bodies.length).toBe(1);
    const body = bodies[0];
    expect(body.platforms).toContain('tiktok');
    await expect(tiktokToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('disconnected social yields a disabled toggle and no PUT fires', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      socialAccountsByAgency: {
        // Connect everything except pinterest.
        [SAMPLE_AGENCY_ID]: fullyConnectedSocialAccounts().filter(
          (acct) => acct.platform !== 'pinterest',
        ),
      },
      defaultsByAgency: {
        [SAMPLE_AGENCY_ID]: defaultsRow(ALL_PLATFORMS),
      },
    });

    const { bodies } = trackDefaultsPuts(page);

    await page.goto('/social');
    await expect(page.locator('[data-testid="publishing-strip"]')).toBeVisible();

    const pinterestToggle = page.locator('[data-testid="publishing-toggle-pinterest"]');
    await expect(pinterestToggle).toBeDisabled();
    await expect(pinterestToggle).toHaveAttribute('title', /Connect this network first/i);

    // Forcing a click on a disabled button should not produce a PUT.
    await pinterestToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
    expect(bodies).toHaveLength(0);
  });

  test('template subtab for an off-publish network is attenuated', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      socialAccountsByAgency: {
        [SAMPLE_AGENCY_ID]: fullyConnectedSocialAccounts(),
      },
      defaultsByAgency: {
        [SAMPLE_AGENCY_ID]: defaultsRow(ALL_PLATFORMS),
      },
    });

    await page.goto('/social');
    await expect(page.locator('[data-testid="publishing-strip"]')).toBeVisible();

    const tiktokSubtab = page.locator('[data-testid="social-subtab-tiktok"]');
    await expect(tiktokSubtab).not.toHaveClass(/disabled-publish/);

    await page.locator('[data-testid="publishing-toggle-tiktok"]').click();

    await expect(tiktokSubtab).toHaveClass(/disabled-publish/);
    await expect(tiktokSubtab.locator('.subtab-off-badge')).toBeVisible();

    // Still clickable — switching to tiktok template still works.
    await tiktokSubtab.click();
    await expect(tiktokSubtab).toHaveClass(/active/);
  });
});
