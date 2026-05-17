import { apiRequest } from '../../lib/api/client.js';

const STORAGE_KEY = '4reels.ghlMvpContext';

const LOCATION_PARAM_NAMES = [
  'location_id',
  'locationId',
  'ghl_location_id',
  'ghlLocationId',
  'activeLocation',
  'active_location',
  'activeLocationId',
  'location',
];

const USER_PARAM_NAMES = [
  'user_id',
  'userId',
  'ghl_user_id',
  'ghlUserId',
  'user',
  'user_id',
];

export const GHL_MVP_ENABLED = import.meta.env.VITE_GHL_MVP_ENABLED === 'true';
export const MVP_ADMIN_ENABLED = import.meta.env.VITE_MVP_ADMIN_ENABLED === 'true';

export function shouldUseMvpAdminMode() {
  if (!MVP_ADMIN_ENABLED) return false;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('admin') || params.get('mvp_admin');
  if (requested && ['1', 'true', 'yes'].includes(requested.toLowerCase())) return true;
  return window.location.pathname.startsWith('/v1/admin');
}

export async function resolveGhlMvpContext() {
  const localFallbackContext = completeContext(
    mergeContexts([
      readContextFromEnv(),
      readStoredGhlMvpContext(),
      readContextFromUrlLike(window.location.href, 'url-dev'),
      readContextFromReferrer(),
    ], 'direct'),
  );

  const parentPayload = await requestHighLevelUserData();
  const decryptedParentContext = await resolveEncryptedHighLevelContext(parentPayload);
  const parentContext = completeContext(
    mergeContexts([
      decryptedParentContext,
      normalizeContext(parentPayload, 'ghl-parent-plain'),
      localFallbackContext,
    ], 'ghl-parent'),
  );

  if (isCompleteContext(parentContext)) {
    traceContext('resolved-parent', parentContext);
    saveGhlMvpContext(parentContext);
    return parentContext;
  }

  if (isCompleteContext(localFallbackContext)) {
    traceContext('resolved-local-fallback', localFallbackContext);
    return localFallbackContext;
  }

  traceContext('missing-context', parentContext || localFallbackContext);
  return parentContext || localFallbackContext;
}

export function saveGhlMvpContext(context) {
  const normalized = normalizeContext(context, context?.source || 'manual');
  if (!isCompleteContext(normalized)) return null;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearGhlMvpContext() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function readStoredGhlMvpContext() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeContext(JSON.parse(raw), 'stored');
  } catch {
    return null;
  }
}

export function buildMvpUser(context, session) {
  const userId = context.userId || context.user_id;
  const locationId = context.locationId || context.location_id;
  return {
    id: userId,
    name: context.userName || context.user_name || shortLabel(userId, 'GHL User'),
    email: context.email || '',
    role: 'Admin',
    status: 'active',
    twoFA: false,
    sso: true,
    lastSeen: 'now',
    avatarHue: 215,
    joined: 'Marketplace',
    agencyId: session?.agency_id || null,
    // Agency users can edit every configuration tab for their own agency,
    // but they MUST NOT see the platform Admin console.
    permissions: {
      reels: 'rw',
      publish: 'rw',
      music: 'rw',
      brand: 'rw',
      automation: 'rw',
      admin: 'none',
      api: 'rw',
    },
    ghlMvp: {
      enabled: true,
      userId,
      locationId,
      source: context.source || 'unknown',
      connected: Boolean(session?.connected || session?.has_token),
      agencyId: session?.agency_id || null,
      session,
      encryptedContextOnly: Boolean(context.encryptedContextOnly),
      userFallback: Boolean(context.userFallback),
    },
  };
}

export function buildMvpAdminUser() {
  const userId = import.meta.env.VITE_MVP_ADMIN_USER_ID || 'admin-local';
  return {
    id: userId,
    name: import.meta.env.VITE_MVP_ADMIN_NAME || 'Platform Admin',
    email: import.meta.env.VITE_MVP_ADMIN_EMAIL || '',
    role: 'Super Admin',
    status: 'active',
    twoFA: false,
    sso: false,
    lastSeen: 'now',
    avatarHue: 280,
    joined: 'Direct admin',
    agencyId: null,
    // Platform super-admins only see the Admin console. The agency-scoped
    // configuration tabs (Reels / Music / Social / Brand / Defaults /
    // Automation) are hidden — the super-admin reaches that data by opening
    // an agency from inside the Admin drawer.
    permissions: {
      reels: 'none',
      publish: 'none',
      music: 'none',
      brand: 'none',
      automation: 'none',
      admin: 'rw',
      api: 'rw',
    },
    ghlMvp: {
      enabled: true,
      adminMode: true,
      userId,
      locationId: '',
      source: 'admin-direct',
      connected: false,
      agencyId: null,
      session: null,
      encryptedContextOnly: false,
      userFallback: false,
    },
  };
}

