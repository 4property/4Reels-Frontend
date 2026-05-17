/**
 * Tiny in-test stub for the live backend.
 *
 * The frontend now talks to `VITE_MVP_API_URL` directly — there is no
 * in-app mock layer to lean on. This helper installs Playwright
 * `page.route()` interceptors so each test can serve deterministic
 * responses for the agency admin endpoints + the GHL session.
 *
 * Usage:
 *   await installMockBackend(page);                  // empty world
 *   await installMockBackend(page, { agencies });    // seeded world
 */

import {
  ALLOWED_SOCIAL_TEMPLATE_VARIABLES,
  HASHTAG_PATTERN,
  MAX_HASHTAGS_PER_PLATFORM,
  SOCIAL_TEMPLATE_VARIABLE_PATTERN,
} from '../../src/features/social/constants.js';

export const SAMPLE_AGENCY_ID = '00000000-0000-0000-0000-000000000001';

export const SAMPLE_AGENCY = {
  agency_id: SAMPLE_AGENCY_ID,
  name: 'CKP Estate Agents',
  slug: 'ckp',
  timezone: 'Europe/Dublin',
  status: 'active',
  source_count: 1,
  sources: [
    {
      wordpress_source_id: '11111111-1111-1111-1111-111111111111',
      site_id: 'ckp.ie',
      name: 'CKP',
      site_url: 'https://ckp.ie',
      normalized_host: 'ckp.ie',
      status: 'active',
      has_webhook_secret: true,
      last_event_at: '2026-04-29T08:00:00Z',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-29T08:00:00Z',
      agency: {
        agency_id: SAMPLE_AGENCY_ID,
        name: 'CKP Estate Agents',
        slug: 'ckp',
        timezone: 'Europe/Dublin',
        status: 'active',
      },
    },
  ],
  ghl_connection: {
    connection_id: 'gc-1',
    agency_id: SAMPLE_AGENCY_ID,
    location_id: 'v8H1XNB3YCQmVHRhqDoM',
    user_id: 'manual',
    has_access_token: true,
    has_refresh_token: false,
    expires_at: '',
    status: 'active',
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-29T08:00:00Z',
  },
  reel_profile: null,
};

const DEFAULT_RESPONSES = {
  '/v1/admin/agencies': { items: [], count: 0 },
  '/v1/sessions/gohighlevel/session': {
    ok: true,
    location_id: '',
    user_id: '',
    connected: false,
    has_token: false,
    agency_id: null,
  },
};

// 2026-05-07T12:00:00Z + 1h. Fixed expiration so tests are
// deterministic; the front doesn't validate the date today, it just
// stores it as token metadata.
const TEST_AGENCY_TOKEN_EXPIRES_AT = '2026-05-07T13:00:00Z';

/**
 * Install network mocks. Pass `{ agencies: [SAMPLE_AGENCY] }` to seed the
 * super-admin landing page.
 *
 * The helper also stubs:
 *   - GET /v1/admin/agencies/{id} (when agency exists)
 *   - GET /v1/admin/agencies/{id}/reels with []
 *   - GET /v1/admin/agencies/{id}/social-accounts with `connected: false`
 *   - CRUD /v1/admin/agencies/{id}/music with the backend music contract
 *   - POST /v1/sessions/gohighlevel/session bound to the given agency
 */
