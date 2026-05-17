// Integration smoke — end-to-end pipeline against the LIVE test stack.
//
// Run with:   RUN_INTEGRATION_SMOKE=1 npx playwright test integration_smoke_e2e
//
// Unlike the regular suite (which stubs the backend with
// `installMockBackend`), this spec navigates the nginx-served `dist/` bundle
// at http://127.0.0.1/ and lets it talk to the real test backend at
// https://4reelsback-test.4property.com (proxied to :8001 on localhost).
//
// READ-WRITE mode — the spec PATCHes subtitles, PATCHes photos and POSTs
// `/regenerate` against the test database. It captures the original subtitle
// payload in `beforeAll` and restores it in `afterAll` (clearing the
// per-reel override with PATCH cues=null), so the fixture stays usable for
// follow-up audits.
//
// Skipped unless `RUN_INTEGRATION_SMOKE=1` is set, so a stray
// `npm run test:e2e` cannot mutate the live test environment.

import { test, expect } from '@playwright/test';

const LIVE_BACKEND_ORIGIN = 'https://4reelsback-test.4property.com';

// Seeded `Test` agency reel in `awaiting_review` (editable; 13 photos,
// 8 subtitle cues). 671530 is the other known reel but skipped (workflow
// state).
const REEL_SITE_ID = 'dev76.designbricks.ie';
const REEL_PROPERTY_ID = '677148';
const GHL_LOCATION_ID = 'v8H1XNB3YCQmVHRhqDoM';
const GHL_USER_ID = 'manual';

const FRONTEND_ORIGIN = 'http://127.0.0.1';
const SMOKE_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const SMOKE_TAG = `INTEGRATION SMOKE ${SMOKE_TIMESTAMP}`;

test.use({ baseURL: FRONTEND_ORIGIN });