function readContextFromUrlLike(rawUrl, source) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl, window.location.origin);
    return mergeContexts([
      readContextFromParams(url.searchParams, `${source}-query`),
      readContextFromHash(url.hash, `${source}-hash`),
      readContextFromPath(url.pathname, `${source}-path`),
    ], source);
  } catch {
    return normalizeContext(extractContextFromText(rawUrl), source);
  }
}

function readContextFromReferrer() {
  return readContextFromUrlLike(document.referrer, 'referrer');
}

function readContextFromHash(hash, source) {
  const cleanHash = String(hash || '').replace(/^#/, '');
  if (!cleanHash) return null;

  const queryIndex = cleanHash.indexOf('?');
  const queryText = queryIndex >= 0 ? cleanHash.slice(queryIndex + 1) : cleanHash;
  const contexts = [
    queryText.includes('=') ? readContextFromParams(new URLSearchParams(queryText), source) : null,
    readContextFromPath(cleanHash, source),
    normalizeContext(extractContextFromText(cleanHash), source),
  ];
  return mergeContexts(contexts, source);
}

function readContextFromPath(pathname, source) {
  return normalizeContext(extractContextFromText(pathname), source);
}

function readContextFromParams(params, source) {
  return normalizeContext(
    {
      userId: readParam(params, USER_PARAM_NAMES),
      activeLocation: readParam(params, LOCATION_PARAM_NAMES),
      userName: readParam(params, ['user_name', 'userName', 'name']),
      email: readParam(params, ['email']),
    },
    source,
  );
}

function readContextFromEnv() {
  return normalizeContext(
    {
      userId: import.meta.env.VITE_GHL_USER_ID,
      activeLocation: import.meta.env.VITE_GHL_LOCATION_ID,
      userName: import.meta.env.VITE_GHL_USER_NAME,
      email: import.meta.env.VITE_GHL_USER_EMAIL,
    },
    'env',
  );
}

function readParam(params, names) {
  for (const name of names) {
    const value = params.get(name);
    if (value && value.trim()) return value.trim();
  }
  return '';
}

async function requestHighLevelUserData() {
  if (window.parent === window) return null;

  return new Promise((resolve) => {
    const timeoutMs = Number(import.meta.env.VITE_GHL_CONTEXT_TIMEOUT_MS || 2500);
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, Math.max(timeoutMs, 500));

    function onMessage(event) {
      const data = event.data;
      if (!data || data.message !== 'REQUEST_USER_DATA_RESPONSE') return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(data.payload || data.data || data);
    }

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
  });
}

async function resolveEncryptedHighLevelContext(parentPayload) {
  const encryptedData = extractEncryptedUserData(parentPayload);
  if (!encryptedData) return null;

  try {
    const response = await apiRequest('/v1/sessions/gohighlevel/context', {
      method: 'POST',
      body: { encryptedData },
    });
    return normalizeContext(response, 'ghl-sso-decrypted');
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.error('[ghl-context:decrypt-failed]', {
        message: error?.message || String(error),
        status: error?.status,
        trace: error?.trace,
      });
    }
    return {
      source: 'ghl-sso-encrypted',
      userId: '',
      locationId: '',
      encryptedContextOnly: true,
      decryptErrorKind: error?.status === 0 ? 'network' : 'backend',
      decryptError: error?.message || String(error),
    };
  }
}

function extractEncryptedUserData(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const parsed = parsePossibleJson(value);
    if (parsed) return extractEncryptedUserData(parsed);
    return value.trim();
  }
  if (typeof value !== 'object') return '';

  for (const key of ['encryptedData', 'encrypted_data', 'payload', 'data', 'sessionDetails']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    const nested = extractEncryptedUserData(candidate);
    if (nested) return nested;
  }

  return '';
}

function mergeContexts(contexts, fallbackSource) {
  const merged = {
    source: fallbackSource,
    userId: '',
    locationId: '',
    userName: '',
    email: '',
    encryptedContextOnly: false,
  };
  const sourceParts = [];

  for (const context of contexts) {
    if (!context) continue;
    if (!merged.userId && context.userId) {
      merged.userId = context.userId;
      sourceParts.push(`user:${context.source || fallbackSource}`);
    }
    if (!merged.locationId && context.locationId) {
      merged.locationId = context.locationId;
      sourceParts.push(`location:${context.source || fallbackSource}`);
    }
    if (!merged.userName && context.userName) merged.userName = context.userName;
    if (!merged.email && context.email) merged.email = context.email;
    if (context.encryptedContextOnly) merged.encryptedContextOnly = true;
    if (context.userFallback) merged.userFallback = true;
    if (!merged.decryptError && context.decryptError) merged.decryptError = context.decryptError;
    if (!merged.decryptErrorKind && context.decryptErrorKind) {
      merged.decryptErrorKind = context.decryptErrorKind;
    }
  }

  if (
    !merged.userId &&
    !merged.locationId &&
    !merged.userName &&
    !merged.email &&
    !merged.encryptedContextOnly &&
    !merged.decryptError
  ) {
    return null;
  }
  merged.source = sourceParts.join('+') || fallbackSource;
  return merged;
}