export async function installMockBackend(page, options = {}) {
  const agencies = options.agencies || [];
  const ghlSession = options.ghlSession || null;
  const reelsByAgency = new Map();
  for (const agency of agencies) {
    const seededReels =
      options.reelsByAgency?.[agency.agency_id] ||
      options.reels ||
      [];
    reelsByAgency.set(agency.agency_id, seededReels);
  }
  const musicByAgency = new Map(
    agencies.map((agency) => [
      agency.agency_id,
      (options.musicTracks || defaultMusicTracks(agency.agency_id)).map((track) => ({
        ...track,
        agency_id: agency.agency_id,
      })),
    ]),
  );
  let nextMusicId = 1;

  await page.route(/\/v1\/admin\/agencies(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(
      jsonResponse({ items: agencies, count: agencies.length }),
    );
  });

  await page.route(/\/v1\/admin\/agencies\/[^/?]+(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const agencyId = extractAgencyId(route.request().url());
    const agency = agencies.find((a) => a.agency_id === agencyId);
    if (!agency) {
      return route.fulfill(jsonResponse({ error: 'Not found' }, 404));
    }
    return route.fulfill(jsonResponse(agency));
  });

  // Feature 32: paginated + filtered list.
  //   GET /v1/admin/agencies/{id}/reels
  //     ?page=&page_size=&workflow_state=&publish_status=&q=
  //   → { items, count_total, page, page_size, has_more, count }
  //
  //   `count = len(items)` is a legacy alias preserved for backcompat with the
  //   pre-32 shape. `workflow_state` / `publish_status` accept either a single
  //   value or a comma-joined list (multi-select). `q` is searched
  //   case-insensitively over title, slug AND source_property_id, mirroring
  //   the backend feature 32 spec ("search server-side over title, slug, AND
  //   property reference").
  await page.route(/\/v1\/admin\/agencies\/[^/]+\/reels(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const agencyId = extractAgencyId(url.toString());
    const all = reelsByAgency.get(agencyId) || [];

    const workflowStateFilter = parseCsv(url.searchParams.get('workflow_state'));
    const publishStatusFilter = parseCsv(url.searchParams.get('publish_status'));
    const qRaw = (url.searchParams.get('q') || '').trim();
    const q = qRaw.toLowerCase();

    const filtered = all.filter((item) => {
      if (
        workflowStateFilter.length &&
        !workflowStateFilter.includes(String(item.workflow_state || ''))
      ) {
        return false;
      }
      if (
        publishStatusFilter.length &&
        !publishStatusFilter.includes(String(item.publish_status || ''))
      ) {
        return false;
      }
      if (q) {
        const haystack = [
          item.title || '',
          item.slug || '',
          item.source_property_id == null ? '' : String(item.source_property_id),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const pageSize = parsePositiveInt(url.searchParams.get('page_size'), 25);
    const offset = (page - 1) * pageSize;
    const slice = filtered.slice(offset, offset + pageSize);
    const countTotal = filtered.length;
    const hasMore = offset + slice.length < countTotal;

    return route.fulfill(
      jsonResponse({
        items: slice,
        count_total: countTotal,
        page,
        page_size: pageSize,
        has_more: hasMore,
        count: slice.length,
      }),
    );
  });

  // Individual reel endpoints: GET the joined property row, the images list,
  // and the approve / reject mutations. The approve handler echoes a
  // `scheduled_at` (ISO8601 UTC). Tests can opt-in by:
  //   - Passing `approveScheduledAt: "2026-05-15T09:00:00Z"` (string or null).
  //   - Pre-seeding automation rules via `automationRulesByAgency` so the
  //     handler computes the slot from the rules + the page clock
  //     (mirrors back's compute_next_publish_slot — hold/skip/quiet only).
  const approveScheduledAtOption =
    options.approveScheduledAt === undefined ? null : options.approveScheduledAt;
  const approveIdempotentReplay = Boolean(options.approveIdempotentReplay);
  const automationByAgency = new Map();
  const agencyTimezoneById = new Map(
    agencies.map((agency) => [agency.agency_id, agency.timezone || 'UTC']),
  );
  if (options.automationRulesByAgency) {
    for (const [aid, rules] of Object.entries(options.automationRulesByAgency)) {
      automationByAgency.set(aid, normaliseAutomationRules(rules));
    }
  }

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/(approve|reject)(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.fallback();
      const url = new URL(request.url());
      const isApprove = url.pathname.endsWith('/approve');
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const body = {
        status: isApprove ? 'approved' : 'rejected',
        agency_id: agencyId,
        site_id: reelPath.siteId,
        source_property_id: reelPath.sourcePropertyId,
      };
      if (isApprove) {
        body.idempotent_replay = approveIdempotentReplay;
        if (approveScheduledAtOption !== null || !automationByAgency.has(agencyId)) {
          body.scheduled_at = approveScheduledAtOption;
        } else {
          const rules = automationByAgency.get(agencyId);
          const tz = agencyTimezoneById.get(agencyId) || 'UTC';
          const now = await pageNow(request);
          body.scheduled_at = computeMockScheduledAt(rules, now, tz);
        }
      }
      return route.fulfill(jsonResponse(body));
    },
  );

  // Feature 40: POST /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/regenerate
  //
  // Body: `{}` or `{ reason: string }`   (Pydantic-style extra='forbid' on the
  // wrapper; only `reason` is accepted on top-level).
  //
  // Happy: 200 { render_status: 'pending', job_id: string, queued_at: ISO8601 }.
  //        The mock flips `render_status` back to `'done'` after ~400 ms so
  //        the editor's poll surfaces the badge cleared without a real worker.
  //
  // 409 REGENERATE_PUBLISHED_FORBIDDEN  — reel.publish_status === 'published'.
  // 409 REGENERATE_ALREADY_IN_FLIGHT    — reel `_rerendering` flag already set.
  // 404 ADMIN_REEL_NOT_FOUND            — reel tuple unknown for this agency.
  let nextRegenerateJob = 1;
  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/regenerate(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.fallback();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const body = parseJsonBody(request);

      // extra='forbid' on the wrapper — back accepts only `reason`.
      const allowedKeys = new Set(['reason']);
      for (const key of Object.keys(body || {})) {
        if (!allowedKeys.has(key)) {
          return route.fulfill(jsonResponse(extraForbiddenError(key), 422));
        }
      }

      const reels = reelsByAgency.get(agencyId) || [];
      const idx = reels.findIndex(
        (item) =>
          item.site_id === reelPath.siteId &&
          String(item.source_property_id) === String(reelPath.sourcePropertyId),
      );
      if (idx === -1) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'ADMIN_REEL_NOT_FOUND',
              message: 'No reel matches that tuple',
            },
            404,
          ),
        );
      }
      const match = reels[idx];
      if (match.publish_status === 'published') {
        return route.fulfill(
          jsonResponse(
            {
              error: 'REGENERATE_PUBLISHED_FORBIDDEN',
              message: 'Cannot re-render a published reel',
            },
            409,
          ),
        );
      }
      if (match._rerendering === true) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'REGENERATE_ALREADY_IN_FLIGHT',
              message: 'A render is already in progress for this reel',
            },
            409,
          ),
        );
      }

      // Bump render_status to 'pending' and mark the in-flight flag; flip
      // both back after ~400 ms (same shape as the photos/subtitles/slides
      // handlers, slightly longer so the editor's 1.5 s poll has time to
      // catch the 'pending' state at least once).
      reels[idx] = {
        ...match,
        render_status: 'pending',
        _rerendering: true,
      };
      setTimeout(() => {
        const current = reels[idx];
        if (current && current._rerendering === true) {
          reels[idx] = { ...current, render_status: 'done', _rerendering: false };
        }
      }, 400);

      const jobId = `mock-render-job-${nextRegenerateJob++}`;
      return route.fulfill(
        jsonResponse({
          render_status: 'pending',
          job_id: jobId,
          queued_at: new Date().toISOString(),
        }),
      );
    },
  );

  // Feature 21: per-agency enabled-platforms whitelist used to validate the
  // PATCH .../descriptions payload. Tests can override via
  // `enabledPlatformsByAgency: { [agencyId]: ['instagram', ...] }`. When a
  // reel's agency has no explicit whitelist we accept every known platform
  // so existing specs keep passing.
  const enabledPlatformsByAgency = new Map();
  if (options.enabledPlatformsByAgency) {
    for (const [aid, platforms] of Object.entries(
      options.enabledPlatformsByAgency,
    )) {
      enabledPlatformsByAgency.set(aid, new Set(platforms || []));
    }
  }
  const KNOWN_PLATFORMS = new Set([
    'instagram',
    'tiktok',
    'youtube',
    'facebook',
    'linkedin',
    'gbp',
    'gmb',
    'pinterest',
  ]);
  const EDITABLE_PUBLISH_STATUSES = new Set([
    '',
    'pending',
    'pending_review',
    'needs-approval',
  ]);

  // Feature 21: PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/descriptions
  //
  // Replace semantics: the body's `descriptions_by_platform` map is what
  // ends up persisted in `reel.descriptions_override`. An empty `{}`
  // clears the override (back persists SQL NULL; the mock stores `null` so
  // subsequent GETs no longer include the key).
  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/descriptions(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'PATCH') return route.fallback();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const body = parseJsonBody(request);

      // Pydantic-style extra='forbid' on the top-level object.
      const allowedKeys = new Set(['descriptions_by_platform']);
      for (const key of Object.keys(body)) {
        if (!allowedKeys.has(key)) {
          return route.fulfill(jsonResponse(extraForbiddenError(key), 422));
        }
      }
      const map = body.descriptions_by_platform;
      if (map !== undefined && map !== null && typeof map !== 'object') {
        return route.fulfill(
          jsonResponse(
            {
              detail: [
                {
                  loc: ['body', 'descriptions_by_platform'],
                  msg: 'Input should be a valid dictionary',
                  type: 'dict_type',
                },
              ],
            },
            422,
          ),
        );
      }

      const reels = reelsByAgency.get(agencyId) || [];
      const idx = reels.findIndex(
        (item) =>
          item.site_id === reelPath.siteId &&
          String(item.source_property_id) === String(reelPath.sourcePropertyId),
      );
      if (idx === -1) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'ADMIN_REEL_NOT_FOUND',
              message: 'No reel matches that tuple',
            },
            404,
          ),
        );
      }
      const match = reels[idx];
      if (!EDITABLE_PUBLISH_STATUSES.has(String(match.publish_status || ''))) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'REEL_NOT_EDITABLE',
              message:
                'Descriptions cannot be edited once the reel is approved or published.',
            },
            409,
          ),
        );
      }
      const enabled = enabledPlatformsByAgency.has(agencyId)
        ? enabledPlatformsByAgency.get(agencyId)
        : KNOWN_PLATFORMS;
      for (const platform of Object.keys(map || {})) {
        if (!enabled.has(platform)) {
          return route.fulfill(
            jsonResponse(
              {
                error: 'PLATFORM_NOT_ENABLED',
                message: `Platform ${platform} is not enabled for this agency.`,
                details: { platform },
              },
              422,
            ),
          );
        }
      }

      const normalized =
        !map || Object.keys(map).length === 0 ? null : { ...map };
      reels[idx] = { ...match, descriptions_override: normalized };

      return route.fulfill(
        jsonResponse({
          status: 'saved',
          agency_id: agencyId,
          site_id: reelPath.siteId,
          source_property_id: reelPath.sourcePropertyId,
          descriptions_override: normalized,
        }),
      );
    },
  );

  // Feature 25: PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/music
  //
  // Body: { music_id: <string|null> }   (Pydantic extra='forbid')
  // Happy: 200 { status: 'saved', reel_id, music_id } — also mutates the
  // mock-state reel so subsequent GETs surface the new override.
  // 404 ADMIN_REEL_NOT_FOUND          — the reel tuple is unknown.
  // 404 ADMIN_MUSIC_TRACK_NOT_FOUND   — the music_id isn't in the agency
  //                                     library (cross-agency collapses
  //                                     here too, per the back contract).
  // 409 REEL_NOT_EDITABLE             — publish_status outside the editable
  //                                     gate { '', 'pending', 'pending_review',
  //                                     'needs-approval' }.
  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/music(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'PATCH') return route.fallback();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const body = parseJsonBody(request);

      // extra='forbid' on the top-level object — back accepts a single key.
      const allowedKeys = new Set(['music_id']);
      for (const key of Object.keys(body)) {
        if (!allowedKeys.has(key)) {
          return route.fulfill(jsonResponse(extraForbiddenError(key), 422));
        }
      }

      const rawMusicId = body.music_id;
      const musicId =
        rawMusicId === undefined || rawMusicId === null || rawMusicId === ''
          ? null
          : String(rawMusicId);

      const reels = reelsByAgency.get(agencyId) || [];
      const idx = reels.findIndex(
        (item) =>
          item.site_id === reelPath.siteId &&
          String(item.source_property_id) === String(reelPath.sourcePropertyId),
      );
      if (idx === -1) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'ADMIN_REEL_NOT_FOUND',
              message: 'No reel matches that tuple',
            },
            404,
          ),
        );
      }
      const match = reels[idx];
      if (!EDITABLE_PUBLISH_STATUSES.has(String(match.publish_status || ''))) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'REEL_NOT_EDITABLE',
              message:
                'Music track cannot be changed once the reel is approved or published.',
            },
            409,
          ),
        );
      }

      if (musicId !== null) {
        const items = getAgencyMusic(musicByAgency, agencyId);
        const track = items.find((item) => item.music_id === musicId);
        if (!track) {
          return route.fulfill(
            jsonResponse(
              {
                error: 'ADMIN_MUSIC_TRACK_NOT_FOUND',
                message: 'Music track is not available for this agency.',
              },
              404,
            ),
          );
        }
      }

      // Persist the override in mock state (and the denormalised label so
      // the subsequent GET surfaces the same shape the back returns).
      const items = getAgencyMusic(musicByAgency, agencyId);
      const denorm = musicId
        ? items.find((item) => item.music_id === musicId) || null
        : null;
      reels[idx] = {
        ...match,
        music_track_id: musicId,
        music: denorm
          ? {
              music_id: denorm.music_id,
              display_name: denorm.display_name,
            }
          : null,
      };

      const reelId =
        match.reel_id ||
        `${reelPath.siteId}:${reelPath.sourcePropertyId}`;
      return route.fulfill(
        jsonResponse({
          status: 'saved',
          reel_id: reelId,
          music_id: musicId,
        }),
      );
    },
  );

  // Feature 35: PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/photos
  //
  // Body: { photos: [{position:int, selected:bool}, ...] | null }   (extra='forbid')
  //   - `null` (or `[]`) clears the override.
  //   - Pydantic-style extra='forbid' on the top-level body: only `photos`.
  //
  // Happy: 200 { photos_override, render_status: 'pending' }.
  //        The mock flips render_status back to 'done' after ~200 ms so a
  //        subsequent GET surfaces the badge cleared. The intermediate
  //        'pending' value lets the editor render the "Re-rendering…" badge
  //        in E2E without a real worker.
  //
  // 409 PHOTOS_OVERRIDE_LOCKED — reel.workflow_state ∈ {approved, published}.
  // 404 ADMIN_REEL_NOT_FOUND   — reel tuple unknown for this agency.
  const LOCKED_WORKFLOW_STATES = new Set(['approved', 'published']);
  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/photos(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'PATCH') return route.fallback();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const body = parseJsonBody(request);

      // extra='forbid' on the wrapper — back accepts a single key.
      const allowedKeys = new Set(['photos']);
      for (const key of Object.keys(body)) {
        if (!allowedKeys.has(key)) {
          return route.fulfill(jsonResponse(extraForbiddenError(key), 422));
        }
      }

      const rawPhotos = body.photos;
      // `null` and `[]` both clear the override per the back contract.
      let normalised = null;
      if (Array.isArray(rawPhotos)) {
        // Item-level validation mirrors Pydantic on the back: each item must
        // be `{position:int, selected:bool}`.
        for (let i = 0; i < rawPhotos.length; i += 1) {
          const item = rawPhotos[i];
          if (
            !item ||
            typeof item !== 'object' ||
            typeof item.position !== 'number' ||
            typeof item.selected !== 'boolean'
          ) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'photos', i],
                      msg: 'Each photo must be { position:int, selected:bool }.',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
        }
        normalised = rawPhotos.length === 0 ? null : rawPhotos.map((p) => ({
          position: p.position,
          selected: p.selected,
        }));
      } else if (rawPhotos !== null && rawPhotos !== undefined) {
        return route.fulfill(
          jsonResponse(
            {
              detail: [
                {
                  loc: ['body', 'photos'],
                  msg: 'Input should be a valid list or null',
                  type: 'list_type',
                },
              ],
            },
            422,
          ),
        );
      }

      const reels = reelsByAgency.get(agencyId) || [];
      const idx = reels.findIndex(
        (item) =>
          item.site_id === reelPath.siteId &&
          String(item.source_property_id) === String(reelPath.sourcePropertyId),
      );
      if (idx === -1) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'ADMIN_REEL_NOT_FOUND',
              message: 'No reel matches that tuple',
            },
            404,
          ),
        );
      }
      const match = reels[idx];
      if (
        LOCKED_WORKFLOW_STATES.has(String(match.workflow_state || '')) ||
        match.publish_status === 'published'
      ) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'PHOTOS_OVERRIDE_LOCKED',
              message:
                'Cannot edit a reel that has already been approved',
            },
            409,
          ),
        );
      }

      // Persist override + bump render_status to 'pending'; the worker (or
      // mock equivalent) flips it back to 'done' shortly after.
      reels[idx] = {
        ...match,
        photos_override: normalised,
        render_status: 'pending',
      };
      setTimeout(() => {
        const current = reels[idx];
        if (current && current.render_status === 'pending') {
          reels[idx] = { ...current, render_status: 'done' };
        }
      }, 200);

      return route.fulfill(
        jsonResponse({
          photos_override: normalised,
          render_status: 'pending',
        }),
      );
    },
  );

  // Feature 36: PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/subtitles
  //
  // Body: { cues: [{index:int, text:str, in_seconds:float,
  //                  out_seconds:float}, ...] | null }   (extra='forbid')
  //   - `null` (or `[]`) clears the override.
  //   - Pydantic-style extra='forbid' on the top-level body: only `cues`.
  //   - Per-item validation mirrors the back (in>=0, out>in, no overlap,
  //     1<=len(text)<=200, unique monotonic indices). The mock returns the
  //     same 422 detail shape the back emits so the front can rely on the
  //     `detail[].msg` strings.
  //
  // Happy: 200 { subtitles_override, render_status: 'pending' }.
  //        The mock flips render_status back to 'done' after ~200 ms so a
  //        subsequent GET surfaces the badge cleared.
  //
  // 409 SUBTITLES_OVERRIDE_LOCKED — reel.workflow_state ∈ {approved, published}.
  // 404 ADMIN_REEL_NOT_FOUND      — reel tuple unknown for this agency.
  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/subtitles(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'PATCH') return route.fallback();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const body = parseJsonBody(request);

      const allowedKeys = new Set(['cues']);
      for (const key of Object.keys(body)) {
        if (!allowedKeys.has(key)) {
          return route.fulfill(jsonResponse(extraForbiddenError(key), 422));
        }
      }

      const rawCues = body.cues;
      let normalised = null;
      if (Array.isArray(rawCues)) {
        for (let i = 0; i < rawCues.length; i += 1) {
          const item = rawCues[i];
          if (
            !item ||
            typeof item !== 'object' ||
            typeof item.index !== 'number' ||
            typeof item.text !== 'string' ||
            typeof item.in_seconds !== 'number' ||
            typeof item.out_seconds !== 'number'
          ) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'cues', i],
                      msg:
                        'Each cue must be { index:int, text:str, ' +
                        'in_seconds:float, out_seconds:float }.',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (item.in_seconds < 0) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'cues', i, 'in_seconds'],
                      msg: 'in_seconds must be >= 0',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (item.out_seconds <= item.in_seconds) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'cues', i, 'out_seconds'],
                      msg: 'out_seconds must be > in_seconds',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (item.text.length < 1 || item.text.length > 200) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'cues', i, 'text'],
                      msg: 'text length must be between 1 and 200',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (i > 0) {
            const prev = rawCues[i - 1];
            if (item.in_seconds < prev.out_seconds) {
              return route.fulfill(
                jsonResponse(
                  {
                    detail: [
                      {
                        loc: ['body', 'cues', i],
                        msg: 'cues must not overlap',
                        type: 'value_error',
                      },
                    ],
                  },
                  422,
                ),
              );
            }
            if (item.index <= prev.index) {
              return route.fulfill(
                jsonResponse(
                  {
                    detail: [
                      {
                        loc: ['body', 'cues', i, 'index'],
                        msg: 'indices must be strictly increasing',
                        type: 'value_error',
                      },
                    ],
                  },
                  422,
                ),
              );
            }
          }
        }
        normalised = rawCues.length === 0
          ? null
          : rawCues.map((cue) => ({
              index: cue.index,
              text: cue.text,
              in_seconds: cue.in_seconds,
              out_seconds: cue.out_seconds,
            }));
      } else if (rawCues !== null && rawCues !== undefined) {
        return route.fulfill(
          jsonResponse(
            {
              detail: [
                {
                  loc: ['body', 'cues'],
                  msg: 'Input should be a valid list or null',
                  type: 'list_type',
                },
              ],
            },
            422,
          ),
        );
      }

      const reels = reelsByAgency.get(agencyId) || [];
      const idx = reels.findIndex(
        (item) =>
          item.site_id === reelPath.siteId &&
          String(item.source_property_id) === String(reelPath.sourcePropertyId),
      );
      if (idx === -1) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'ADMIN_REEL_NOT_FOUND',
              message: 'No reel matches that tuple',
            },
            404,
          ),
        );
      }
      const match = reels[idx];
      if (
        LOCKED_WORKFLOW_STATES.has(String(match.workflow_state || '')) ||
        match.publish_status === 'published'
      ) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'SUBTITLES_OVERRIDE_LOCKED',
              message: 'Cannot edit a reel that has already been approved',
            },
            409,
          ),
        );
      }

      reels[idx] = {
        ...match,
        subtitles_override: normalised,
        render_status: 'pending',
      };
      setTimeout(() => {
        const current = reels[idx];
        if (current && current.render_status === 'pending') {
          reels[idx] = { ...current, render_status: 'done' };
        }
      }, 200);

      return route.fulfill(
        jsonResponse({
          subtitles_override: normalised,
          render_status: 'pending',
        }),
      );
    },
  );

  // Feature 37: PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/slides
  //
  // Body: { slides: [{slide_id:str, position:int, duration_seconds:float,
  //                   kind:str, ...kind-specific}, ...] | null }   (extra='forbid')
  //   - `null` (or `[]`) clears the override.
  //   - Pydantic-style extra='forbid' on the top-level body: only `slides`.
  //   - `kind` discriminator drives the kind-specific validation: each kind
  //     has its own required fields (e.g. `text` requires `text`,
  //     `google-review` requires `url` + `status`). Unknown kinds are 422.
  //   - Hard ceiling: sum of durations <= 1.5 * target_duration_seconds.
  //     `target_duration_seconds` comes from the reel record (`30` default).
  //
  // Happy: 200 { manifest_override, render_status: 'pending' }.
  //        The mock flips render_status back to 'done' after ~200 ms so a
  //        subsequent GET surfaces the badge cleared.
  //
  // 409 SLIDES_OVERRIDE_LOCKED — reel.workflow_state ∈ {approved, published}.
  // 404 ADMIN_REEL_NOT_FOUND   — reel tuple unknown for this agency.
  const ALLOWED_SLIDE_KINDS = new Set([
    'intro-video',
    'outro-video',
    'google-review',
    'text',
    'photo',
  ]);
  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/slides(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'PATCH') return route.fallback();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const body = parseJsonBody(request);

      const allowedKeys = new Set(['slides']);
      for (const key of Object.keys(body)) {
        if (!allowedKeys.has(key)) {
          return route.fulfill(jsonResponse(extraForbiddenError(key), 422));
        }
      }

      const reels = reelsByAgency.get(agencyId) || [];
      const idx = reels.findIndex(
        (item) =>
          item.site_id === reelPath.siteId &&
          String(item.source_property_id) === String(reelPath.sourcePropertyId),
      );
      if (idx === -1) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'ADMIN_REEL_NOT_FOUND',
              message: 'No reel matches that tuple',
            },
            404,
          ),
        );
      }
      const match = reels[idx];
      if (
        LOCKED_WORKFLOW_STATES.has(String(match.workflow_state || '')) ||
        match.publish_status === 'published'
      ) {
        return route.fulfill(
          jsonResponse(
            {
              error: 'SLIDES_OVERRIDE_LOCKED',
              message: 'Cannot edit a reel that has already been approved',
            },
            409,
          ),
        );
      }

      const rawSlides = body.slides;
      let normalised = null;
      if (Array.isArray(rawSlides)) {
        let totalDuration = 0;
        for (let i = 0; i < rawSlides.length; i += 1) {
          const slide = rawSlides[i];
          if (
            !slide ||
            typeof slide !== 'object' ||
            typeof slide.slide_id !== 'string' ||
            typeof slide.position !== 'number' ||
            typeof slide.duration_seconds !== 'number' ||
            typeof slide.kind !== 'string'
          ) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'slides', i],
                      msg:
                        'Each slide must be { slide_id:str, position:int, ' +
                        'duration_seconds:float, kind:str, ... }.',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (!ALLOWED_SLIDE_KINDS.has(slide.kind)) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'slides', i, 'kind'],
                      msg: `Unknown slide kind: ${slide.kind}`,
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (slide.duration_seconds <= 0) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'slides', i, 'duration_seconds'],
                      msg: 'duration_seconds must be > 0',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (slide.kind === 'text' && typeof slide.text !== 'string') {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'slides', i, 'text'],
                      msg: 'text slides require a text field',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          if (
            slide.kind === 'google-review' &&
            (typeof slide.url !== 'string' || typeof slide.status !== 'string')
          ) {
            return route.fulfill(
              jsonResponse(
                {
                  detail: [
                    {
                      loc: ['body', 'slides', i],
                      msg: 'google-review slides require url + status fields',
                      type: 'value_error',
                    },
                  ],
                },
                422,
              ),
            );
          }
          totalDuration += slide.duration_seconds;
        }
        const target = Number.isFinite(match.target_duration_seconds)
          ? Number(match.target_duration_seconds)
          : 30;
        if (totalDuration > target * 1.5) {
          return route.fulfill(
            jsonResponse(
              {
                detail: [
                  {
                    loc: ['body', 'slides'],
                    msg:
                      `sum of durations (${totalDuration.toFixed(1)}s) exceeds ` +
                      `1.5x target (${(target * 1.5).toFixed(1)}s)`,
                    type: 'value_error',
                  },
                ],
              },
              422,
            ),
          );
        }
        normalised = rawSlides.length === 0 ? null : rawSlides;
      } else if (rawSlides !== null && rawSlides !== undefined) {
        return route.fulfill(
          jsonResponse(
            {
              detail: [
                {
                  loc: ['body', 'slides'],
                  msg: 'Input should be a valid list or null',
                  type: 'list_type',
                },
              ],
            },
            422,
          ),
        );
      }

      reels[idx] = {
        ...match,
        manifest_override: normalised,
        render_status: 'pending',
      };
      setTimeout(() => {
        const current = reels[idx];
        if (current && current.render_status === 'pending') {
          reels[idx] = { ...current, render_status: 'done' };
        }
      }, 200);

      return route.fulfill(
        jsonResponse({
          manifest_override: normalised,
          render_status: 'pending',
        }),
      );
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+(\/images)?(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.fallback();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const reelPath = extractReelPath(url.toString());
      const reelsForAgency = reelsByAgency.get(agencyId) || [];
      const reelMatch = reelsForAgency.find(
        (item) =>
          item.site_id === reelPath.siteId &&
          String(item.source_property_id) === String(reelPath.sourcePropertyId),
      );
      if (url.pathname.endsWith('/images')) {
        // Feature 35: tests can seed `images: [{position, image_url, has_local_file?}, ...]`
        // on the reel record. Defaults to empty for backward-compat with
        // pre-feature-35 specs that rely on the "no property images" empty
        // state.
        const items = Array.isArray(reelMatch?.images) ? reelMatch.images : [];
        return route.fulfill(jsonResponse({ items, count: items.length }));
      }
      const match = reelMatch;
      if (!match) {
        return route.fulfill(jsonResponse({ error: 'Reel not found' }, 404));
      }
      // Feature 21: the back's reel inspector exposes both
      // `descriptions_override` (column) and `publish_target_snapshot`
      // (last serialized worker snapshot). The mock spreads what each test
      // seeded, falling back to nulls so the panel hydrates from snapshot.
      // Feature 25: also surface `music_track_id` (the override) plus the
      // denormalised `music` object {music_id, display_name} so the editor's
      // music dropdown can show the human label without an extra GET.
      // Feature 35: surface `photos_override` so the editor seeds the
      // per-tile `selected` flag from the persisted override.
      // Feature 36: surface `subtitles_override` for the Subtitles panel.
      // Feature 37: surface `manifest_override` (slide list) and
      // `target_duration_seconds` (per-reel budget the panel uses to warn
      // when the slide sum exceeds it).
      return route.fulfill(
        jsonResponse({
          reel: {
            descriptions_override: null,
            publish_target_snapshot: null,
            music_track_id: null,
            music: null,
            photos_override: null,
            subtitles_override: null,
            manifest_override: null,
            target_duration_seconds: 30,
            ...match,
            has_video: false,
          },
        }),
      );
    },
  );

  // Feature 30: tests can pre-seed social accounts per agency so the
  // /social page surfaces some platforms as `connected: true`. Each item
  // must match the back's `SocialAccountResponse` shape — minimally
  // `{ platform, id, name, is_expired, account_type }`. Anything not seeded
  // continues to behave as the historical "empty world" stub.
  const socialAccountsByAgency = new Map();
  if (options.socialAccountsByAgency) {
    for (const [aid, items] of Object.entries(options.socialAccountsByAgency)) {
      socialAccountsByAgency.set(aid, Array.isArray(items) ? items : []);
    }
  }

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/social-accounts(\?|$)/,
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const agencyId = extractAgencyId(route.request().url());
      const items = socialAccountsByAgency.get(agencyId) || [];
      return route.fulfill(
        jsonResponse({
          ok: items.length > 0,
          connected: items.length > 0,
          items,
          count: items.length,
        }),
      );
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/music(?:\/[^/?]+)?\/?(\?|$)/,
    async (route) => {
      const request = route.request();
      const method = request.method();
      const agencyId = extractAgencyId(request.url());
      const musicId = extractMusicId(request.url());
      const items = getAgencyMusic(musicByAgency, agencyId);

      if (method === 'GET' && !musicId) {
        return route.fulfill(
          jsonResponse({ agency_id: agencyId, items, count: items.length }),
        );
      }

      // POST /music/upload — multipart upload from feature 22 of the back.
      // The `extractMusicId` helper lifts the segment after `/music/` so an
      // upload request reaches this handler with musicId === 'upload'. We
      // distinguish it from a real per-track GET/PUT/DELETE here because the
      // back's spec retires the legacy metadata-only POST /music in lockstep:
      // a POST to /music without /upload now returns 405.
      if (musicId === 'upload' && method === 'POST') {
        const parsed = parseMultipartUpload(request);
        const displayName = (parsed.fields.display_name || '').trim();
        if (!displayName) {
          return route.fulfill(
            jsonResponse(
              {
                error: 'MISSING_DISPLAY_NAME',
                message: 'display_name is required',
              },
              422,
            ),
          );
        }
        if (parsed.file && parsed.file.mime && !ACCEPTED_AUDIO_MIME.has(parsed.file.mime)) {
          return route.fulfill(
            jsonResponse(
              {
                code: 'MUSIC_TRACK_AUDIO_INVALID',
                message: 'Unsupported audio MIME',
                hint: 'Use mp3, m4a or wav.',
              },
              400,
            ),
          );
        }
        const isDefault = String(parsed.fields.is_default || 'false').toLowerCase() === 'true';
        const filename = parsed.file?.filename || `upload-${nextMusicId}.mp3`;
        const safeAgency = String(agencyId || 'agency').slice(0, 24);
        const track = {
          music_id: `mock-music-${nextMusicId++}`,
          agency_id: agencyId,
          display_name: displayName,
          // Server-derived: mock fabricates a deterministic path; the real
          // back returns the storage-resolver output from
          // shared/storage/site_layout.resolve_agency_music_destination.
          object_key: `agencies/${safeAgency}/music/${filename}`,
          // Server-derived: real back runs ffprobe on the uploaded bytes.
          // The mock can't, so we pin a representative value; tests that
          // care about the exact duration should not rely on the bytes.
          duration_seconds: 30,
          is_default: isDefault,
          created_at: '2026-05-06T09:00:00Z',
        };
        items.push(track);
        return route.fulfill(
          jsonResponse({ status: 'created', agency_id: agencyId, music_track: track }, 201),
        );
      }

      if (method === 'GET' && musicId && musicId !== 'upload') {
        const track = items.find((item) => item.music_id === musicId);
        return route.fulfill(
          track
            ? jsonResponse({ agency_id: agencyId, music_track: track })
            : jsonResponse({ code: 'MUSIC_TRACK_NOT_FOUND' }, 404),
        );
      }

      if (method === 'POST' && !musicId) {
        // Metadata-only POST /music retired in feature 22 of the back. Mirror
        // the contract: 405 with a hint pointing callers at the upload
        // endpoint so a drifted client surfaces the regression loudly.
        return route.fulfill(
          jsonResponse(
            {
              error: 'METHOD_NOT_ALLOWED',
              message:
                'Direct metadata POST retired. Use POST /v1/admin/agencies/{id}/music/upload.',
            },
            405,
          ),
        );
      }

      if (method === 'PUT' && musicId && musicId !== 'upload') {
        const body = parseJsonBody(request);
        const index = items.findIndex((item) => item.music_id === musicId);
        if (index === -1) {
          return route.fulfill(jsonResponse({ code: 'MUSIC_TRACK_NOT_FOUND' }, 404));
        }
        items[index] = {
          ...items[index],
          ...Object.fromEntries(
            Object.entries(body).filter(([, value]) => value !== undefined),
          ),
        };
        return route.fulfill(
          jsonResponse({
            status: 'saved',
            agency_id: agencyId,
            music_track: items[index],
          }),
        );
      }

      if (method === 'DELETE' && musicId && musicId !== 'upload') {
        const index = items.findIndex((item) => item.music_id === musicId);
        if (index === -1) {
          return route.fulfill(jsonResponse({ code: 'MUSIC_TRACK_NOT_FOUND' }, 404));
        }
        items.splice(index, 1);
        return route.fulfill(
          jsonResponse({ status: 'deleted', agency_id: agencyId, music_id: musicId }),
        );
      }

      return route.fallback();
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/sources\/[^/?]+(\?|$)/,
    async (route) => {
      const request = route.request();
      const method = request.method();
      const agencyId = extractAgencyId(request.url());
      const sourceId = extractSourceId(request.url());

      if (method === 'PUT') {
        const body = parseJsonBody(request);
        const violation = findForbiddenKey(body, FORBIDDEN_KEYS.sourcesUpdate);
        if (violation) {
          return route.fulfill(jsonResponse(extraForbiddenError(violation), 422));
        }
        return route.fulfill(
          jsonResponse({
            status: 'saved',
            agency_id: agencyId,
            source: {
              wordpress_source_id: sourceId,
              ingestion_source_id: sourceId,
              site_id: body.site_id || 'mock-site',
              name: body.name || 'Mock source',
              site_url: body.site_url || null,
              normalized_host: body.normalized_host || null,
              status: body.status || 'active',
              has_webhook_secret: false,
              created_at: '2026-05-07T00:00:00Z',
              updated_at: '2026-05-07T12:00:00Z',
            },
          }),
        );
      }
      return route.fallback();
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/sources(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.fallback();
      const body = parseJsonBody(request);
      const violation = findForbiddenKey(body, FORBIDDEN_KEYS.sourcesCreate);
      if (violation) {
        return route.fulfill(jsonResponse(extraForbiddenError(violation), 422));
      }
      const agencyId = extractAgencyId(request.url());
      return route.fulfill(
        jsonResponse(
          {
            status: 'created',
            agency_id: agencyId,
            source: {
              wordpress_source_id: 'mock-source-1',
              ingestion_source_id: 'mock-source-1',
              site_id: body.site_id,
              name: body.name,
              site_url: body.site_url || null,
              normalized_host: body.normalized_host || null,
              status: body.status || 'active',
              has_webhook_secret: false,
              created_at: '2026-05-07T00:00:00Z',
              updated_at: '2026-05-07T00:00:00Z',
            },
          },
          201,
        ),
      );
    },
  );

  let nextLogoId = 1;

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/brand\/logo(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.fallback();
      // Real backend returns the canonical S3-style object key + a signed url
      // pointing at the uploaded asset. The mock only needs the shape — the
      // bytes never reach disk in tests.
      const ext = guessLogoExt(request.postData() || '');
      const objectKey = `agencies/mock/brand/logo-${nextLogoId++}.${ext}`;
      return route.fulfill(
        jsonResponse({
          object_key: objectKey,
          url: `https://mock.4reels.test/${objectKey}`,
        }),
      );
    },
  );

  // Stream endpoint for the persisted logo. The real backend gates this with
  // the same admin bearer as the rest of /v1/admin/*, so the LogoUploader
  // fetches it as a blob via `apiFetchBlob` and renders the resulting
  // `URL.createObjectURL` instead of pointing <img src> at the URL.
  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/brand\/logo\/file\/[^/]+$/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
            '0000000d49444154789c63600100000005000130c50f0a0000000049454e44ae426082',
          'hex',
        ),
      });
    },
  );

  // Block image requests to the mock host so the smoke suite doesn't flag
  // ERR_NAME_NOT_RESOLVED when the Templates gallery renders <img> tags
  // pointing at https://mock.4reels.test/... preview URLs.
  await page.route(/^https?:\/\/mock\.4reels\.test\//, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4'
        + '890000000A49444154789C636000000000020001E221BC330000000049454E44'
        + 'AE426082',
        'hex',
      ),
    });
  });

  const socialTemplatesByAgency = new Map();
  const renderTemplatesByAgency = new Map();
  const renderTemplateCatalog = (options.renderTemplates || defaultRenderTemplates()).map(
    (template) => ({ ...template }),
  );
  const initialRenderTemplateId =
    options.currentRenderTemplateId
    || renderTemplateCatalog[0]?.template_id
    || null;

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/render-templates?(\?|$)/,
    async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      const agencyId = extractAgencyId(url.toString());
      const isList = url.pathname.endsWith('/render-templates');
      const isSelect = url.pathname.endsWith('/render-template');

      if (!renderTemplatesByAgency.has(agencyId)) {
        renderTemplatesByAgency.set(agencyId, initialRenderTemplateId);
      }
      const currentId = renderTemplatesByAgency.get(agencyId);

      if (isList && method === 'GET') {
        return route.fulfill(
          jsonResponse({
            agency_id: agencyId,
            current_template_id: currentId,
            items: renderTemplateCatalog.map((tpl) => ({
              ...tpl,
              selected: tpl.template_id === currentId,
            })),
          }),
        );
      }

      if (isSelect && method === 'PUT') {
        const body = parseJsonBody(request);
        const templateId = body?.template_id;
        const match = renderTemplateCatalog.find(
          (tpl) => tpl.template_id === templateId,
        );
        if (!match) {
          return route.fulfill(
            jsonResponse(
              { code: 'RENDER_TEMPLATE_NOT_FOUND', error: 'Template not found' },
              404,
            ),
          );
        }
        renderTemplatesByAgency.set(agencyId, templateId);
        return route.fulfill(
          jsonResponse({
            status: 'saved',
            agency_id: agencyId,
            render_template: { ...match, selected: true },
          }),
        );
      }

      return route.fallback();
    },
  );


  // Feature 24 (mirror of back): /defaults persists settings.music.
  // selection_rules.fallback_to_full_library; GET surfaces the documented
  // default `{fallback_to_full_library: true}` when the key is absent.
  // Stored per-agency so the round-trip is observable from Playwright
  // (e.g. tick the toggle, reload, the new value is read back).
  const defaultsByAgency = new Map();
  // Feature 30: tests can pre-seed the persisted defaults row so the
  // /social page hydrates `platforms` from a known state. Shape mirrors
  // what `surfaceDefaultsForGet` builds: top-level `platforms`,
  // `intro_enabled`, `duration_seconds`, plus a `settings` blob.
  if (options.defaultsByAgency) {
    for (const [aid, defaults] of Object.entries(options.defaultsByAgency)) {
      defaultsByAgency.set(aid, defaults && typeof defaults === 'object' ? defaults : {});
    }
  }

  // Feature 33 — agency outro upload + serve + delete. Outro state piggybacks
  // on the same `defaultsByAgency` map so a successful POST round-trips
  // through GET /defaults (mirror of how the real back stitches `outro_*`
  // columns onto the defaults payload).
  let nextOutroId = 1;

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/outro\/upload(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.fallback();
      const agencyId = extractAgencyId(request.url());
      const payload = request.postData() || '';
      const ext = /Content-Type:\s*video\/quicktime/i.test(payload) ? 'mov' : 'mp4';
      const objectKey =
        `agencies/${agencyId || 'mock'}/outro/outro-${nextOutroId++}.${ext}`;
      const durationSeconds =
        typeof options.outroDurationOverride === 'number'
          ? Number(options.outroDurationOverride)
          : 5;
      const previous = defaultsByAgency.get(agencyId) || {};
      defaultsByAgency.set(agencyId, {
        ...previous,
        outro_source: 'uploaded',
        outro_object_key: objectKey,
        outro_duration_seconds: durationSeconds,
      });
      return route.fulfill(
        jsonResponse({
          outro_object_key: objectKey,
          outro_duration_seconds: durationSeconds,
          outro_source: 'uploaded',
        }),
      );
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/outro\/file(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.fallback();
      // Tiny placeholder body — the smoke suite never plays the clip back, it
      // only asserts the request fired with the admin bearer attached.
      return route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: Buffer.from('000000206674797069736f6d', 'hex'),
      });
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/outro(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'DELETE') return route.fallback();
      const agencyId = extractAgencyId(request.url());
      const previous = defaultsByAgency.get(agencyId) || {};
      defaultsByAgency.set(agencyId, {
        ...previous,
        outro_source: 'none',
        outro_object_key: null,
        outro_duration_seconds: null,
      });
      return route.fulfill(
        jsonResponse({
          outro_source: 'none',
          outro_object_key: null,
        }),
      );
    },
  );

  // Feature 34 — agency intro upload + serve + delete. Mirror of feature 33;
  // state piggybacks on the same `defaultsByAgency` map so a successful POST
  // round-trips through GET /defaults (the real back stitches `intro_*`
  // columns onto the defaults payload the same way it does for `outro_*`).
  let nextIntroId = 1;

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/intro\/upload(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.fallback();
      const agencyId = extractAgencyId(request.url());
      const payload = request.postData() || '';
      const ext = /Content-Type:\s*video\/quicktime/i.test(payload) ? 'mov' : 'mp4';
      const objectKey =
        `agencies/${agencyId || 'mock'}/intro/intro-${nextIntroId++}.${ext}`;
      const durationSeconds =
        typeof options.introDurationOverride === 'number'
          ? Number(options.introDurationOverride)
          : 3;
      const previous = defaultsByAgency.get(agencyId) || {};
      defaultsByAgency.set(agencyId, {
        ...previous,
        intro_source: 'uploaded',
        intro_object_key: objectKey,
        intro_duration_seconds: durationSeconds,
      });
      return route.fulfill(
        jsonResponse({
          intro_object_key: objectKey,
          intro_duration_seconds: durationSeconds,
          intro_source: 'uploaded',
        }),
      );
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/intro\/file(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.fallback();
      // Tiny placeholder body — the smoke suite never plays the clip back, it
      // only asserts the request fired with the admin bearer attached.
      return route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: Buffer.from('000000206674797069736f6d', 'hex'),
      });
    },
  );

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/intro(\?|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'DELETE') return route.fallback();
      const agencyId = extractAgencyId(request.url());
      const previous = defaultsByAgency.get(agencyId) || {};
      defaultsByAgency.set(agencyId, {
        ...previous,
        intro_source: 'none',
        intro_object_key: null,
        intro_duration_seconds: null,
      });
      return route.fulfill(
        jsonResponse({
          intro_source: 'none',
          intro_object_key: null,
        }),
      );
    },
  );

  // Feature 28 — admin fonts catalog (global). GET /v1/admin/fonts returns
  // the canonical list of font families the renderer ships with. The PUT
  // /brand handler below uses this same list to 422 on unknown values, so
  // the spec for the dynamic dropdown lines up exactly with the live back.
  const adminFontCatalog =
    options.adminFontCatalog ||
    DEFAULT_ADMIN_FONT_CATALOG.map((entry) => ({ ...entry }));
  const allowedFontFamilies = new Set(adminFontCatalog.map((f) => f.family));

  await page.route(/\/v1\/admin\/fonts(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(
      jsonResponse({ items: adminFontCatalog, count: adminFontCatalog.length }),
    );
  });

  // Feature 28 — brand slice persists per agency so a save+reload round-trip
  // reflects `null` correctly on primary_color / secondary_color /
  // font_family. The previous mock just echoed the request body, which made
  // it impossible to verify that `null` is preserved end-to-end.
  const brandByAgency = new Map();

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/(brand|defaults|automation|social-templates|reel-profile)(\?|$)/,
    async (route) => {
      const request = route.request();
      const method = request.method();
      const agencyId = extractAgencyId(request.url());
      const slice = extractSlice(request.url());

      if (slice === 'social-templates') {
        return handleSocialTemplates({
          route,
          request,
          method,
          agencyId,
          store: socialTemplatesByAgency,
        });
      }

      if (method === 'GET') {
        if (slice === 'automation') {
          const stored = automationByAgency.get(agencyId) || null;
          return route.fulfill(
            jsonResponse({
              agency_id: agencyId,
              automation: stored ? { ...stored, agency_id: agencyId } : null,
            }),
          );
        }
        if (slice === 'defaults') {
          const stored = defaultsByAgency.get(agencyId) || null;
          const defaultsPayload = stored
            ? surfaceDefaultsForGet(stored, agencyId)
            : surfaceDefaultsForGet({}, agencyId);
          return route.fulfill(
            jsonResponse({
              agency_id: agencyId,
              defaults: defaultsPayload,
            }),
          );
        }
        if (slice === 'brand') {
          // Feature 28: surface the persisted brand row so a save+reload
          // round-trip reflects `null` correctly. `null` here means the
          // renderer falls back (colors → webhook payload; font → Inter).
          const stored = brandByAgency.get(agencyId) || null;
          return route.fulfill(
            jsonResponse({
              agency_id: agencyId,
              brand: stored ? { ...stored, agency_id: agencyId } : null,
            }),
          );
        }
        return route.fulfill(
          jsonResponse({
            agency_id: agencyId,
            brand: null,
            defaults: null,
            automation: null,
            templates: {},
            reel_profile: null,
          }),
        );
      }

      if (method === 'PUT') {
        const body = parseJsonBody(request);
        const forbidden = FORBIDDEN_KEYS[slice];
        if (forbidden) {
          const violation = findForbiddenKey(body, forbidden);
          if (violation) {
            return route.fulfill(jsonResponse(extraForbiddenError(violation), 422));
          }
        }
        if (slice === 'defaults') {
          // Feature 24: validate settings.music.* and settings.music.
          // selection_rules.* against the canonical extra='forbid' lists
          // so unknown keys produce the same 422 shape the back returns.
          const settings = body && typeof body.settings === 'object' ? body.settings : null;
          if (settings && typeof settings.music === 'object' && settings.music !== null) {
            const musicViolation = findUnknownKey(
              settings.music,
              ALLOWED_SETTINGS_MUSIC_KEYS,
            );
            if (musicViolation) {
              return route.fulfill(
                jsonResponse(extraForbiddenError(musicViolation), 422),
              );
            }
            const rules = settings.music.selection_rules;
            if (rules && typeof rules === 'object') {
              const ruleViolation = findUnknownKey(
                rules,
                ALLOWED_SETTINGS_MUSIC_SELECTION_RULES_KEYS,
              );
              if (ruleViolation) {
                return route.fulfill(
                  jsonResponse(extraForbiddenError(ruleViolation), 422),
                );
              }
            }
          }

          // Feature 26: validate settings.automation.reviewEmails. The
          // back's email pipeline accepts either a `list[str]` (canonical)
          // or a legacy CSV `string`; anything else (number, dict, array
          // of non-strings, items that don't match EMAIL_PATTERN) is a
          // hard 422 INVALID_EMAIL_LIST so the contract drift surfaces in
          // CI rather than at runtime.
          if (
            settings &&
            Object.prototype.hasOwnProperty.call(
              settings,
              'automation.reviewEmails',
            )
          ) {
            const raw = settings['automation.reviewEmails'];
            const violation = validateReviewEmails(raw);
            if (violation) {
              return route.fulfill(
                jsonResponse(invalidEmailListError(violation), 422),
              );
            }
          }

          // Shallow-merge settings.* the same way the back does
          // (update_reel_defaults.py: `{**existing, **incoming}`). This
          // matters because the round-trip GET must reflect what other
          // tabs wrote — but the front is responsible for preserving the
          // nested `music.*` siblings (see MusicRules.jsx merge doc).
          const previous = defaultsByAgency.get(agencyId) || {};
          const previousSettings =
            previous.settings && typeof previous.settings === 'object'
              ? previous.settings
              : {};
          const incomingSettings =
            body.settings && typeof body.settings === 'object' ? body.settings : null;
          const mergedSettings = incomingSettings
            ? { ...previousSettings, ...incomingSettings }
            : previousSettings;

          const stored = {
            ...previous,
            ...body,
            agency_id: agencyId,
            settings: mergedSettings,
          };
          defaultsByAgency.set(agencyId, stored);
          return route.fulfill(
            jsonResponse({
              status: 'saved',
              agency_id: agencyId,
              defaults: surfaceDefaultsForGet(stored, agencyId),
            }),
          );
        }
        if (slice === 'automation') {
          const stored = normaliseAutomationRules(body);
          automationByAgency.set(agencyId, stored);
          return route.fulfill(
            jsonResponse({
              status: 'saved',
              agency_id: agencyId,
              automation: { ...stored, agency_id: agencyId },
            }),
          );
        }
        if (slice === 'brand') {
          // Feature 28 — font_family validation.
          // `null` is valid (renderer uses Inter). A string outside the
          // admin font catalog produces a Pydantic-style 422 with
          // `detail[0].msg` carrying `UNKNOWN_FONT_FAMILY:` so the front
          // can surface the message verbatim (mirrors the live back).
          if (
            Object.prototype.hasOwnProperty.call(body, 'font_family') &&
            body.font_family !== null &&
            body.font_family !== undefined &&
            !allowedFontFamilies.has(body.font_family)
          ) {
            return route.fulfill(
              jsonResponse(unknownFontFamilyError(body.font_family), 422),
            );
          }
          const stored = { ...body, agency_id: agencyId };
          brandByAgency.set(agencyId, stored);
          return route.fulfill(
            jsonResponse({
              status: 'saved',
              agency_id: agencyId,
              brand: stored,
            }),
          );
        }
        return route.fulfill(
          jsonResponse({
            status: 'saved',
            agency_id: agencyId,
            [slice]: { ...body, agency_id: agencyId },
          }),
        );
      }

      return route.fallback();
    },
  );

  await page.route(/\/v1\/sessions\/gohighlevel\/session(\?|$)/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(
      jsonResponse(
        ghlSession || DEFAULT_RESPONSES['/v1/sessions/gohighlevel/session'],
      ),
    );
  });

  // Anything else under /v1/admin gets a 404 with a helpful body so a
  // failing test points at the missing stub straight away.
  await page.route(/\/v1\/admin\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (isKnownAdminStub(path)) {
      return route.fallback();
    }
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(
      jsonResponse(
        {
          error: 'No mock stub for this admin path',
          path,
        },
        404,
      ),
    );
  });
}

