import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from '../support/mock-backend.js';

/**
 * Feature 22 (agency_music_upload) — smoke for the file-input music form.
 *
 * The form replaces the old metadata-only `object_key` + `duration_seconds`
 * inputs with a `<input type="file">` that POSTs `multipart/form-data` to
 * /v1/admin/agencies/{id}/music/upload. The mock-backend handler accepts the
 * multipart body, fabricates a server-derived `object_key` and a pinned
 * `duration_seconds` (the mock can't run ffprobe), and returns the canonical
 * 201 shape from the back spec.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, 'fixtures/sample-music.mp3');

test.describe('feature 22 — agency music upload', () => {
  test('multipart upload via the Music tab', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      musicTracks: [],
    });

    const uploadRequests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/music/upload`) &&
        request.method() === 'POST'
      ) {
        uploadRequests.push({
          contentType: request.headers()['content-type'] || '',
          hasBody: Boolean(request.postData()),
        });
      }
    });

    await page.goto('/music');
    await expect(page.getByRole('heading', { name: /Music/ })).toBeVisible();
    await expect(page.getByText('No music tracks yet.')).toBeVisible();

    // Pick the .mp3 fixture, give it a display name, submit.
    await page
      .locator('[data-testid="music-upload-input"]')
      .setInputFiles(FIXTURE_PATH);
    await page.getByLabel('Display name').fill('Midnight Keys');
    await page.getByRole('button', { name: /Upload track/ }).click();

    // The multipart request must have fired with a real boundary + body.
    await expect.poll(() => uploadRequests.length).toBe(1);
    expect(uploadRequests[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(uploadRequests[0].hasBody).toBe(true);

    // After the upload the new track shows up in the table with the
    // server-derived duration (mock pins 30 → "0:30"). The user never typed
    // 30 — the form has no duration input anymore.
    const row = page.getByRole('row', { name: /Midnight Keys/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('0:30');
  });
});
