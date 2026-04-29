/**
 * Loads the current user once and shares them with every feature via
 * `useCurrentUser()` / `usePermissions()`.
 *
 * Rendered near the root so sub-trees don't re-fetch. While loading, a very
 * small placeholder is shown — permissions must be resolved before any tab
 * renders, otherwise `<RequirePermission>` would flash a redirect.
 */
import { createContext, useContext } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { MVP_API_URL } from '../../lib/api/client.js';
import { useApi } from '../../lib/hooks/useApi.js';
import { sessionApi } from './api.js';
import {
  buildMvpAdminUser,
  buildMvpUser,
  clearGhlMvpContext,
  GHL_MVP_ENABLED,
  MVP_ADMIN_ENABLED,
  resolveGhlMvpContext,
  saveGhlMvpContext,
  shouldUseMvpAdminMode,
} from './ghlMvpContext.js';
import './session.css';

const SessionContext = createContext(/** @type {any} */(null));

export function SessionProvider({ children }) {
  if (GHL_MVP_ENABLED) {
    return <GhlMvpSessionProvider>{children}</GhlMvpSessionProvider>;
  }

  return <ApiSessionProvider>{children}</ApiSessionProvider>;
}

function ApiSessionProvider({ children }) {
  const { data, loading, error } = useApi(() => sessionApi.getCurrentUser(), []);

  if (loading) {
    return <div className="session-fallback loading">Loading…</div>;
  }

  if (error || !data) {
    return <div className="session-fallback error">Could not load session.</div>;
  }

  return (
    <SessionContext.Provider value={data}>
      {children}
    </SessionContext.Provider>
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
      setUser(buildMvpUser(savedContext, session));
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
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
        onAdmin={() => {
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

function GhlMvpConnectScreen({ context, error, onConnect, onAdmin, onReset }) {
  const [locationId, setLocationId] = useState(context?.locationId || '');
  const [userId, setUserId] = useState(context?.userId || '');
  const [submitting, setSubmitting] = useState(false);
  const encryptedOnly = Boolean(context?.encryptedContextOnly);

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

        {error && (
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
              <button className="btn ghost" type="button" onClick={onAdmin}>
                <Icon name="shield" size={14} />
                Continue as admin
              </button>
            )}
          </div>
        </form>
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