/**
 * Feature 28 — canonical admin font catalog returned by GET /v1/admin/fonts.
 * Keep in sync with the back's `app/api/admin/fonts.py` so the mock matches
 * the live shape (order + `available: true`).
 */
const DEFAULT_ADMIN_FONT_CATALOG = [
  { family: 'Inter', display_name: 'Inter', available: true },
  { family: 'Manrope', display_name: 'Manrope', available: true },
  {
    family: 'Plus Jakarta Sans',
    display_name: 'Plus Jakarta Sans',
    available: true,
  },
  { family: 'Montserrat', display_name: 'Montserrat', available: true },
  { family: 'Poppins', display_name: 'Poppins', available: true },
  { family: 'Roboto', display_name: 'Roboto', available: true },
];

/**
 * Feature 28 — mirror of the live Pydantic `field_validator` error for
 * `font_family`. The front reads `detail[0].msg` and surfaces it verbatim,
 * so the prefix `UNKNOWN_FONT_FAMILY:` must match what the back emits.
 */
function unknownFontFamilyError(value) {
  return {
    detail: [
      {
        loc: ['body', 'font_family'],
        msg: `UNKNOWN_FONT_FAMILY: ${value}`,
        type: 'value_error',
      },
    ],
  };
}

function isKnownAdminStub(path) {
  return [
    /^\/v1\/admin\/agencies$/,
    /^\/v1\/admin\/fonts$/,
    /^\/v1\/admin\/agencies\/[^/]+$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/images$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/(approve|reject)$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/regenerate$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/descriptions$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/music$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/photos$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/subtitles$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+\/slides$/,
    /^\/v1\/admin\/agencies\/[^/]+\/social-accounts$/,
    /^\/v1\/admin\/agencies\/[^/]+\/music(?:\/[^/]+)?\/?$/,
    /^\/v1\/admin\/agencies\/[^/]+\/sources(?:\/[^/]+)?\/?$/,
    /^\/v1\/admin\/agencies\/[^/]+\/(brand|defaults|automation|social-templates|reel-profile)$/,
    /^\/v1\/admin\/agencies\/[^/]+\/brand\/logo$/,
    /^\/v1\/admin\/agencies\/[^/]+\/brand\/logo\/file\/[^/]+$/,
    /^\/v1\/admin\/agencies\/[^/]+\/outro$/,
    /^\/v1\/admin\/agencies\/[^/]+\/outro\/upload$/,
    /^\/v1\/admin\/agencies\/[^/]+\/outro\/file$/,
    /^\/v1\/admin\/agencies\/[^/]+\/intro$/,
    /^\/v1\/admin\/agencies\/[^/]+\/intro\/upload$/,
    /^\/v1\/admin\/agencies\/[^/]+\/intro\/file$/,
    /^\/v1\/admin\/agencies\/[^/]+\/render-templates$/,
    /^\/v1\/admin\/agencies\/[^/]+\/render-template$/,
  ].some((pattern) => pattern.test(path));
}

