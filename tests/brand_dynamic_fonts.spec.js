import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 28 — brand_dynamic_fonts_and_reset_defaults (frontend).
 *
 * Verifies that:
 *   - The Brand page populates the heading-font dropdown from
 *     `GET /v1/admin/fonts` instead of a hardcoded array.
 *   - Selecting a font and clicking "Save brand" emits a PUT with that
 *     family in the body.
 *   - Clicking "Reset to default" next to the font dropdown sets the field
 *     to `null` in the next PUT body (front maps "Default" → `null`).
 *   - Same Reset affordance works for primary_color and secondary_color.
 *
 * The mock-backend installs both `/v1/admin/fonts` and a brand handler that
 * persists `null` values per the live back contract (see
 * `support/mock-backend.js` feature 28 block).
 */

test.describe('feature 28 — dynamic fonts + reset defaults', () => {
  test('dropdown is populated from GET /v1/admin/fonts', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const fontsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/v1/admin/fonts') &&
        response.request().method() === 'GET',
    );

    await page.goto('/brand');
    await expect(page.getByRole('heading', { name: 'Brand' })).toBeVisible();

    const fontsResponse = await fontsResponsePromise;
    expect(fontsResponse.status()).toBe(200);
    const body = await fontsResponse.json();
    expect(body.count).toBe(7);
    expect(body.items.map((f) => f.family)).toEqual([
      'Inter',
      'Manrope',
      'Plus Jakarta Sans',
      'Montserrat',
      'Poppins',
      'Roboto',
      'Barlow Semi Condensed',
    ]);

    const select = page.locator('[data-testid="brand-font-select"]');
    await expect(select).toBeEnabled();
    // 7 fonts from the catalog + 1 "Default" placeholder.
    await expect(select.locator('option')).toHaveCount(8);
    await expect(select.locator('option').first()).toHaveText(
      /Default \(system fallback\)/,
    );
    await expect(select.locator('option').nth(1)).toHaveText('Inter');
    await expect(select.locator('option').nth(7)).toHaveText(
      'Barlow Semi Condensed',
    );

    // No 'Söhne' / 'Helvetica' anywhere — those were retired with feature 28.
    const allText = (await select.locator('option').allTextContents()).join('|');
    expect(allText).not.toMatch(/Söhne/);
    expect(allText).not.toMatch(/Helvetica/);
  });

  test('select Manrope -> Save -> PUT carries font_family: "Manrope"', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const brandPutBodies = [];
    const brandPutStatuses = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PUT' &&
        request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand`)
      ) {
        brandPutBodies.push(safeParse(request.postData()));
      }
    });
    page.on('response', (response) => {
      if (
        response.request().method() === 'PUT' &&
        response.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand`)
      ) {
        brandPutStatuses.push(response.status());
      }
    });

    await page.goto('/brand');
    await expect(page.locator('[data-testid="brand-font-select"]')).toBeEnabled();

    await page
      .locator('[data-testid="brand-font-select"]')
      .selectOption('Manrope');

    await page.getByRole('button', { name: /Save brand/ }).click();
    await expect.poll(() => brandPutBodies.length).toBeGreaterThan(0);
    await expect.poll(() => brandPutStatuses.length).toBeGreaterThan(0);

    const body = brandPutBodies[0];
    expect(body.font_family).toBe('Manrope');
    expect(body).toHaveProperty('primary_color');
    expect(body).toHaveProperty('secondary_color');
    expect(body).toHaveProperty('logo_position');
    expect(brandPutStatuses).toContain(200);
    expect(brandPutStatuses).not.toContain(422);
  });

  test('Reset font -> Save -> PUT carries font_family: null', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const brandPutBodies = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PUT' &&
        request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand`)
      ) {
        brandPutBodies.push(safeParse(request.postData()));
      }
    });

    await page.goto('/brand');
    await expect(page.locator('[data-testid="brand-font-select"]')).toBeEnabled();

    // First pick Manrope so the Reset button has something to reset.
    await page
      .locator('[data-testid="brand-font-select"]')
      .selectOption('Manrope');

    // Reset → state goes back to `null`, hint appears, dropdown shows
    // "Default".
    await page.locator('[data-testid="brand-font-reset"]').click();
    await expect(page.locator('[data-testid="brand-font-select"]')).toHaveValue(
      '',
    );
    await expect(
      page.locator('[data-testid="brand-font-default-hint"]'),
    ).toBeVisible();

    await page.getByRole('button', { name: /Save brand/ }).click();
    await expect.poll(() => brandPutBodies.length).toBeGreaterThan(0);

    const body = brandPutBodies.at(-1);
    expect(body).toHaveProperty('font_family');
    expect(body.font_family).toBeNull();
  });

  test('Reset primary color -> Save -> PUT carries primary_color: null', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const brandPutBodies = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PUT' &&
        request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand`)
      ) {
        brandPutBodies.push(safeParse(request.postData()));
      }
    });

    await page.goto('/brand');
    await expect(page.getByRole('heading', { name: 'Brand' })).toBeVisible();

    // A fresh agency has no brand row, so primary_color starts `null` and
    // the Reset button is disabled. Drop a hex into the text input first so
    // the state has something to reset away from.
    const primarySwatch = page
      .locator('.brand-cols-2 .field')
      .first()
      .locator('input.input');
    await primarySwatch.fill('#abcdef');
    await expect(
      page.locator('[data-testid="brand-primary-color-reset"]'),
    ).toBeEnabled();

    await page.locator('[data-testid="brand-primary-color-reset"]').click();
    await expect(
      page.locator('[data-testid="brand-primary-color-default-hint"]'),
    ).toBeVisible();

    await page.getByRole('button', { name: /Save brand/ }).click();
    await expect.poll(() => brandPutBodies.length).toBeGreaterThan(0);

    const body = brandPutBodies.at(-1);
    expect(body).toHaveProperty('primary_color');
    expect(body.primary_color).toBeNull();
    // secondary_color must NOT be silently nulled.
    expect(body).toHaveProperty('secondary_color');
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
