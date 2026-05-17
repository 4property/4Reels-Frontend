/**
 * Single entry point for every network request the app makes.
 *
 * All paths route to the live backend at `VITE_MVP_API_URL`. The historical
 * in-memory mock layer was retired once every feature page started talking
 * to the real `/v1/admin/agencies/...` surface — keeping it would just be a
 * second source of truth that drifts.
 *
 * Feature code must never call `fetch` directly — call `apiRequest` through
 * a feature-level `api.js` module so paths and shapes stay co-located with
 * the feature that owns them.
 */
import { ApiError } from './ApiError.js';
import { getAuthToken, notifyUnauthorized } from './authToken.js';

export const BASE_URL = import.meta.env.VITE_API_URL || '';
export const MVP_API_URL = import.meta.env.VITE_MVP_API_URL || BASE_URL;
export const API_TRACE = import.meta.env.VITE_API_TRACE !== 'false';

/**
 * @typedef {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} HttpMethod
 *
 * @typedef {object} RequestOptions
 * @property {HttpMethod} [method]      HTTP verb, defaults to 'GET'.
 * @property {unknown}    [body]        Plain JS object — will be JSON-stringified.
 * @property {Record<string, string|number|boolean|undefined>} [query]
 *                                      Flat object of query params.
 * @property {Record<string, string>}   [headers]  Extra headers.
 * @property {AbortSignal}              [signal]   Forwarded to fetch.
 */

/**
 * @param {string} path  Path starting with `/`, e.g. `/v1/admin/agencies`.
 * @param {RequestOptions} [options]
 * @returns {Promise<any>} Parsed JSON response.
 *
 * Multipart: pass a `FormData` instance as `body`. The helper skips JSON
 * serialization and omits the `Content-Type` header so the browser sets the
 * `multipart/form-data; boundary=...` value automatically. All other paths
 * keep the JSON contract (extra='forbid' on the backend stays honest).
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, query, headers, signal } = options;
  const trace = createTrace({ method, path, body });

  const baseUrl = MVP_API_URL || BASE_URL;
  const url = new URL(`${trimTrailingSlash(baseUrl)}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = {
    Accept: 'application/json',
    ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
    ...getAuthHeaders(),
    ...headers,
  };
  let requestBody;
  if (body === undefined) {
    requestBody = undefined;
  } else if (isMultipart) {
    requestBody = body;
  } else {
    requestBody = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal,
      credentials: 'omit',
    });
  } catch (error) {
    const apiError = new ApiError(
      0,
      `Network/CORS error calling ${url.origin}. Check that the backend is reachable and serves CORS for this origin.`,
      { cause: error instanceof Error ? error.message : String(error) },
      finishTrace(trace, {
        url: url.toString(),
        error: serializeError(error),
      }),
    );
    logApiError(apiError.trace);
    throw apiError;
  }

  const text = await res.text();
  const payload = parseJson(text);

  if (!res.ok) {
    if (res.status === 401 && isAdminPath(path)) {
      notifyUnauthorized();
    }
    const apiError = new ApiError(
      res.status,
      payload?.message || payload?.error || res.statusText,
      payload || text,
      finishTrace(trace, {
        url: url.toString(),
        status: res.status,
        ok: false,
        responseBody: payload || text,
      }),
    );
    logApiError(apiError.trace);
    throw apiError;
  }

  if (res.status === 204) return null;
  return payload ?? null;
}

/**
 * GET a binary asset (e.g. the brand logo file stream) with the same bearer
 * token that `apiRequest` would attach. Returns the raw `Blob` so callers can
 * wrap it in `URL.createObjectURL(...)` for `<img src>` consumption — this is
 * the only way to render protected images, since the browser cannot attach
 * `Authorization` headers to a plain `<img>` request.
 *
 * The caller is responsible for revoking the object URL when done.
 */
export async function apiFetchBlob(path, options = {}) {
  const { signal } = options;
  const baseUrl = MVP_API_URL || BASE_URL;
  const url = new URL(`${trimTrailingSlash(baseUrl)}${path}`, window.location.origin);
  const requestHeaders = {
    Accept: '*/*',
    ...getAuthHeaders(),
  };
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: requestHeaders,
    signal,
    credentials: 'omit',
  });
  if (!res.ok) {
    if (res.status === 401 && isAdminPath(path)) {
      notifyUnauthorized();
    }
    throw new ApiError(res.status, res.statusText, null, {
      traceId: createTraceId(),
      method: 'GET',
      path,
      target: 'live-backend',
      url: url.toString(),
      status: res.status,
      ok: false,
    });
  }
  return res.blob();
}

/**
 * Reads the current bearer token from the in-memory store (`authToken.js`)
 * and turns it into an `Authorization` header. The store is populated by
 * `SessionProvider` once the GHL session resolves with an `agency_token`,
 * or when a developer pastes a super-admin bearer in the local connect
 * screen. Returns `{}` when no token is set so unauthenticated calls (the
 * GHL session POST itself) keep working.
 */
function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isAdminPath(path) {
  return typeof path === 'string' && path.startsWith('/v1/admin/');
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function createTrace({ method, path, body }) {
  return {
    traceId: createTraceId(),
    method,
    path,
    target: 'live-backend',
    startedAt: new Date().toISOString(),
    startMs: nowMs(),
    requestBody: redact(body),
  };
}

function finishTrace(trace, extra = {}) {
  const { startMs, ...publicTrace } = trace;
  return {
    ...publicTrace,
    durationMs: Math.round(nowMs() - startMs),
    ...extra,
  };
}

function createTraceId() {
  return `api_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return String(error);
}

function logApiError(trace) {
  if (!API_TRACE || typeof console === 'undefined') return;
  const status = trace.status ?? 'NETWORK';
  const label = `[api:error] ${trace.method} ${trace.path} -> ${status} (${trace.durationMs}ms)`;
  if (console.groupCollapsed) {
    console.groupCollapsed(label);
    console.error(trace);
    console.groupEnd();
    return;
  }
  console.error(label, trace);
}

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return '[formdata]';
  }
  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? '[redacted]' : redact(entry),
    ]),
  );
}

function isSensitiveKey(key) {
  return /token|secret|password|authorization|api[_-]?key/i.test(key);
}