function defaultRenderTemplates() {
  return [
    {
      template_id: 'classic-grid',
      display_name: 'Classic Grid',
      description: 'Balanced 3:4 grid with calm typography for premium listings.',
      status: 'active',
      sort_order: 1,
      preview_images: [
        {
          kind: 'cover',
          image_url: 'https://mock.4reels.test/templates/classic-grid/cover.jpg',
          alt: 'Classic Grid cover preview',
        },
        {
          kind: 'frame',
          image_url: 'https://mock.4reels.test/templates/classic-grid/frame.jpg',
          alt: 'Classic Grid frame preview',
        },
      ],
      layout_variant: 'grid',
      selected: false,
    },
    {
      template_id: 'bold-headline',
      display_name: 'Bold Headline',
      description: 'High-contrast hero with oversized address text and quick stat strip.',
      status: 'active',
      sort_order: 2,
      preview_images: [
        {
          kind: 'cover',
          image_url: 'https://mock.4reels.test/templates/bold-headline/cover.jpg',
          alt: 'Bold Headline cover preview',
        },
      ],
      layout_variant: 'hero',
      selected: false,
    },
  ];
}

function extractReelPath(url) {
  const match = new URL(url).pathname.match(
    /\/v1\/admin\/agencies\/[^/]+\/reels\/([^/]+)\/([^/]+)/,
  );
  if (!match) return { siteId: '', sourcePropertyId: '' };
  return {
    siteId: decodeURIComponent(match[1]),
    sourcePropertyId: decodeURIComponent(match[2]),
  };
}

