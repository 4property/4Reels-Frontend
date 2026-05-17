import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 34 — `agency_intro_upload_ui`.
 *
 * Covers the IntroCard wired into /defaults > Intro & outro:
 *   - upload MP4 → multipart POST, chip appears with duration + size, preview
 *     `<video>` points at the auth-protected file endpoint
 *   - oversized file → inline error, no network request
 *   - non-mp4/mov → inline error, no network request
 *   - duration probe failure → inline error blocks submit (no network request)
 *   - "Brand card" segmented option is disabled with tooltip "Coming soon"
 *   - trash → DELETE fires, chip disappears
 *   - toggle Enabled off + on preserves persisted chip metadata
 *
 * The duration probe is injected via `window.__4reelsProbeIntroDuration`
 * (parallel to outro's `__4reelsProbeOutroDuration`) because Playwright
 * cannot decode a synthetic MP4 buffer through a real `<video>` element
 * in headless Chromium. The injection is only a way to deliver a known
 * number to the same validation gate the real probe feeds.
 */

const MP4_BYTES = Buffer.from(
  // Minimal `ftyp` atom — valid bytes, no playable frames.
  '0000001866747970697' + '36f6d000000026973' + '6f6d69736f32',
  'hex',
);
const TXT_BYTES = Buffer.from('not a video');

const INTRO_UPLOAD_URL = `/v1/admin/agencies/${SAMPLE_AGENCY_ID}/intro/upload`;
const INTRO_DELETE_URL = `/v1/admin/agencies/${SAMPLE_AGENCY_ID}/intro`;

async function gotoDefaultsWithIntroSetup(page, { probeSeconds = 3 } = {}) {
  await seedAgencyLocalStorage(page);
  await installMockBackend(page, {
    agencies: [SAMPLE_AGENCY],
    ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
  });
  await page.addInitScript((duration) => {
    window.__4reelsProbeIntroDuration = () => Promise.resolve(duration);
  }, probeSeconds);
  await page.goto('/defaults');
  await expect(page.getByRole('heading', { name: 'Defaults' })).toBeVisible();
  await page.getByRole('button', { name: /Intro & outro/i }).click();
  await expect(page.locator('[data-testid="intro-card"]')).toBeVisible();
}

test.describe('feature 34 — agency intro upload', () => {
  test('upload happy path → chip appears with duration + size', async ({ page }) => {
    await gotoDefaultsWithIntroSetup(page, { probeSeconds: 3 });

    const uploadRequests = [];
    page.on('request', (request) => {
      if (request.url().endsWith(INTRO_UPLOAD_URL) && request.method() === 'POST') {
        uploadRequests.push({
          contentType: request.headers()['content-type'] || '',
          hasBody: Boolean(request.postData()),
        });
      }
    });

    const replaceBefore = page.locator('[data-testid="intro-replace"]');
    await expect(replaceBefore).toHaveCount(0);

    await page.locator('[data-testid="intro-input"]').setInputFiles({
      name: 'intro.mp4',
      mimeType: 'video/mp4',
      buffer: MP4_BYTES,
    });

    await expect.poll(() => uploadRequests.length).toBe(1);
    expect(uploadRequests[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(uploadRequests[0].hasBody).toBe(true);

    const chip = page.locator('[data-testid="intro-file-chip"]');
    await expect(chip).toBeVisible();
    await expect(page.locator('[data-testid="intro-file-meta"]')).toContainText('3');

    // Preview video points at the auth-protected file URL.
    const previewSrc = await page
      .locator('[data-testid="intro-preview-video"]')
      .getAttribute('src');
    expect(previewSrc).toMatch(/\/v1\/admin\/agencies\/[^/]+\/intro\/file$/);

    // Replace + trash both visible.
    await expect(page.locator('[data-testid="intro-replace"]')).toBeVisible();
    await expect(page.locator('[data-testid="intro-trash"]')).toBeVisible();
  });

  test('client-side validation blocks oversized files without firing a request', async ({
    page,
  }) => {
    await gotoDefaultsWithIntroSetup(page, { probeSeconds: 3 });

    let uploadCalls = 0;
    page.on('request', (request) => {
      if (request.url().endsWith(INTRO_UPLOAD_URL) && request.method() === 'POST') {
        uploadCalls += 1;
      }
    });

    // Playwright cannot ship a >50MB Buffer through `setInputFiles`, so the
    // test fabricates a `File` whose `.size` is patched to 51 MB and dispatches
    // a change event on the hidden input — same code path the picker uses,
    // without ever allocating the bytes.
    await page.evaluate(() => {
      const input = document.querySelector('[data-testid="intro-input"]');
      const tiny = new Uint8Array([0, 0, 0, 0]);
      const file = new File([tiny], 'huge.mp4', { type: 'video/mp4' });
      Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(page.locator('[data-testid="intro-error"]')).toContainText(
      /50MB/,
    );
    expect(uploadCalls).toBe(0);
  });

  test('rejects non-mp4/mov files client-side', async ({ page }) => {
    await gotoDefaultsWithIntroSetup(page, { probeSeconds: 3 });

    let uploadCalls = 0;
    page.on('request', (request) => {
      if (request.url().endsWith(INTRO_UPLOAD_URL) && request.method() === 'POST') {
        uploadCalls += 1;
      }
    });

    await page.locator('[data-testid="intro-input"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: TXT_BYTES,
    });

    await expect(page.locator('[data-testid="intro-error"]')).toContainText(
      /MP4 or MOV/,
    );
    expect(uploadCalls).toBe(0);
  });

  test('duration probe failure blocks submit', async ({ page }) => {
    await gotoDefaultsWithIntroSetup(page, { probeSeconds: 12 });

    let uploadCalls = 0;
    page.on('request', (request) => {
      if (request.url().endsWith(INTRO_UPLOAD_URL) && request.method() === 'POST') {
        uploadCalls += 1;
      }
    });

    await page.locator('[data-testid="intro-input"]').setInputFiles({
      name: 'long.mp4',
      mimeType: 'video/mp4',
      buffer: MP4_BYTES,
    });

    await expect(page.locator('[data-testid="intro-error"]')).toContainText(
      /1.{1,3}10s/,
    );
    expect(uploadCalls).toBe(0);
  });

  test('Brand card option is disabled with "Coming soon" tooltip', async ({ page }) => {
    await gotoDefaultsWithIntroSetup(page);

    const card = page.locator('[data-testid="intro-card"]');
    const brandCardBtn = card.locator('.seg button', { hasText: 'Brand card' });
    await expect(brandCardBtn).toHaveAttribute('disabled', '');
    await expect(brandCardBtn).toHaveAttribute('title', 'Coming soon');
  });

  test('trash dispatches DELETE and clears the chip', async ({ page }) => {
    await gotoDefaultsWithIntroSetup(page, { probeSeconds: 3 });

    const deletes = [];
    page.on('request', (request) => {
      if (
        request.url().endsWith(INTRO_DELETE_URL) &&
        request.method() === 'DELETE'
      ) {
        deletes.push(request.url());
      }
    });

    // Upload first so trash has something to act on.
    await page.locator('[data-testid="intro-input"]').setInputFiles({
      name: 'intro.mp4',
      mimeType: 'video/mp4',
      buffer: MP4_BYTES,
    });
    await expect(page.locator('[data-testid="intro-file-chip"]')).toBeVisible();

    await page.locator('[data-testid="intro-trash"]').click();

    await expect.poll(() => deletes.length).toBe(1);
    await expect(page.locator('[data-testid="intro-file-chip"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="intro-dropzone"]')).toBeVisible();
  });

  test('toggling Enabled off and on preserves the persisted chip', async ({ page }) => {
    await gotoDefaultsWithIntroSetup(page, { probeSeconds: 3 });

    await page.locator('[data-testid="intro-input"]').setInputFiles({
      name: 'intro.mp4',
      mimeType: 'video/mp4',
      buffer: MP4_BYTES,
    });
    const chip = page.locator('[data-testid="intro-file-chip"]');
    await expect(chip).toBeVisible();

    const toggle = page
      .locator('[data-testid="intro-card"] .card-header')
      .locator('.toggle');
    await toggle.click();
    // The card body is hidden via display:none — the chip survives in the DOM
    // but is no longer visible.
    await expect(chip).toBeHidden();
    await toggle.click();
    await expect(chip).toBeVisible();
  });

  test('combined: both intro and outro upload land on the same defaults tab', async ({
    page,
  }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });
    await page.addInitScript(() => {
      window.__4reelsProbeIntroDuration = () => Promise.resolve(3);
      window.__4reelsProbeOutroDuration = () => Promise.resolve(5);
    });

    const introUploads = [];
    const outroUploads = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') {
        if (request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/intro/upload`)) {
          introUploads.push(request.url());
        }
        if (request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/outro/upload`)) {
          outroUploads.push(request.url());
        }
      }
    });

    await page.goto('/defaults');
    await expect(page.getByRole('heading', { name: 'Defaults' })).toBeVisible();
    await page.getByRole('button', { name: /Intro & outro/i }).click();
    await expect(page.locator('[data-testid="intro-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="outro-card"]')).toBeVisible();

    await page.locator('[data-testid="intro-input"]').setInputFiles({
      name: 'intro.mp4',
      mimeType: 'video/mp4',
      buffer: MP4_BYTES,
    });
    await expect(page.locator('[data-testid="intro-file-chip"]')).toBeVisible();

    await page.locator('[data-testid="outro-input"]').setInputFiles({
      name: 'outro.mp4',
      mimeType: 'video/mp4',
      buffer: MP4_BYTES,
    });
    await expect(page.locator('[data-testid="outro-file-chip"]')).toBeVisible();

    expect(introUploads.length).toBe(1);
    expect(outroUploads.length).toBe(1);

    // Both chips remain visible after both uploads; the cards do not interfere.
    await expect(page.locator('[data-testid="intro-file-chip"]')).toBeVisible();
    await expect(page.locator('[data-testid="outro-file-chip"]')).toBeVisible();

    // Toggling intro off hides only its chip; outro's chip stays visible.
    await page
      .locator('[data-testid="intro-card"] .card-header')
      .locator('.toggle')
      .click();
    await expect(page.locator('[data-testid="intro-file-chip"]')).toBeHidden();
    await expect(page.locator('[data-testid="outro-file-chip"]')).toBeVisible();
  });
});