test.describe.serial('integration smoke — pipeline e2e (read-write)', () => {
  test.skip(
    !process.env.RUN_INTEGRATION_SMOKE,
    'Live read-write smoke — set RUN_INTEGRATION_SMOKE=1 to run.',
  );

  // Test-shared state across the serial steps.
  const ctx = {
    agencyToken: '',
    agencyId: '',
    originalCues: null,
    originalPhotos: null,
    networkLog: [],
    consoleErrors: [],
  };

  test.beforeAll(async ({ request }) => {
    // 1. Bootstrap an agency token via the GHL session exchange — same call
    //    SessionProvider makes from the browser.
    const sessionResp = await request.post(
      `${LIVE_BACKEND_ORIGIN}/v1/sessions/gohighlevel/session`,
      {
        data: { location_id: GHL_LOCATION_ID, user_id: GHL_USER_ID },
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(sessionResp.status(), 'GHL session exchange').toBe(200);
    const session = await sessionResp.json();
    expect(session.connected).toBe(true);
    ctx.agencyToken = session.agency_token;
    ctx.agencyId = session.agency_id;
    expect(ctx.agencyToken).toBeTruthy();

    // 2. Snapshot the reel BEFORE the smoke so we can revert cleanly.
    const reelResp = await request.get(
      `${LIVE_BACKEND_ORIGIN}/v1/admin/agencies/${ctx.agencyId}/reels/${REEL_SITE_ID}/${REEL_PROPERTY_ID}`,
      { headers: { Authorization: `Bearer ${ctx.agencyToken}` } },
    );
    expect(reelResp.status(), 'reel detail GET').toBe(200);
    const reelEnvelope = await reelResp.json();
    const reel = reelEnvelope.reel || reelEnvelope;
    // `subtitles_override` / `photos_override` may be absent (NULL in DB) —
    // that's fine, we simply clear the override on cleanup.
    ctx.originalCues = Array.isArray(reel.subtitles_override)
      ? reel.subtitles_override.map((c) => ({ ...c }))
      : null;
    ctx.originalPhotos = Array.isArray(reel.photos_override)
      ? reel.photos_override.map((p) => ({ ...p }))
      : null;
    console.log(
      `[smoke] beforeAll: agency=${ctx.agencyId.slice(0, 8)}… reel render_status=${reel.render_status} workflow_state=${reel.workflow_state} override_cues=${ctx.originalCues ? ctx.originalCues.length : 'null'} override_photos=${ctx.originalPhotos ? ctx.originalPhotos.length : 'null'}`,
    );
  });

  test.afterAll(async ({ request }) => {
    if (!ctx.agencyToken) return;
    const headers = {
      Authorization: `Bearer ${ctx.agencyToken}`,
      'Content-Type': 'application/json',
    };
    // Revert subtitles: PATCH `cues: null` clears the per-reel override
    // and the next render falls back to the AI-generated snapshot. If the
    // beforeAll captured a non-null override, restore it verbatim.
    const subsBody =
      ctx.originalCues === null ? { cues: null } : { cues: ctx.originalCues };
    try {
      const resp = await request.patch(
        `${LIVE_BACKEND_ORIGIN}/v1/admin/agencies/${ctx.agencyId}/reels/${REEL_SITE_ID}/${REEL_PROPERTY_ID}/subtitles`,
        { data: subsBody, headers },
      );
      if (resp.status() !== 200) {
        console.error(
          `[smoke] afterAll FAILED to revert subtitles: HTTP ${resp.status()} — ${await resp.text()}`,
        );
      } else {
        console.log('[smoke] afterAll: subtitles override reverted');
      }
    } catch (err) {
      console.error(`[smoke] afterAll EXCEPTION reverting subtitles: ${err}`);
    }
    // Revert photos: same pattern. Step C reordered tiles in-place via
    // drag-and-drop and persisted a `photos_override`; restoring to the
    // original snapshot (likely null) clears it so the fixture is reusable.
    const photosBody =
      ctx.originalPhotos === null
        ? { photos: null }
        : { photos: ctx.originalPhotos };
    try {
      const resp = await request.patch(
        `${LIVE_BACKEND_ORIGIN}/v1/admin/agencies/${ctx.agencyId}/reels/${REEL_SITE_ID}/${REEL_PROPERTY_ID}/photos`,
        { data: photosBody, headers },
      );
      if (resp.status() !== 200) {
        console.error(
          `[smoke] afterAll FAILED to revert photos: HTTP ${resp.status()} — ${await resp.text()}`,
        );
      } else {
        console.log('[smoke] afterAll: photos override reverted');
      }
    } catch (err) {
      console.error(`[smoke] afterAll EXCEPTION reverting photos: ${err}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    // NB: `ctx.networkLog` and `ctx.consoleErrors` are intentionally NOT
    // reset between steps — the serial smoke wants a cumulative log so
    // the final report can see every mutation the pipeline saw.
    page.on('console', (msg) => {
      if (msg.type() === 'error') ctx.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) =>
      ctx.consoleErrors.push(`pageerror: ${err.message}`),
    );
    page.on('response', async (resp) => {
      const url = resp.url();
      const method = resp.request().method();
      if (
        url.startsWith(LIVE_BACKEND_ORIGIN) &&
        (method === 'PATCH' || method === 'POST')
      ) {
        ctx.networkLog.push({
          method,
          url: url.replace(LIVE_BACKEND_ORIGIN, ''),
          status: resp.status(),
        });
      }
    });

    // Seed GHL MVP context BEFORE any script runs so SessionProvider
    // auto-connects against the live backend instead of showing the
    // connect gate.
    await page.addInitScript(
      ({ locationId, userId }) => {
        window.localStorage.setItem(
          '4reels.ghlMvpContext',
          JSON.stringify({
            source: 'integration-smoke',
            userId,
            locationId,
            userName: 'Smoke Bot',
            email: 'smoke@example.com',
            encryptedContextOnly: false,
            userFallback: false,
          }),
        );
      },
      { locationId: GHL_LOCATION_ID, userId: GHL_USER_ID },
    );
  });

  test('A — reels list renders with pagination (feature 32)', async ({
    page,
  }) => {
    await page.goto('/reels');
    await expect(page.getByRole('heading', { name: /Reels/ })).toBeVisible({
      timeout: 20_000,
    });
    // Pagination summary is the feature-32 marker.
    await expect(page.getByTestId('reels-pagination-summary')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel('Rows per page')).toBeVisible();
    await expect(page.getByLabel('Filter by workflow state')).toBeVisible();
    await expect(page.getByLabel('Filter by publish status')).toBeVisible();
    await expect(page.getByLabel('Search reels')).toBeVisible();
  });

  test('B — subtitles cue 0 edit triggers PATCH + Re-rendering badge (feature 36)', async ({
    page,
  }) => {
    await page.goto(`/reels/${REEL_SITE_ID}/${REEL_PROPERTY_ID}`);
    await expect(page.locator('.editor-overlay')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /^Subtitles/ }).click();
    const subsTab = page.locator('[data-testid="subtitles-tab"]');
    await expect(subsTab).toBeVisible();
    const cue0 = page.locator('[data-testid="subtitle-text-0"]');
    await expect(cue0).toBeVisible();

    // Edit cue 0 — character-by-character so React's controlled input fires
    // an onChange per keystroke and the debounce coalesces them.
    await cue0.click();
    await cue0.fill(SMOKE_TAG);

    // Wait for the 1s auto-save debounce + grace.
    await page.waitForTimeout(2_000);

    // The PATCH must have landed with 200.
    const subPatches = ctx.networkLog.filter(
      (r) => r.method === 'PATCH' && /\/subtitles$/.test(r.url),
    );
    expect(
      subPatches.length,
      `expected ≥1 PATCH /subtitles, got ${subPatches.length}. log=${JSON.stringify(ctx.networkLog)}`,
    ).toBeGreaterThanOrEqual(1);
    expect(subPatches[subPatches.length - 1].status).toBe(200);

    // The "Re-rendering…" badge surfaces after a successful PATCH.
    await expect(
      page.locator('[data-testid="subtitles-rerender-badge"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('C — photos drag-and-drop triggers PATCH (feature 35)', async ({
    page,
  }) => {
    await page.goto(`/reels/${REEL_SITE_ID}/${REEL_PROPERTY_ID}`);
    await expect(page.locator('.editor-overlay')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /^Photos/ }).click();
    await expect(page.locator('[data-testid="photos-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="photos-grid"]')).toBeVisible();
    // Need at least 2 tiles to reorder.
    await expect
      .poll(() => page.locator('[data-testid^="photo-tile-"]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(1);

    const tile0 = page.locator('[data-testid="photo-tile-0"]');
    const tile1 = page.locator('[data-testid="photo-tile-1"]');
    await expect(tile0).toBeVisible();
    await expect(tile1).toBeVisible();

    // Native HTML5 drag-and-drop. Playwright's `dragTo` synthesizes
    // dragstart / dragover / drop events on the source / target.
    await tile0.dragTo(tile1);

    // Photos debounce is 500ms; allow grace.
    await page.waitForTimeout(1_500);

    const photoPatches = ctx.networkLog.filter(
      (r) => r.method === 'PATCH' && /\/photos$/.test(r.url),
    );
    expect(
      photoPatches.length,
      `expected ≥1 PATCH /photos, got ${photoPatches.length}. log=${JSON.stringify(ctx.networkLog)}`,
    ).toBeGreaterThanOrEqual(1);
    expect(photoPatches[photoPatches.length - 1].status).toBe(200);
  });

  test('D — manual re-render: POST /regenerate accepted or 409 in-flight (feature 40)', async ({
    page,
  }) => {
    await page.goto(`/reels/${REEL_SITE_ID}/${REEL_PROPERTY_ID}`);
    await expect(page.locator('.editor-overlay')).toBeVisible({ timeout: 20_000 });

    const button = page.locator('[data-testid="regenerate-reel-button"]');
    // RegenerateReelButton has three states relevant here:
    //   (a) hidden  — render_status not in {completed, done} AND not rerendering.
    //   (b) visible-but-disabled — rerendering=true (render in flight). This
    //       is the realistic state after smokes B + C; treat as healthy
    //       (badge surfaces the same signal).
    //   (c) visible-and-enabled — reel idle; we can actually fire the click.
    const buttonVisible = await button
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!buttonVisible) {
      // Branch (a): button never appeared — assert the in-flight badge instead.
      await expect(
        page
          .locator(
            '[data-testid="regenerate-rerender-badge"], [data-testid="subtitles-rerender-badge"], [data-testid="photos-rerender-badge"]',
          )
          .first(),
      ).toBeVisible();
      console.log(
        '[smoke] D: regenerate button hidden (render in flight); badge visible — accepting as healthy.',
      );
      return;
    }

    const isDisabled = await button.isDisabled();
    if (isDisabled) {
      // Branch (b): disabled because a render is already pending. The badge
      // is the user-facing signal; the manual-trigger UI is correctly
      // gating duplicate enqueues.
      await expect(
        page
          .locator(
            '[data-testid="regenerate-rerender-badge"], [data-testid="subtitles-rerender-badge"], [data-testid="photos-rerender-badge"]',
          )
          .first(),
      ).toBeVisible();
      console.log(
        '[smoke] D: regenerate button visible but disabled (render in flight); badge visible — accepting as healthy.',
      );
      return;
    }

    // Branch (c): button is enabled — exercise the full confirm-modal flow.
    await button.click();
    const modal = page.locator('[data-testid="regenerate-confirm-modal"]');
    await expect(modal).toBeVisible();
    await page.locator('[data-testid="regenerate-confirm"]').click();

    // Wait for the POST to land.
    await expect
      .poll(
        () =>
          ctx.networkLog.filter(
            (r) => r.method === 'POST' && /\/regenerate$/.test(r.url),
          ).length,
        { timeout: 5_000 },
      )
      .toBeGreaterThanOrEqual(1);

    const regen = ctx.networkLog
      .filter((r) => r.method === 'POST' && /\/regenerate$/.test(r.url))
      .pop();
    expect([200, 409]).toContain(regen.status);

    if (regen.status === 200) {
      await expect(
        page.locator('[data-testid="regenerate-rerender-badge"]'),
      ).toBeVisible({ timeout: 5_000 });
    } else {
      // 409 ALREADY_IN_FLIGHT → toast surfaces.
      await expect(page.locator('[data-testid="toast-error"]')).toContainText(
        /already in progress/i,
        { timeout: 5_000 },
      );
    }
  });

  test('E — backend reflects pending or completed state', async ({ page }) => {
    // Use the agency token captured in beforeAll to fetch the reel detail and
    // verify the render_status / workflow_state are coherent.
    const reel = await page.evaluate(
      async ({ origin, agencyId, siteId, propertyId, token }) => {
        const resp = await fetch(
          `${origin}/v1/admin/agencies/${agencyId}/reels/${siteId}/${propertyId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return { status: resp.status, body: await resp.json() };
      },
      {
        origin: LIVE_BACKEND_ORIGIN,
        agencyId: ctx.agencyId,
        siteId: REEL_SITE_ID,
        propertyId: REEL_PROPERTY_ID,
        token: ctx.agencyToken,
      },
    );
    expect(reel.status).toBe(200);
    const reelObj = reel.body.reel || reel.body;
    // After the smoke steps, render_status should be either `pending`
    // (worker still busy) or `completed` (worker already drained). Anything
    // else points to a pipeline regression.
    expect(['pending', 'completed', 'done']).toContain(reelObj.render_status);
    // workflow_state must NOT have flipped to approved/published or
    // schedule/queued/sent — the smoke is read-write but never approves.
    // The worker cycles the reel through `ingested` → `assets_prepared` →
    // `awaiting_review` during a render, and any of those is healthy.
    // `failed` is also tolerable (it means a render failed and the worker
    // surfaced an error — independent of this smoke).
    expect(reelObj.workflow_state).not.toMatch(
      /^(approved|published|scheduled|queued)$/,
    );
    console.log(
      `[smoke] E: post-smoke render_status=${reelObj.render_status} workflow_state=${reelObj.workflow_state}`,
    );

    // Surface any console errors observed across the spec.
    if (ctx.consoleErrors.length > 0) {
      console.warn(
        `[smoke] console errors observed (${ctx.consoleErrors.length}):\n  ` +
          ctx.consoleErrors.slice(0, 10).join('\n  '),
      );
    }
    // Final network summary for the report.
    console.log(
      `[smoke] network log (${ctx.networkLog.length} mutations):\n  ` +
        ctx.networkLog
          .map((r) => `${r.method} ${r.status} ${r.url}`)
          .join('\n  '),
    );
  });
});