function guessLogoExt(payload) {
  if (/Content-Type:\s*image\/png/i.test(payload)) return 'png';
  return 'jpg';
}

/**
 * Pydantic-style extra='forbid' rejection. Matches the exact shape the back
 * returns so the front can't "drift" on payloads that the live backend
 * would 422 on.
 */
const FORBIDDEN_KEYS = {
  sourcesCreate: ['source_name', 'source_status'],
  sourcesUpdate: ['source_name', 'source_status'],
  brand: [
    'font',
    'tagline',
    'watermark_enabled',
    'outro_enabled',
    'outro_headline',
    'outro_sub',
  ],
  automation: [
    'publish_mode',
    'platforms',
    'review_window_enabled',
    'review_window_hours',
    'auto_captions',
    'regen_on_update',
    'review_emails',
  ],
};

function findForbiddenKey(body, forbidden) {
  if (!body || typeof body !== 'object') return null;
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(body, key)) return key;
  }
  return null;
}

/**
 * Feature 24: canonical Pydantic `extra='forbid'` allow-lists for
 * `settings.music.*` and `settings.music.selection_rules.*` (see
 * back's `payloads/defaults.py:SettingsMusicPayload` and
 * `SettingsMusicSelectionRulesPayload`). Keep these in sync with the
 * back models so the mock-backend rejects the same payloads the live
 * server would.
 */
