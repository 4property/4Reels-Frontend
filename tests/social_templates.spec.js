import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 8 (agency_default_descriptions_ui) — round-trip smoke for the
 * Descriptions subtab in the AgencyConfigDrawer. Loads the drawer, opens
 * the new tab, fills two platform textareas, hits Save, and asserts the
 * outgoing PUT body matches the `SocialTemplatesReplacePayload` contract
 * (no extra keys, only `{templates: {platform: descriptionString}}`).
 */

test.describe('feature 8 — default descriptions UI', () => {
  test('Descriptions subtab loads, edits, and saves via PUT', async ({ page }) => {
    await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });

    const getRequests = [];
    const putBodies = [];
    const putStatuses = [];

    page.on('request', (request) => {
      const url = request.url();
      if (!url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/social-templates`)) return;
      if (request.method() === 'GET') getRequests.push(url);
      if (request.method() === 'PUT') putBodies.push(safeParse(request.postData()));
    });
    page.on('response', (response) => {
      const url = response.url();
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/social-templates`) &&
        response.request().method() === 'PUT'
      ) {
        putStatuses.push(response.status());
      }
    });

    await page.goto('/v1/admin?admin=1');
    await page.getByRole('button', { name: /Configure/ }).first().click();
    await expect(page.locator('.agency-config-drawer')).toBeVisible();

    await page.getByRole('button', { name: /^Descriptions$/ }).click();

    // GET fired on tab mount.
    await expect.poll(() => getRequests.length).toBeGreaterThan(0);

    // All 7 platforms present as textareas.
    for (const platform of [
      'tiktok',
      'instagram',
      'linkedin',
      'youtube',
      'facebook',
      'gbp',
      'pinterest',
    ]) {
      await expect(
        page.locator(`[data-testid="default-description-${platform}"]`),
      ).toBeVisible();
    }

    // Edit two platforms, leave the rest empty.
    await page
      .locator('[data-testid="default-description-instagram"]')
      .fill('IG · {{property_title}} · {{price}}');
    await page
      .locator('[data-testid="default-description-tiktok"]')
      .fill('TT · {{neighborhood}} {{price}}');

    await page.locator('[data-testid="save-default-descriptions"]').click();

    await expect.poll(() => putBodies.length).toBe(1);
    await expect.poll(() => putStatuses.length).toBeGreaterThan(0);
    expect(putStatuses, 'no 422 on social-templates PUT').not.toContain(422);
    expect(putStatuses).toContain(200);

    const body = putBodies[0];
    expect(body).toEqual({
      templates: {
        instagram: 'IG · {{property_title}} · {{price}}',
        tiktok: 'TT · {{neighborhood}} {{price}}',
      },
    });

    // Success banner shown to the user.
    await expect(page.getByText(/Default descriptions saved\./)).toBeVisible();
  });

  test('GET pre-populates textareas from existing templates', async ({ page }) => {
    await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });

    // Pre-seed the mock store via a one-off PUT before the drawer mounts.
    await page.goto('/v1/admin?admin=1');
    await page.getByRole('button', { name: /Configure/ }).first().click();
    await expect(page.locator('.agency-config-drawer')).toBeVisible();
    await page.getByRole('button', { name: /^Descriptions$/ }).click();

    await page
      .locator('[data-testid="default-description-facebook"]')
      .fill('FB seed: {{property_title}}');
    await page.locator('[data-testid="save-default-descriptions"]').click();
    await expect(page.getByText(/Default descriptions saved\./)).toBeVisible();

    // Re-mount the panel (switch tab and back) to verify GET reads what was saved.
    await page.getByRole('button', { name: /^Reel settings$/ }).click();
    await page.getByRole('button', { name: /^Descriptions$/ }).click();

    await expect(
      page.locator('[data-testid="default-description-facebook"]'),
    ).toHaveValue('FB seed: {{property_title}}');
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

/**
 * Feature 18 (social_templates_ui_close_gaps) — closes 3 gaps in `/social`:
 *   (a) the mock backend now rejects unknown `{{var}}` placeholders with the
 *       same 422 + SOCIAL_TEMPLATE_UNKNOWN_VARIABLE shape the live backend
 *       returns, so the UI banner code path is actually exercised.
 *   (b) typing past `NETWORK_LIMITS[net]` flips the char counter to the
 *       `over` class (red).
 *   (c) the 3 newly exposed variables (neighborhood_tag, agent_email,
 *       property_url) are clickable chips that insert `{{var}}` into the
 *       active textarea, matching the canonical 16-variable list the back
 *       accepts.
 */
