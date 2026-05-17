import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 22 follow-up — edit + delete against the new MusicLibrary form.
 *
 * The create flow (file input + multipart upload) is exercised by
 * `tests/playwright/music_upload.spec.js`. This spec covers the remaining
 * CRUD verbs against a track preloaded via `installMockBackend({
 * musicTracks: [...] })`, so we never go through the upload path here.
 *
 * The preloaded track ships with `is_default: false` so the edit step can
 * meaningfully flip the flag and assert the `default` badge afterwards.
 */
const PRELOADED_TRACK = {
  music_id: 'mock-music-preloaded',
  agency_id: SAMPLE_AGENCY_ID,
  display_name: 'Midnight Keys',
  object_key: 'agencies/ckp/music/midnight-keys.mp3',
  duration_seconds: 42,
  is_default: false,
  created_at: '2026-05-06T09:00:00Z',
};

test.describe('music library', () => {
  test('edits and deletes a preloaded track', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      musicTracks: [PRELOADED_TRACK],
    });

    await page.goto('/music');

    await expect(page.getByRole('heading', { name: /Music/ })).toBeVisible();
    // Sanity: the preloaded track shows up, so we are not in the empty state.
    await expect(page.getByText('No music tracks yet.')).toHaveCount(0);
    const initialRow = page.getByRole('row', { name: /Midnight Keys/ });
    await expect(initialRow).toBeVisible();
    await expect(initialRow).toContainText('0:42');
    await expect(initialRow).toContainText('library');

    // Edit: rename + promote to default.
    await page.getByLabel('Edit Midnight Keys').click();
    await page.getByLabel('Display name').fill('Midnight Keys Edit');
    await page.getByLabel('Default track').check();
    await page.getByRole('button', { name: /Save track/ }).click();

    const editedRow = page.getByRole('row', { name: /Midnight Keys Edit/ });
    await expect(editedRow).toBeVisible();
    await expect(editedRow).toContainText('default');

    // Delete: the trash button removes the row and the empty state returns.
    await page.getByLabel('Delete Midnight Keys Edit').click();
    await expect(page.getByText('No music tracks yet.')).toBeVisible();
    await expect(page.getByRole('row', { name: /Midnight Keys/ })).toHaveCount(0);
  });
});