const ALLOWED_SETTINGS_MUSIC_KEYS = new Set(['selection_rules']);
const ALLOWED_SETTINGS_MUSIC_SELECTION_RULES_KEYS = new Set([
  'fallback_to_full_library',
]);

function findUnknownKey(obj, allowed) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return key;
  }
  return null;
}

/**
 * Feature 24: shape a `/defaults` row for the GET response, applying
 * the music selection-rule default non-destructively. Mirrors the
 * back's `_serialize_defaults` + `_settings_with_music_defaults`:
 * when `settings.music.selection_rules` is absent on the stored row,
 * surface `{fallback_to_full_library: true}` so the frontend Toggle
 * always has a defined value — but do NOT persist the default on the
 * way out (read-only fill-in).
 */
function surfaceDefaultsForGet(stored, agencyId) {
  const base =
    stored && typeof stored === 'object' ? stored : {};
  const settings =
    base.settings && typeof base.settings === 'object' ? base.settings : {};
  const music =
    settings.music && typeof settings.music === 'object' ? settings.music : {};
  const rules =
    music.selection_rules && typeof music.selection_rules === 'object'
      ? music.selection_rules
      : {};
  const surfacedRules = {
    fallback_to_full_library:
      typeof rules.fallback_to_full_library === 'boolean'
        ? rules.fallback_to_full_library
        : true,
  };
  const surfacedSettings = {
    ...settings,
    music: { ...music, selection_rules: surfacedRules },
  };
  return {
    agency_id: agencyId,
    platforms: Array.isArray(base.platforms) ? base.platforms : [],
    duration_seconds:
      typeof base.duration_seconds === 'number' ? base.duration_seconds : 30,
    intro_enabled:
      typeof base.intro_enabled === 'boolean' ? base.intro_enabled : true,
    // Feature 34 — mirror of back contract: intro fields live top-level on the
    // GET payload (parallel to outro from feature 33) so the Intro&Outro card
    // hydrates both chips without extra roundtrips.
    intro_source:
      typeof base.intro_source === 'string' ? base.intro_source : 'none',
    intro_object_key:
      typeof base.intro_object_key === 'string' ? base.intro_object_key : null,
    intro_duration_seconds:
      typeof base.intro_duration_seconds === 'number'
        ? base.intro_duration_seconds
        : null,
    // Feature 33 — mirror of back contract: outro fields live top-level on the
    // GET payload so the Intro&Outro card hydrates without a second roundtrip.
    outro_enabled:
      typeof base.outro_enabled === 'boolean' ? base.outro_enabled : true,
    outro_source:
      typeof base.outro_source === 'string' ? base.outro_source : 'none',
    outro_object_key:
      typeof base.outro_object_key === 'string' ? base.outro_object_key : null,
    outro_duration_seconds:
      typeof base.outro_duration_seconds === 'number'
        ? base.outro_duration_seconds
        : null,
    settings: surfacedSettings,
  };
}

function extraForbiddenError(field) {
  return {
    detail: [
      {
        loc: ['body', field],
        msg: 'Extra inputs are not permitted',
        type: 'extra_forbidden',
      },
    ],
  };
}

