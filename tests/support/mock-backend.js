/**
 * Tiny in-test stub for the live backend.
 *
 * The frontend now talks to `VITE_MVP_API_URL` directly â€” there is no
 * in-app mock layer to lean on. This helper installs Playwright
 * `page.route()` interceptors so each test can serve deterministic
 * responses for the agency admin endpoints + the GHL session.
 *
 * Usage:
 *   await installMockBackend(page);                  // empty world
 *   await installMockBackend(page, { agencies });    // seeded world
 */

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

// 2026-05-07T12:00:00Z + 1h. Expiración fija para que los tests sean
// deterministas; el front no valida la fecha hoy, solo la guarda como
// metadato del token.
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

  await page.route(/\/v1\/admin\/agencies\/[^/]+\/reels(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(jsonResponse({ items: [], count: 0 }));
  });

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/social-accounts(\?|$)/,
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill(
        jsonResponse({ ok: false, connected: false, items: [], count: 0 }),
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

      if (method === 'GET' && musicId) {
        const track = items.find((item) => item.music_id === musicId);
        return route.fulfill(
          track
            ? jsonResponse({ agency_id: agencyId, music_track: track })
            : jsonResponse({ code: 'MUSIC_TRACK_NOT_FOUND' }, 404),
        );
      }

      if (method === 'POST') {
        const body = parseJsonBody(request);
        const track = {
          music_id: `mock-music-${nextMusicId++}`,
          agency_id: agencyId,
          display_name: body.display_name,
          object_key: body.object_key,
          duration_seconds: Number(body.duration_seconds),
          is_default: Boolean(body.is_default),
          created_at: '2026-05-06T09:00:00Z',
        };
        items.push(track);
        return route.fulfill(
          jsonResponse({ status: 'created', agency_id: agencyId, music_track: track }, 201),
        );
      }

      if (method === 'PUT' && musicId) {
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

      if (method === 'DELETE' && musicId) {
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

  await page.route(
    /\/v1\/admin\/agencies\/[^/]+\/(brand|defaults|automation|social-templates|reel-profile)(\?|$)/,
    async (route) => {
      const request = route.request();
      const method = request.method();
      const agencyId = extractAgencyId(request.url());
      const slice = extractSlice(request.url());

      if (method === 'GET') {
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

function isKnownAdminStub(path) {
  return [
    /^\/v1\/admin\/agencies$/,
    /^\/v1\/admin\/agencies\/[^/]+$/,
    /^\/v1\/admin\/agencies\/[^/]+\/reels$/,
    /^\/v1\/admin\/agencies\/[^/]+\/social-accounts$/,
    /^\/v1\/admin\/agencies\/[^/]+\/music(?:\/[^/]+)?\/?$/,
    /^\/v1\/admin\/agencies\/[^/]+\/sources(?:\/[^/]+)?\/?$/,
    /^\/v1\/admin\/agencies\/[^/]+\/(brand|defaults|automation|social-templates|reel-profile)$/,
  ].some((pattern) => pattern.test(path));
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
    'quiet_hours_enabled',
    'skip_weekends',
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

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}
