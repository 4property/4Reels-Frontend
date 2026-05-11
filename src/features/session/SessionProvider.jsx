/**
 * Loads the current user once and shares them with every feature via
 * `useCurrentUser()` / `usePermissions()`.
 *
 * Once a session is established (or admin-direct mode is selected), this
 * provider also resolves the active agency by calling `/v1/admin/agencies/{id}`
 * and exposes it via `useCurrentAgency()` / `useCurrentAgencyId()`.
 *
 * Rendered near the root so sub-trees don't re-fetch. While loading, a very
 * small placeholder is shown â€” permissions must be resolved before any tab
 * renders, otherwise `<RequirePermission>` would flash a redirect.
 */
import { createContext, useContext } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { apiRequest, MVP_API_URL } from '../../lib/api/client.js';
import {
  clearAuthToken,
  setAuthToken,
  subscribeUnauthorized,
} from '../../lib/api/authToken.js';
import { sessionApi } from './api.js';
import {
  buildMvpAdminUser,
  buildMvpUser,
  clearGhlMvpContext,
  MVP_ADMIN_ENABLED,
  resolveGhlMvpContext,
  saveGhlMvpContext,
  shouldUseMvpAdminMode,
} from './ghlMvpContext.js';
import './session.css';

const SessionContext = createContext(/** @type {any} */(null));
const AgencyContext = createContext(/** @type {any} */({
  agency: null,
  agencyId: null,
  loading: false,
  error: null,
  reload: () => {},
  setAgencyId: () => {},
}));

export function SessionProvider({ children }) {
  return (
    <GhlMvpSessionProvider>
      <ActiveAgencyProvider>{children}</ActiveAgencyProvider>
    </GhlMvpSessionProvider>
  );
}

function GhlMvpSessionProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [context, setContext] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  const connect = useCallback(async (nextContext) => {
    const savedContext = saveGhlMvpContext(nextContext);
    if (!savedContext) {
      setContext(nextContext || null);
      setStatus('needs-context');
      return;
    }

    setStatus('connecting');
    setError(null);
    setContext(savedContext);
    try {
      const session = await sessionApi.createGhlMvpSession({
        locationId: savedContext.locationId,
        userId: savedContext.userId,
      });
      // Adjuntar el bearer ANTES de pasar a 'ready' para evitar la race
      // con el primer GET /v1/admin/agencies/{id} disparado por
      // ActiveAgencyProvider en el mismo render.
      if (session?.agency_token) {
        setAuthToken(session.agency_token);
      }
      setUser(buildMvpUser(savedContext, session));
      setStatus('ready');
    } catch (err) {
      // 503 AGENCY_AUTH_NOT_CONFIGURED → backend admite la sesión pero no
      // tiene ADMIN_AGENCY_TOKEN_SECRET. Volvemos a la pantalla de gate
      // con el código de error explícito para que la UI lo trate como
      // "configuración rota" en lugar de un error genérico.
      const code = err?.body?.code || err?.body?.error;
      if (err?.status === 503 && code === 'AGENCY_AUTH_NOT_CONFIGURED') {
        clearAuthToken();
        setError({ code: 'AGENCY_AUTH_NOT_CONFIGURED', message: err.message });
        setStatus('needs-context');
        return;
      }
      setError(err);
      setStatus('error');
    }
  }, []);

  // 401 en cualquier ruta /v1/admin/* dispara el listener; el provider
  // tira el token y vuelve al gate. Sin retry ni refresh — feature 5
  // del back no define refresh todavía.
  useEffect(() => {
    return subscribeUnauthorized(() => {
      clearAuthToken();
      setStatus('needs-context');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (shouldUseMvpAdminMode()) {
      setUser(buildMvpAdminUser());
      setStatus('ready');
      return () => {
        cancelled = true;
      };
    }
    resolveGhlMvpContext().then((resolvedContext) => {
      if (cancelled) return;
      if (!resolvedContext?.userId || !resolvedContext?.locationId) {
        setContext(resolvedContext || null);
        setStatus('needs-context');
        return;
      }
      connect(resolvedContext);
    });
    return () => {
      cancelled = true;
    };
  }, [connect]);

  const reset = () => {
    clearAuthToken();
    clearGhlMvpContext();
    setContext(null);
    setUser(null);
    setError(null);
    setStatus('needs-context');
  };

  if (status === 'loading' || status === 'connecting') {
    return (
      <div className="session-fallback loading">
        <Spinner /> Connecting GoHighLevel location...
      </div>
    );
  }

  if (status === 'needs-context' || status === 'error') {
    return (
      <GhlMvpConnectScreen
        context={context}
        error={error}
        onConnect={connect}
        onAdmin={(localBearer) => {
          // En modo super-admin local, si el operador ha pegado un bearer
          // lo guardamos antes de marcar la sesión como ready para que la
          // primera llamada admin lleve Authorization. Si no lo ha pegado,
          // la sesión arranca sin token y la primera llamada admin va a
          // fallar con 401, lo que vuelve a esta pantalla.
          if (localBearer) {
            setAuthToken(localBearer);
          }
          setUser(buildMvpAdminUser());
          setStatus('ready');
        }}
        onReset={reset}
      />
    );
  }

  return (
    <SessionContext.Provider value={user}>
      {children}
    </SessionContext.Provider>
  );
}

function ActiveAgencyProvider({ children }) {
  const user = useContext(SessionContext);
  const initialAgencyId = user?.agencyId || user?.ghlMvp?.agencyId || null;

  const [agencyId, setAgencyId] = useState(initialAgencyId);
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!agencyId) {
      setAgency(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}`);
      setAgency(detail || null);
    } catch (err) {
      setError(err);
      setAgency(null);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Keep state in sync if the user object changes (e.g. switching admin/GHL mode)
  useEffect(() => {
    const next = user?.agencyId || user?.ghlMvp?.agencyId || null;
    setAgencyId((current) => (current === next ? current : next));
  }, [user?.agencyId, user?.ghlMvp?.agencyId]);

  const value = {
    agency,
    agencyId,
    loading,
    error,
    reload,
    setAgencyId,
  };

  return <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>;
}

function GhlMvpConnectScreen({ context, error, onConnect, onAdmin, onReset }) {
  const [locationId, setLocationId] = useState(context?.locationId || '');
  const [userId, setUserId] = useState(context?.userId || '');
  const [submitting, setSubmitting] = useState(false);
  const [localBearer, setLocalBearer] = useState('');
  const encryptedOnly = Boolean(context?.encryptedContextOnly);
  const authNotConfigured = error?.code === 'AGENCY_AUTH_NOT_CONFIGURED';

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    await onConnect({
      locationId,
      userId,
      source: 'manual',
    });
    setSubmitting(false);
  };

  const submitLocalAdmin = (event) => {
    event.preventDefault();
    onAdmin(localBearer.trim() || null);
  };

  return (
    <main className="ghl-mvp-screen">
      <section className="ghl-mvp-panel">
        <div className="ghl-mvp-icon">
          <Icon name="link" size={20} />
        </div>
        <div>
          <h1 className="ghl-mvp-title">Connect GoHighLevel</h1>
          <p className="ghl-mvp-copy">
            Send the active location and user to the backend MVP at {MVP_API_URL}.
          </p>
        </div>

        {authNotConfigured && (
          <div className="ghl-mvp-note danger">
            <Icon name="alert" size={14} />
            Backend admin auth not configured — contact ops.
            (`AGENCY_AUTH_NOT_CONFIGURED`: the backend received the GHL
            session but ADMIN_AGENCY_TOKEN_SECRET is not set.)
          </div>
        )}

        {encryptedOnly && (
          <div className="ghl-mvp-note">
            <Icon name="info" size={14} />
            HighLevel returned encrypted user context. Configure the backend
            GO_HIGH_LEVEL_APP_SHARED_SECRET so this page can resolve the active location.
          </div>
        )}

        {context?.decryptError && (
          <div className="ghl-mvp-note danger">
            <Icon name="alert" size={14} />
            {context.decryptError}
          </div>
        )}

        {error && !authNotConfigured && (
          <div className="ghl-mvp-note danger">
            <Icon name="alert" size={14} />
            {error.message || 'Could not create the MVP session.'}
          </div>
        )}

        <form className="ghl-mvp-form" onSubmit={submit}>
          <label className="field">
            <span className="label">Location ID</span>
            <input
              className="input mono"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              placeholder="v8H1XNB3YCQmVHRhqDoM"
              required
            />
          </label>
          <label className="field">
            <span className="label">User ID</span>
            <input
              className="input mono"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="5lichOFpkqT72Jb7adil"
              required
            />
          </label>

          <div className="ghl-mvp-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : <Icon name="check" size={14} />}
              Connect
            </button>
            <button className="btn" type="button" onClick={onReset}>
              <Icon name="refresh" size={14} />
              Reset
            </button>
            {MVP_ADMIN_ENABLED && (
              <button
                className="btn ghost"
                type="button"
                onClick={() => onAdmin(null)}
              >
                <Icon name="shield" size={14} />
                Continue as admin
              </button>
            )}
          </div>
        </form>

        {MVP_ADMIN_ENABLED && (
          <details className="ghl-mvp-admin-bearer">
            <summary>Local super-admin (developers only)</summary>
            <p className="ghl-mvp-copy">
              Local super-admin only — NEVER paste a production bearer here on a
              shared machine. The token is kept in <code>sessionStorage</code> and
              cleared when the tab closes.
            </p>
            <form className="ghl-mvp-form" onSubmit={submitLocalAdmin}>
              <label className="field">
                <span className="label">Super-admin bearer</span>
                <input
                  className="input mono"
                  type="password"
                  value={localBearer}
                  onChange={(event) => setLocalBearer(event.target.value)}
                  placeholder="paste ADMIN_API_TOKEN here"
                  autoComplete="off"
                />
              </label>
              <div className="ghl-mvp-actions">
                <button
                  className="btn primary"
                  type="submit"
                  disabled={!localBearer.trim()}
                >
                  <Icon name="shield" size={14} />
                  Connect as super-admin
                </button>
              </div>
            </form>
          </details>
        )}
      </section>
    </main>
  );
}

export function useCurrentUser() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useCurrentUser must be used inside <SessionProvider>');
  return ctx;
}

export function usePermissions() {
  return useCurrentUser().permissions || {};
}

export function useGhlMvp() {
  return useCurrentUser().ghlMvp || null;
}

export function useCurrentAgency() {
  const ctx = useContext(AgencyContext);
  if (!ctx) {
    throw new Error('useCurrentAgency must be used inside <SessionProvider>');
  }
  return ctx;
}

export function useCurrentAgencyId() {
  return useCurrentAgency().agencyId;
}