/**
 * Feature 26: shape of the 422 the back returns when
 * `settings.automation.reviewEmails` doesn't validate. Mirrors the
 * Pydantic `detail[0].msg` convention so the front can surface the
 * message verbatim (see EmailListInput — we render this inline).
 */
const REVIEW_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateReviewEmails(raw) {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string') {
        return `Non-string item in reviewEmails (got ${typeof item})`;
      }
      const candidate = item.trim().toLowerCase();
      if (!REVIEW_EMAIL_REGEX.test(candidate)) {
        return `"${item}" is not a valid email address`;
      }
    }
    return null;
  }
  if (typeof raw === 'string') {
    // Legacy CSV path: split, trim and validate each non-empty segment.
    const parts = raw
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    for (const item of parts) {
      if (!REVIEW_EMAIL_REGEX.test(item)) {
        return `"${item}" is not a valid email address`;
      }
    }
    return null;
  }
  if (raw === null || raw === undefined) {
    // Treat absent as empty list — no error.
    return null;
  }
  return `Unsupported type for reviewEmails (got ${typeof raw})`;
}

function invalidEmailListError(message) {
  return {
    detail: [
      {
        loc: ['body', 'settings', 'automation.reviewEmails'],
        msg: `INVALID_EMAIL_LIST: ${message}`,
        type: 'value_error',
      },
    ],
  };
}

function extractSourceId(url) {
  const match = new URL(url).pathname.match(
    /\/v1\/admin\/agencies\/[^/]+\/sources\/([^/?]+)/,
  );
  return match ? decodeURIComponent(match[1]) : '';
}

function extractSlice(url) {
  const match = new URL(url).pathname.match(
    /\/v1\/admin\/agencies\/[^/]+\/(brand|defaults|automation|social-templates|reel-profile)/,
  );
  return match ? match[1] : '';
}

/**
 * Convenience: seed an agency session so the SessionProvider doesn't fall
 * into the "Connect GoHighLevel" gate. Pair with `installMockBackend(page, {
 * agencies: [SAMPLE_AGENCY], ghlSession: agencyConnectedSession() })`.
 */
export async function seedAgencyLocalStorage(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      '4reels.ghlMvpContext',
      JSON.stringify({
        source: 'playwright-seed',
        userId: 'test-user',
        locationId: 'v8H1XNB3YCQmVHRhqDoM',
        userName: 'Test User',
        email: 'test@example.com',
        encryptedContextOnly: false,
        userFallback: false,
      }),
    );
  });
}

export function agencyConnectedSession(agencyId = SAMPLE_AGENCY_ID) {
  return {
    ok: true,
    location_id: 'v8H1XNB3YCQmVHRhqDoM',
    user_id: 'test-user',
    connected: true,
    has_token: true,
    agency_id: agencyId,
    agency_token: `test-bearer-${agencyId}`,
    agency_token_expires_at: TEST_AGENCY_TOKEN_EXPIRES_AT,
  };
}

function extractAgencyId(url) {
  const match = new URL(url).pathname.match(
    /\/v1\/admin\/agencies\/([^/?]+)/,
  );
  return match ? decodeURIComponent(match[1]) : '';
}

// Feature 32 — list query parsing helpers.
function parseCsv(value) {
  if (value == null) return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function extractMusicId(url) {
  const match = new URL(url).pathname.match(
    /\/v1\/admin\/agencies\/[^/]+\/music\/([^/?]+)/,
  );
  return match ? decodeURIComponent(match[1]) : '';
}

function getAgencyMusic(musicByAgency, agencyId) {
  if (!musicByAgency.has(agencyId)) {
    musicByAgency.set(agencyId, defaultMusicTracks(agencyId));
  }
  return musicByAgency.get(agencyId);
}

function defaultMusicTracks(agencyId) {
  return [
    {
      music_id: 'mock-music-default',
      agency_id: agencyId,
      display_name: 'Sunset Drive',
      object_key: 'agencies/ckp/music/sunset-drive.mp3',
      duration_seconds: 28,
      is_default: true,
      created_at: '2026-05-06T09:00:00Z',
    },
  ];
}

function parseJsonBody(request) {
  const raw = request.postData();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const ACCEPTED_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
]);

/**
 * Parse a multipart/form-data body well enough to extract the named text
 * fields and the single uploaded file. Mirrors what the back accepts in
 * feature 22 (`file`, `display_name`, `is_default`).
 *
 * Playwright surfaces the raw bytes via `request.postData()`. We don't have
 * the dispositions/boundaries already parsed, so we walk the body splitting
 * on the boundary derived from the Content-Type header. This is intentionally
 * minimal: only what we need for the upload spec, not a general-purpose
 * multipart parser.
 */
function parseMultipartUpload(request) {
  const result = { fields: {}, file: null };
  const contentType = request.headers()['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) return result;
  const boundary = `--${boundaryMatch[1].trim()}`;
  const raw = request.postData();
  if (!raw) return result;
  const parts = raw.split(boundary);
  for (const part of parts) {
    if (!part || part === '--' || part === '--\r\n') continue;
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const rawHeaders = part.slice(0, headerEnd);
    // Strip the trailing CRLF (and possibly the closing `--`) from the body.
    let body = part.slice(headerEnd + 4);
    if (body.endsWith('\r\n')) body = body.slice(0, -2);
    const dispositionMatch = rawHeaders.match(/Content-Disposition:\s*form-data;([^\r\n]+)/i);
    if (!dispositionMatch) continue;
    const dispositionParams = dispositionMatch[1];
    const nameMatch = dispositionParams.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const filenameMatch = dispositionParams.match(/filename="([^"]*)"/i);
    if (filenameMatch) {
      const filename = filenameMatch[1];
      const mimeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n;]+)/i);
      result.file = {
        field: name,
        filename,
        mime: mimeMatch ? mimeMatch[1].trim() : '',
        // Size is approximate (postData() decodes binary as latin-1 in
        // Playwright; we only need the byte count for size-cap checks if a
        // future test exercises 413).
        size: body.length,
      };
    } else {
      result.fields[name] = body;
    }
  }
  return result;
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

/**
 * Mirrors the backend's `/v1/admin/agencies/{id}/social-templates` contract:
 *
 *   GET → { agency_id, templates: {platform: descriptionString}, items: [...], count }
 *   PUT → { status:'saved', agency_id, templates, items, count }
 *
 * `items` carries the per-row record (description_template, title_template,
 * hashtags[], created_at, updated_at). The PUT body accepts BOTH shapes since
 * feature 20:
 *   1. legacy flat — { templates: { platform: 'desc string' } }
 *   2. rich       — { templates: { platform: { description_template, title_template, hashtags } } }
 * A bare string in a rich PUT is normalised to
 * `{description_template: <string>, title_template: '', hashtags: []}` to
 * match the back's backward-compat coercion.
 *
 * Validation mirrors the live backend:
 *   - Unknown `{{var}}` placeholders → HTTP 422
 *     `{error: 'SOCIAL_TEMPLATE_UNKNOWN_VARIABLE', details: {...}}`. The
 *     `details.unknown_variables_by_platform` value is FLAT when only the
 *     description has unknowns (`{platform: [var, ...]}`) and NESTED when the
 *     title is involved (`{platform: {description_template: [...], title_template: [...]}}`),
 *     same as `social_templates_router.py:175-193`.
 *   - Invalid hashtags (regex `^#[\w-]{1,50}$` or count > 30) → HTTP 422
 *     `{error: 'SOCIAL_TEMPLATE_INVALID_HASHTAG', details: {hashtag_errors_by_platform: {...}}}`.
 *
 * Store value per platform is `{description_template, title_template, hashtags}`.
 */
function handleSocialTemplates({ route, request, method, agencyId, store }) {
  if (!store.has(agencyId)) store.set(agencyId, new Map());
  const templates = store.get(agencyId);

  if (method === 'GET') {
    return route.fulfill(jsonResponse(serializeSocialTemplates(agencyId, templates)));
  }

  if (method === 'PUT') {
    const body = parseJsonBody(request);
    const incoming = body && typeof body.templates === 'object' && body.templates
      ? body.templates
      : {};

    // Normalise every entry up front so the validators below operate on a
    // canonical shape regardless of which payload the caller sent.
    const normalised = normaliseIncomingSocialTemplates(incoming);

    const variableErrors = collectUnknownSocialTemplateVariables(normalised);
    if (variableErrors) {
      return route.fulfill(
        jsonResponse(
          {
            error: 'SOCIAL_TEMPLATE_UNKNOWN_VARIABLE',
            details: { unknown_variables_by_platform: variableErrors },
          },
          422,
        ),
      );
    }

    const hashtagErrors = collectInvalidHashtags(normalised);
    if (hashtagErrors) {
      return route.fulfill(
        jsonResponse(
          {
            error: 'SOCIAL_TEMPLATE_INVALID_HASHTAG',
            details: { hashtag_errors_by_platform: hashtagErrors },
          },
          422,
        ),
      );
    }

    templates.clear();
    for (const [platform, entry] of Object.entries(normalised)) {
      templates.set(platform, entry);
    }
    const payload = serializeSocialTemplates(agencyId, templates);
    return route.fulfill(
      jsonResponse({ status: 'saved', ...payload }),
    );
  }

  return route.fallback();
}

/**
 * Coerce the incoming `templates` map into the canonical per-platform shape
 * `{description_template, title_template, hashtags}`. Accepts both:
 *   - string (legacy)  → `{description_template: <string>, title_template: '', hashtags: []}`
 *   - object (rich)    → fields normalised to defaults when missing
 * Empty-string platform keys are dropped.
 */
function normaliseIncomingSocialTemplates(incoming) {
  const out = {};
  if (!incoming || typeof incoming !== 'object') return out;
  for (const [rawPlatform, rawValue] of Object.entries(incoming)) {
    const platform = String(rawPlatform || '').trim().toLowerCase();
    if (!platform) continue;
    if (typeof rawValue === 'string') {
      out[platform] = { description_template: rawValue, title_template: '', hashtags: [] };
      continue;
    }
    if (rawValue && typeof rawValue === 'object') {
      out[platform] = {
        description_template: typeof rawValue.description_template === 'string' ? rawValue.description_template : '',
        title_template: typeof rawValue.title_template === 'string' ? rawValue.title_template : '',
        hashtags: Array.isArray(rawValue.hashtags) ? rawValue.hashtags.map((h) => String(h)) : [],
      };
      continue;
    }
    out[platform] = { description_template: '', title_template: '', hashtags: [] };
  }
  return out;
}

/**
 * Scan each platform's description AND title templates for `{{var}}`
 * placeholders and collect variables not in the canonical 16-entry whitelist.
 *
 * Returns `null` when every variable is allowed (fast path: no 422). Otherwise
 * returns a shape-mixed map per platform, mirroring `social_templates_router.py`:
 *   - Only the description has unknowns → `{platform: [var, ...]}` (flat,
 *     legacy — keeps the 9 feature-18 tests green).
 *   - The title has unknowns (possibly with description too) →
 *     `{platform: {description_template?: [...], title_template?: [...]}}` (nested).
 * Duplicates inside the same template are de-duped; insertion order is
 * preserved.
 */
