import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 15 (templates_tab_agency_render_template_selection) — smoke for
 * the new Templates tab. Loads the gallery, asserts the Selected badge
 * sits on the seeded current template, clicks "Use this template" on the
 * other card, and confirms the badge moves after the PUT round-trip.
 */
test.describe('feature 15 — templates tab', () => {
  test('lists templates and switches the selected one', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(),
      currentRenderTemplateId: 'classic-grid',
    });

    const listCalls = [];
    const selectBodies = [];
    const selectStatuses = [];

    page.on('request', (request) => {
      const url = request.url();
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/render-templates`)
        && request.method() === 'GET'
      ) {
        listCalls.push(url);
      }
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/render-template`)
        && request.method() === 'PUT'
      ) {
        selectBodies.push(safeParse(request.postData()));
      }
    });
    page.on('response', (response) => {
      const url = response.url();
      if (
        url.endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/render-template`)
        && response.request().method() === 'PUT'
      ) {
        selectStatuses.push(response.status());
      }
    });

    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();

    const grid = page.locator('[data-testid="templates-grid"]');
    await expect(grid).toBeVisible();

    const classicCard = page.locator('[data-testid="template-card-classic-grid"]');
    const boldCard = page.locator('[data-testid="template-card-bold-headline"]');
    await expect(classicCard).toBeVisible();
    await expect(boldCard).toBeVisible();

    // Seeded selection: classic-grid carries the badge, bold-headline does not.
    await expect(classicCard).toHaveAttribute('data-selected', 'true');
    await expect(boldCard).toHaveAttribute('data-selected', 'false');
    await expect(classicCard.locator('[data-testid="template-selected-badge"]')).toBeVisible();
    await expect(boldCard.locator('[data-testid="template-selected-badge"]')).toHaveCount(0);

    // The selected card's button is disabled with "Current template" copy.
    await expect(
      page.locator('[data-testid="use-template-classic-grid"]'),
    ).toBeDisabled();

    await expect.poll(() => listCalls.length).toBeGreaterThan(0);

    // Switch to bold-headline.
    await page.locator('[data-testid="use-template-bold-headline"]').click();

    await expect.poll(() => selectBodies.length).toBe(1);
    await expect.poll(() => selectStatuses.length).toBeGreaterThan(0);
    expect(selectStatuses).toContain(200);
    expect(selectBodies[0]).toEqual({ template_id: 'bold-headline' });

    // Badge moves after the refetch resolves.
    await expect(boldCard).toHaveAttribute('data-selected', 'true');
    await expect(classicCard).toHaveAttribute('data-selected', 'false');
    await expect(boldCard.locator('[data-testid="template-selected-badge"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="use-template-bold-headline"]'),
    ).toBeDisabled();
    await expect(page.getByText(/Template selected\./)).toBeVisible();
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
