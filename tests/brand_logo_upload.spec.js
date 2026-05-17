import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 9 (agency_logo_upload) — smoke for the LogoUploader wired into
 * BrandConfig. Covers the full happy path:
 *   - file picked (JPG) -> multipart POST /brand/logo fires -> preview img
 *     appears with src pointing at a URL returned by the backend.
 *   - "Remove logo" -> PUT /brand fires with logo_object_key: "" (the back
 *     treats "" as "clear the slot"; null would mean "do not touch").
 *
 * The mock-backend stub returns {object_key, url}. The Brand tab fetches the
 * stream endpoint via `apiFetchBlob` (auth-bearer attached) and renders a
 * `URL.createObjectURL(blob)` URL, so the test asserts the <img>'s src starts
 * with `blob:` and that the GET to the stream endpoint actually fired.
 */

const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d49444154789c63600100000005000130c50f0a0000000049454e44ae426082',
  'hex',
);

test.describe('feature 9 — agency logo upload', () => {
  test('upload + remove via the Brand tab', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const uploadRequests = [];
    const brandPutBodies = [];
    const streamRequests = [];

    page.on('request', (request) => {
      const url = request.url();
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand/logo`) &&
        request.method() === 'POST'
      ) {
        uploadRequests.push({
          contentType: request.headers()['content-type'] || '',
          hasBody: Boolean(request.postData()),
        });
      }
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand`) &&
        request.method() === 'PUT'
      ) {
        brandPutBodies.push(safeParse(request.postData()));
      }
      if (
        /\/v1\/admin\/agencies\/[^/]+\/brand\/logo\/file\/[^/]+$/.test(url) &&
        request.method() === 'GET'
      ) {
        streamRequests.push({
          authorization: request.headers().authorization || '',
        });
      }
    });

    await page.goto('/brand');
    await expect(page.getByRole('heading', { name: 'Brand' })).toBeVisible();

    // The Upload button is enabled (no longer the legacy disabled placeholder).
    const replaceBtn = page.locator('[data-testid="brand-logo-replace"]');
    await expect(replaceBtn).toBeEnabled();

    // Drop a tiny PNG into the hidden file input.
    await page
      .locator('[data-testid="brand-logo-input"]')
      .setInputFiles({
        name: 'agency-logo.png',
        mimeType: 'image/png',
        buffer: PNG_BYTES,
      });

    await expect.poll(() => uploadRequests.length).toBe(1);
    expect(uploadRequests[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(uploadRequests[0].hasBody).toBe(true);

    const preview = page.locator('[data-testid="brand-logo-preview"]');
    await expect(preview).toBeVisible();
    // Preview must be a blob URL (built from the auth-fetched stream), not the
    // raw mock URL — a plain <img src> can't attach the admin bearer.
    await expect(preview).toHaveAttribute('src', /^blob:/);

    // The auth-bearing stream GET must have fired so we know the file came
    // from the protected endpoint and not from a leak in the upload response.
    await expect.poll(() => streamRequests.length).toBeGreaterThan(0);
    expect(streamRequests[0].authorization).toMatch(/^Bearer /);

    // Success banner appears prompting the user to hit "Save brand".
    await expect(page.getByText(/Logo uploaded\./)).toBeVisible();

    // Remove flow: triggers an immediate PUT /brand with logo_object_key: "".
    await page.locator('[data-testid="brand-logo-remove"]').click();

    await expect.poll(() => brandPutBodies.length).toBe(1);
    expect(brandPutBodies[0].logo_object_key).toBe('');
    // Feature 28 — primary_color / secondary_color / font_family are now
    // `str | None`. The body must still carry the keys (the front never
    // omits them) but the values can be `null` when the agency has no
    // brand row yet. `logo_position` is still always a string.
    expect(brandPutBodies[0]).toHaveProperty('primary_color');
    expect(brandPutBodies[0]).toHaveProperty('secondary_color');
    expect(brandPutBodies[0]).toHaveProperty('font_family');
    expect(brandPutBodies[0]).toMatchObject({
      logo_position: expect.any(String),
    });

    // After remove, the preview disappears and the remove button is gone.
    await expect(preview).toHaveCount(0);
    await expect(page.locator('[data-testid="brand-logo-remove"]')).toHaveCount(0);
    await expect(page.getByText(/Logo removed\./)).toBeVisible();

    // The replace button label flips back to "Upload" since there's no logo.
    await expect(replaceBtn).toContainText(/Upload/);
  });

  test('rejects non-image files client-side without firing a request', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    let uploadCalls = 0;
    page.on('request', (request) => {
      if (
        request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/brand/logo`) &&
        request.method() === 'POST'
      ) {
        uploadCalls += 1;
      }
    });

    await page.goto('/brand');
    await expect(page.getByRole('heading', { name: 'Brand' })).toBeVisible();

    await page
      .locator('[data-testid="brand-logo-input"]')
      .setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('not an image'),
      });

    await expect(page.locator('[data-testid="brand-logo-error"]')).toContainText(
      /JPG or PNG/,
    );
    expect(uploadCalls).toBe(0);
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