function completeContext(context) {
  if (!context?.locationId || context.userId) return context;
  return {
    ...context,
    userId: import.meta.env.VITE_GHL_FALLBACK_USER_ID || 'manual-test',
    source: `${context.source}+fallback-user`,
    userFallback: true,
  };
}

function normalizeContext(value, source) {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = parsePossibleJson(value);
    if (parsed) return normalizeContext(parsed, source);
    return normalizeContext(extractContextFromText(value), source);
  }

  const rawLocation = firstString([
    pick(value, LOCATION_PARAM_NAMES),
    pickNested(value, [
      ['payload', 'locationId'],
      ['payload', 'location_id'],
      ['payload', 'activeLocation'],
      ['data', 'locationId'],
      ['data', 'location_id'],
      ['data', 'activeLocation'],
      ['activeLocation', 'id'],
      ['activeLocation', '_id'],
      ['activeLocation', 'locationId'],
      ['activeLocation', 'location_id'],
      ['location', 'id'],
      ['location', '_id'],
      ['location', 'locationId'],
      ['location', 'location_id'],
      ['company', 'locationId'],
      ['company', 'location_id'],
      ['session', 'locationId'],
      ['session', 'location_id'],
      ['user', 'activeLocation'],
      ['user', 'locationId'],
      ['user', 'location_id'],
    ]),
    pickFirstFromArray(value.locations, ['id', '_id', 'locationId', 'location_id']),
  ]);

  const rawUser = firstString([
    pick(value, USER_PARAM_NAMES),
    pickNested(value, [
      ['payload', 'userId'],
      ['payload', 'user_id'],
      ['data', 'userId'],
      ['data', 'user_id'],
      ['user', 'id'],
      ['user', '_id'],
      ['user', 'userId'],
      ['user', 'user_id'],
      ['currentUser', 'id'],
      ['currentUser', '_id'],
      ['currentUser', 'userId'],
      ['session', 'userId'],
      ['session', 'user_id'],
    ]),
  ]);

  return {
    source,
    userId: String(rawUser || '').trim(),
    locationId: String(rawLocation || '').trim(),
    userName: String(value.userName || value.user_name || value.name || value.user?.name || '').trim(),
    email: String(value.email || value.user?.email || '').trim(),
    encryptedContextOnly: Boolean(value.encryptedContextOnly),
    userFallback: Boolean(value.userFallback),
    decryptErrorKind: String(value.decryptErrorKind || '').trim(),
    decryptError: String(value.decryptError || '').trim(),
  };
}

function extractContextFromText(text) {
  const value = String(text || '');
  const locationMatch = value.match(
    /(?:location_id|locationId|ghl_location_id|activeLocation|locations?)[=/:]([A-Za-z0-9_-]{8,})|\/locations?\/([A-Za-z0-9_-]{8,})/i,
  );
  const userMatch = value.match(
    /(?:user_id|userId|ghl_user_id|users?)[=/:]([A-Za-z0-9_-]{6,})|\/users?\/([A-Za-z0-9_-]{6,})/i,
  );
  return {
    activeLocation: locationMatch?.[1] || locationMatch?.[2] || '',
    userId: userMatch?.[1] || userMatch?.[2] || '',
  };
}

function pick(value, keys) {
  for (const key of keys) {
    const picked = value?.[key];
    if (isUsableValue(picked)) return picked;
  }
  return '';
}

function pickNested(value, paths) {
  for (const path of paths) {
    let current = value;
    for (const key of path) {
      current = current?.[key];
    }
    const normalized = normalizeNestedValue(current);
    if (isUsableValue(normalized)) return normalized;
  }
  return '';
}

function pickFirstFromArray(value, keys) {
  if (!Array.isArray(value)) return '';
  for (const item of value) {
    const normalized = normalizeNestedValue(item);
    if (isUsableValue(normalized)) return normalized;
    const picked = pick(item, keys);
    if (isUsableValue(picked)) return picked;
  }
  return '';
}

function normalizeNestedValue(value) {
  if (!value || typeof value !== 'object') return value;
  return value.id || value._id || value.locationId || value.location_id || value.userId || value.user_id || value;
}

function firstString(values) {
  for (const value of values) {
    if (isUsableValue(value)) return String(value).trim();
  }
  return '';
}

function isUsableValue(value) {
  return value !== undefined && value !== null && String(value).trim() && String(value) !== '[object Object]';
}

function parsePossibleJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function isCompleteContext(context) {
  return Boolean(context?.userId && context?.locationId);
}

function traceContext(label, context) {
  if (import.meta.env.VITE_API_TRACE === 'false') return;
  if (typeof console === 'undefined') return;
  console.info(`[ghl-context:${label}]`, {
    source: context?.source || 'none',
    locationId: context?.locationId || '',
    userId: context?.userId || '',
    userFallback: Boolean(context?.userFallback),
    encryptedContextOnly: Boolean(context?.encryptedContextOnly),
  });
}

function shortLabel(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return `${fallback} ${text.slice(0, 6)}`;
}