test.describe('feature 18 — social templates UI gaps', () => {
  test('unknown variable in PUT body surfaces SOCIAL_TEMPLATE_UNKNOWN_VARIABLE banner', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const putStatuses = [];
    page.on('response', (response) => {
      const url = response.url();
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/social-templates`) &&
        response.request().method() === 'PUT'
      ) {
        putStatuses.push(response.status());
      }
    });

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    // Instagram is the default-active network. Fill the textarea with a
    // template containing a placeholder that is NOT in the canonical 16.
    const textarea = page.locator('[data-testid="social-template-textarea"]');
    await expect(textarea).toBeVisible();
    await textarea.fill('Valid copy {{not_a_real_var}} more text');

    await page.getByRole('button', { name: /Save changes/ }).click();

    // Mock backend should respond 422 and the UI should render a danger banner.
    await expect.poll(() => putStatuses).toContain(422);

    const banner = page.locator('.card.card-danger').first();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SOCIAL_TEMPLATE_UNKNOWN_VARIABLE');
  });

  test('typing past NETWORK_LIMITS[instagram] flips char counter to "over"', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    const textarea = page.locator('[data-testid="social-template-textarea"]');
    await expect(textarea).toBeVisible();

    // Instagram limit is 2200 (see src/features/reels/editor/defaults.js). Pour
    // in 2201 chars — counter should switch to the `.over` class.
    const longText = 'a'.repeat(2201);
    await textarea.fill(longText);

    const charCount = page.locator('.template-char-count');
    await expect(charCount).toHaveClass(/\bover\b/);
    await expect(charCount).toContainText('2201/2200');
  });

  test('newly exposed variable chips (neighborhood_tag, agent_email, property_url) insert {{var}} on click', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    const textarea = page.locator('[data-testid="social-template-textarea"]');
    await expect(textarea).toBeVisible();
    await textarea.fill('');

    for (const variable of ['neighborhood_tag', 'agent_email', 'property_url']) {
      const chip = page.getByRole('button', { name: `{{${variable}}}`, exact: false });
      await expect(chip).toBeVisible();
      await chip.click();
      await expect(textarea).toHaveValue(new RegExp(`\\{\\{${variable}\\}\\}`));
      // Clear between iterations so each assertion is independent.
      await textarea.fill('');
    }
  });
});

/**
 * Feature 20 (social_templates_ui_hashtags_and_title) — /social now exposes
 * an editable `title_template` (one-line input) and a `hashtags` chip editor
 * per network. The PUT payload upgrades from `{templates:{platform:string}}`
 * to the rich shape `{templates:{platform:{description_template, title_template, hashtags}}}`.
 * The back accepts both, but the new UI always sends the rich form so that
 * every saved entry carries the 3 fields explicitly.
 */
test.describe('feature 20 — social templates title + hashtags', () => {
  test('edit title + add 3 hashtags + save → PUT body carries the 3 fields', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const putBodies = [];
    const putStatuses = [];
    page.on('request', (request) => {
      if (
        request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/social-templates`) &&
        request.method() === 'PUT'
      ) {
        putBodies.push(safeParse(request.postData()));
      }
    });
    page.on('response', (response) => {
      if (
        response.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/social-templates`) &&
        response.request().method() === 'PUT'
      ) {
        putStatuses.push(response.status());
      }
    });

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    // Instagram is the default-active network. Fill all 3 fields.
    await page.locator('[data-testid="social-template-textarea"]').fill('Visit {{property_title}} now');
    await page.locator('[data-testid="social-template-title"]').fill('Your title');

    const hashtagInput = page.locator('[data-testid="social-template-hashtag-input"]');
    await hashtagInput.click();
    await hashtagInput.type('#dublin');
    await hashtagInput.press('Enter');
    await hashtagInput.type('#cork');
    await hashtagInput.press(' ');
    await hashtagInput.type('#realestate');
    await hashtagInput.press(',');

    // 3 chips visible inside the hashtag editor.
    const chips = page.locator('[data-testid="social-template-hashtags"] [data-testid="social-template-hashtag-chip"]');
    await expect(chips).toHaveCount(3);

    await page.getByRole('button', { name: /Save changes/ }).click();

    await expect.poll(() => putBodies.length).toBe(1);
    await expect.poll(() => putStatuses.length).toBeGreaterThan(0);
    expect(putStatuses, 'PUT should not 422 with valid hashtags').not.toContain(422);
    expect(putStatuses).toContain(200);

    const body = putBodies[0];
    expect(body).toBeTruthy();
    expect(body.templates).toBeTruthy();
    expect(body.templates.instagram).toEqual({
      description_template: 'Visit {{property_title}} now',
      title_template: 'Your title',
      hashtags: ['#dublin', '#cork', '#realestate'],
    });
  });

  test('reload hydrates title and hashtag chips from items[]', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    // First visit: seed values.
    await page.goto('/social');
    await page.locator('[data-testid="social-template-textarea"]').fill('Hello {{city}}');
    await page.locator('[data-testid="social-template-title"]').fill('Seeded title');
    const hashtagInput = page.locator('[data-testid="social-template-hashtag-input"]');
    await hashtagInput.click();
    await hashtagInput.type('#one');
    await hashtagInput.press('Enter');
    await hashtagInput.type('#two');
    await hashtagInput.press('Enter');
    await hashtagInput.type('#three');
    await hashtagInput.press('Enter');
    await page.getByRole('button', { name: /Save changes/ }).click();
    await expect(page.getByText(/Templates saved\./)).toBeVisible();

    // Reload: GET should bring the 3 fields back through items[].
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    await expect(page.locator('[data-testid="social-template-title"]')).toHaveValue('Seeded title');
    const chips = page.locator('[data-testid="social-template-hashtags"] [data-testid="social-template-hashtag-chip"]');
    await expect(chips).toHaveCount(3);
    await expect(chips.nth(0)).toContainText('#one');
    await expect(chips.nth(1)).toContainText('#two');
    await expect(chips.nth(2)).toContainText('#three');
  });

  test('invalid hashtag is dropped client-side with inline error', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    const hashtagInput = page.locator('[data-testid="social-template-hashtag-input"]');
    await hashtagInput.click();
    await hashtagInput.type('bad@hashtag');
    await hashtagInput.press('Enter');

    // No chip created; inline error visible.
    const chips = page.locator('[data-testid="social-template-hashtags"] [data-testid="social-template-hashtag-chip"]');
    await expect(chips).toHaveCount(0);
    await expect(page.locator('[data-testid="social-template-hashtag-error"]')).toBeVisible();
  });

  test('hitting MAX_HASHTAGS_PER_PLATFORM (30) disables the input', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    const hashtagInput = page.locator('[data-testid="social-template-hashtag-input"]');
    await hashtagInput.click();
    for (let i = 1; i <= 30; i += 1) {
      await hashtagInput.type(`#tag${i}`);
      await hashtagInput.press('Enter');
    }

    const chips = page.locator('[data-testid="social-template-hashtags"] [data-testid="social-template-hashtag-chip"]');
    await expect(chips).toHaveCount(30);
    await expect(hashtagInput).toBeDisabled();
    await expect(hashtagInput).toHaveAttribute('placeholder', /Max 30 hashtags/i);
  });

  test('unknown variable in title_template surfaces SOCIAL_TEMPLATE_UNKNOWN_VARIABLE banner', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const putStatuses = [];
    page.on('response', (response) => {
      if (
        response.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/social-templates`) &&
        response.request().method() === 'PUT'
      ) {
        putStatuses.push(response.status());
      }
    });

    await page.goto('/social');
    await expect(page.getByRole('heading', { name: 'Social networks' })).toBeVisible();

    // Description is valid, title carries a placeholder NOT in the canonical 16.
    await page.locator('[data-testid="social-template-textarea"]').fill('Visit {{property_title}}');
    await page.locator('[data-testid="social-template-title"]').fill('Tour {{not_a_var}}');

    await page.getByRole('button', { name: /Save changes/ }).click();
    await expect.poll(() => putStatuses).toContain(422);

    const banner = page.locator('.card.card-danger').first();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SOCIAL_TEMPLATE_UNKNOWN_VARIABLE');
  });
});
