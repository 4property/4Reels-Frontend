import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

test.describe('music library', () => {
  test('lists, creates, edits and deletes tracks', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      musicTracks: [],
    });

    await page.goto('/music');

    await expect(page.getByRole('heading', { name: /Music/ })).toBeVisible();
    await expect(page.getByText('No music tracks yet.')).toBeVisible();

    await page.getByLabel('Display name').fill('Midnight Keys');
    await page.getByLabel('Object key').fill('agencies/ckp/music/midnight-keys.mp3');
    await page.getByLabel('Duration').fill('42');
    await page.getByLabel('Default track').check();
    await page.getByRole('button', { name: /Register track/ }).click();

    const row = page.getByRole('row', { name: /Midnight Keys/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('0:42');
    await expect(row).toContainText('default');

    await page.getByLabel('Edit Midnight Keys').click();
    await page.getByLabel('Display name').fill('Midnight Keys Edit');
    await page.getByRole('button', { name: /Save track/ }).click();
    await expect(page.getByRole('row', { name: /Midnight Keys Edit/ })).toBeVisible();

    await page.getByLabel('Delete Midnight Keys Edit').click();
    await expect(page.getByText('No music tracks yet.')).toBeVisible();
  });
});
