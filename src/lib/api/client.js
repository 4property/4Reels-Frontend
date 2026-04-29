/**
 * Single entry point for every network request the app makes.
 *
 * - In dev, if VITE_USE_MOCK is not set to "false", regular product requests
 *   are routed to the in-memory mock in `./mock.js`. The mock resolves with
 *   plain JS objects and simulates ~150ms of latency.
 * - MVP GoHighLevel requests under `/mvp/` always bypass the mock API and use
 *   VITE_MVP_API_URL.
 * - In prod (or when VITE_USE_MOCK=false), requests go to fetch() against
 *   VITE_API_URL.
 *
 * Feature code must never call fetch directly — call `apiRequest` through a
 * feature-level `api.js` module (e.g. `features/reels/api.js`) which knows its
 * own paths and shapes.
 */
import { ApiError } from './ApiError.js';

export const BASE_URL = import.meta.env.VITE_API_URL || '';
export const MVP_API_URL = import.meta.env.VITE_MVP_API_URL || BASE_URL;
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
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
 * @param {string} path  Path starting with `/`, e.g. `/reels`.
 * @param {RequestOptions} [options]
 * @returns {Promise<any>} Parsed JSON response.
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, query, headers, signal } = options;
  const isMvpRequest =
    path.startsWith('/mvp/') || path.startsWith('/admin/agencies');
  const trace = createTrace({ method, path, body, isMvpRequest });

  if (USE_MOCK && !isMvpRequest) {
    try {
      const { handleMockRequest } = await import('./mock/index.js');
      return await handleMockRequest(path, { method, body, query });
    } catch (error) {
      const apiError = toApiError(error, `Mock API error calling ${method} ${path}`);
      apiError.trace = finishTrace(trace, {
        mock: true,
        error: serializeError(error),
      });
      logApiError(apiError.trace);
      throw apiError;
    }
  }

  const baseUrl = isMvpRequest ? MVP_API_URL : BASE_URL;
  const url = new URL(`${trimTrailingSlash(baseUrl)}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: isMvpRequest ? 'omit' : 'include',
    });
  } catch (error) {
    const apiError = new ApiError(
      0,
      `Network/CORS error calling ${url.origin}. Check that the backend is deployed with CORS enabled.`,
      { cause: error instanceof Error ? error.message : String(error) },
      finishTrace(trace, {
        mock: false,
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
    const apiError = new ApiError(
      res.status,
      payload?.message || payload?.error || res.statusText,
      payload || text,
      finishTrace(trace, {
        mock: false,
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
 * Placeholder — when auth is wired, this is the single spot that attaches
 * Authorization + X-Tenant-Id headers.
 */
function getAuthHeaders() {
  return {};
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function createTrace({ method, path, body, isMvpRequest }) {
  return {
    traceId: createTraceId(),
    method,
    path,
    target: isMvpRequest ? 'mvp-backend' : 'app-backend',
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

function toApiError(error, fallbackMessage) {
  if (error instanceof ApiError) return error;
  return new ApiError(0, error?.message || fallbackMessage, { cause: serializeError(error) });
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
  const status = trace.status ?? (trace.mock ? 'MOCK' : 'NETWORK');
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