function collectUnknownSocialTemplateVariables(normalised) {
  if (!normalised || typeof normalised !== 'object') return null;
  const allowed = new Set(ALLOWED_SOCIAL_TEMPLATE_VARIABLES);
  const details = {};
  let hasAny = false;
  for (const [platform, entry] of Object.entries(normalised)) {
    const description = String(entry.description_template || '');
    const title = String(entry.title_template || '');
    const descUnknown = scanUnknownVariables(description, allowed);
    const titleUnknown = scanUnknownVariables(title, allowed);
    if (!descUnknown.length && !titleUnknown.length) continue;
    if (!titleUnknown.length) {
      // Flat (legacy) shape: only description carries unknowns.
      details[platform] = descUnknown;
    } else {
      const nested = {};
      if (descUnknown.length) nested.description_template = descUnknown;
      nested.title_template = titleUnknown;
      details[platform] = nested;
    }
    hasAny = true;
  }
  return hasAny ? details : null;
}

function scanUnknownVariables(source, allowed) {
  if (!source) return [];
  // matchAll consumes the regex's lastIndex per call, so build a fresh
  // RegExp from the source/flags to keep the shared pattern stateless.
  const pattern = new RegExp(
    SOCIAL_TEMPLATE_VARIABLE_PATTERN.source,
    SOCIAL_TEMPLATE_VARIABLE_PATTERN.flags,
  );
  const seen = new Set();
  const unknown = [];
  for (const match of source.matchAll(pattern)) {
    const variable = match[1];
    if (allowed.has(variable)) continue;
    if (seen.has(variable)) continue;
    seen.add(variable);
    unknown.push(variable);
  }
  return unknown;
}

/**
 * Validate each platform's hashtags. Mirrors the back's two error vectors:
 *   - Invalid entries (regex `^#[\w-]{1,50}$`) → `{invalid: [...]}`
 *   - Past the per-platform cap → `{count: N, max: MAX_HASHTAGS_PER_PLATFORM}`
 * Both keys may appear together when a single PUT trips both checks. Returns
 * `null` when every platform passes.
 */
function collectInvalidHashtags(normalised) {
  if (!normalised || typeof normalised !== 'object') return null;
  const details = {};
  let hasAny = false;
  for (const [platform, entry] of Object.entries(normalised)) {
    const hashtags = Array.isArray(entry.hashtags) ? entry.hashtags : [];
    const platformErrors = {};
    const invalid = hashtags.filter((h) => !HASHTAG_PATTERN.test(String(h)));
    if (invalid.length) platformErrors.invalid = invalid;
    if (hashtags.length > MAX_HASHTAGS_PER_PLATFORM) {
      platformErrors.count = hashtags.length;
      platformErrors.max = MAX_HASHTAGS_PER_PLATFORM;
    }
    if (Object.keys(platformErrors).length) {
      details[platform] = platformErrors;
      hasAny = true;
    }
  }
  return hasAny ? details : null;
}

/**
 * Read the current `Date.now()` from the page context. When the test
 * pins the clock with `page.clock.install({ time })`, this returns the
 * pinned moment as a JS Date (UTC) — the mock backend then computes the
 * approve `scheduled_at` against that instant. Without the clock mock
 * this falls back to the real wallclock.
 */
async function pageNow(request) {
  try {
    const page = request.frame()?.page?.();
    if (!page) return new Date();
    const ms = await page.evaluate(() => Date.now());
    return new Date(ms);
  } catch {
    return new Date();
  }
}

/** Normalise a PUT /automation body into an automation_rules-shaped record. */
function normaliseAutomationRules(body) {
  const rules = { ...(body || {}) };
  rules.hold_window_seconds = Math.max(
    0,
    Math.min(86400, Number(rules.hold_window_seconds) || 0),
  );
  rules.quiet_hours_enabled = Boolean(rules.quiet_hours_enabled);
  rules.skip_weekends = Boolean(rules.skip_weekends);
  if (!Array.isArray(rules.publish_days)) rules.publish_days = [];
  return rules;
}

/**
 * Tiny mirror of `compute_next_publish_slot` (back/feature 14) for the
 * mock backend. Honours hold_window_seconds + skip_weekends +
 * quiet_hours_enabled and the inverted publish_window_start/end shape
 * the front sends. Returns an ISO8601 UTC string or `null` (immediate
 * publish).
 */
function computeMockScheduledAt(rules, nowUtc, agencyTimezone) {
  if (!rules) return null;
  const hold = clampInt(rules.hold_window_seconds, 0, 86400);
  const quiet = Boolean(rules.quiet_hours_enabled);
  const skip = Boolean(rules.skip_weekends);
  if (hold === 0 && !quiet && !skip) return null;

  const targetUtc = new Date(nowUtc.getTime() + hold * 1000);
  const tz = agencyTimezone || 'UTC';

  const startTime = parseHhMm(rules.publish_window_start);
  const endTime = parseHhMm(rules.publish_window_end);
  const publishDayIndices = normalisePublishDays(rules.publish_days);

  let targetLocal = utcToLocalParts(targetUtc, tz);

  if (skip && (targetLocal.weekday === 5 || targetLocal.weekday === 6)) {
    if (!startTime || publishDayIndices.length === 0) return null;
    const next = nextAllowedDayAtStart(targetLocal, publishDayIndices, startTime);
    if (!next) return null;
    targetLocal = next;
  }

  if (quiet) {
    if (!startTime || !endTime || publishDayIndices.length === 0) return null;
    if (!publishDayIndices.includes(targetLocal.weekday)) {
      const next = nextAllowedDayAtStart(targetLocal, publishDayIndices, startTime);
      if (!next) return null;
      targetLocal = next;
    }
    if (!isInsideQuietHoursWindow(targetLocal, startTime, endTime)) {
      const sameDayStart = withTime(targetLocal, startTime);
      if (
        publishDayIndices.includes(targetLocal.weekday)
        && compareLocal(sameDayStart, targetLocal) > 0
      ) {
        targetLocal = sameDayStart;
      } else {
        const next = nextAllowedDayAtStart(
          targetLocal,
          publishDayIndices,
          startTime,
        );
        if (!next) return null;
        targetLocal = next;
      }
    }
  }

  const resolvedUtc = localPartsToUtc(targetLocal, tz);
  if (resolvedUtc.getTime() === nowUtc.getTime()) return null;
  return resolvedUtc.toISOString();
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parseHhMm(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text.includes(':')) return null;
  const [h, m] = text.split(':');
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

const WEEKDAY_INDEX = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

function normalisePublishDays(days) {
  if (!Array.isArray(days)) return [];
  const seen = new Set();
  const out = [];
  for (const day of days) {
    if (typeof day !== 'string') continue;
    const idx = WEEKDAY_INDEX[day.trim().toLowerCase()];
    if (idx === undefined || seen.has(idx)) continue;
    seen.add(idx);
    out.push(idx);
  }
  return out;
}

/**
 * Convert a UTC `Date` into the agency-local "wall clock" parts. We rely
 * on `Intl.DateTimeFormat` to do the TZ conversion so we don't have to
 * ship a tzdata table.
 */
function utcToLocalParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const weekdayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const weekday = weekdayMap[parts.weekday] ?? 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second || 0),
    weekday,
    timeZone,
  };
}

/**
 * Inverse of `utcToLocalParts`: given local wallclock parts in a TZ,
 * return the corresponding UTC `Date`. The TZ offset is computed by
 * round-tripping a guess and correcting.
 */
function localPartsToUtc(local, timeZone) {
  const tz = timeZone || local.timeZone || 'UTC';
  // First guess: treat local parts as UTC.
  const guessUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second || 0,
  );
  // Measure offset between TZ and UTC at that instant.
  const probe = new Date(guessUtc);
  const probeLocal = utcToLocalParts(probe, tz);
  const probeAsUtcMs = Date.UTC(
    probeLocal.year,
    probeLocal.month - 1,
    probeLocal.day,
    probeLocal.hour,
    probeLocal.minute,
    probeLocal.second || 0,
  );
  const offsetMs = probeAsUtcMs - guessUtc;
  return new Date(guessUtc - offsetMs);
}

function nextAllowedDayAtStart(localParts, publishDayIndices, startTime) {
  if (publishDayIndices.length === 0) return null;
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(localParts, offset);
    if (publishDayIndices.includes(candidate.weekday)) {
      return withTime(candidate, startTime);
    }
  }
  return null;
}

function addDays(localParts, days) {
  // Build the local date at midnight, add `days`, project back to parts.
  const ms = Date.UTC(localParts.year, localParts.month - 1, localParts.day);
  const next = new Date(ms + days * 86400000);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: localParts.hour,
    minute: localParts.minute,
    second: localParts.second || 0,
    weekday: (localParts.weekday + days + 7000) % 7,
    timeZone: localParts.timeZone,
  };
}

function withTime(localParts, time) {
  return {
    ...localParts,
    hour: time.hour,
    minute: time.minute,
    second: 0,
  };
}

function isInsideQuietHoursWindow(localParts, startTime, endTime) {
  const moment = localParts.hour * 60 + localParts.minute;
  const start = startTime.hour * 60 + startTime.minute;
  const end = endTime.hour * 60 + endTime.minute;
  if (start <= end) return moment >= start && moment <= end;
  return moment >= start || moment <= end;
}

function compareLocal(a, b) {
  const fields = ['year', 'month', 'day', 'hour', 'minute', 'second'];
  for (const f of fields) {
    if ((a[f] || 0) > (b[f] || 0)) return 1;
    if ((a[f] || 0) < (b[f] || 0)) return -1;
  }
  return 0;
}

function serializeSocialTemplates(agencyId, templates) {
  const items = [];
  const map = {};
  const now = '2026-05-12T12:00:00Z';
  for (const [platform, value] of templates.entries()) {
    // The store now keeps the rich shape, but tolerate legacy string values
    // in case a previous test or initialiser seeded one directly.
    const entry = typeof value === 'string'
      ? { description_template: value, title_template: '', hashtags: [] }
      : {
          description_template: typeof value?.description_template === 'string' ? value.description_template : '',
          title_template: typeof value?.title_template === 'string' ? value.title_template : '',
          hashtags: Array.isArray(value?.hashtags) ? [...value.hashtags] : [],
        };
    map[platform] = entry.description_template;
    items.push({
      agency_id: agencyId,
      platform,
      description_template: entry.description_template,
      title_template: entry.title_template,
      hashtags: entry.hashtags,
      created_at: now,
      updated_at: now,
    });
  }
  return {
    agency_id: agencyId,
    templates: map,
    items,
    count: items.length,
  };
}
