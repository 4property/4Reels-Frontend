import { useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { sessionApi } from './api.js';
import { useGhlMvp } from './SessionProvider.jsx';

export function GhlMvpStatus() {
  const ghlMvp = useGhlMvp();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  if (!ghlMvp?.enabled) return null;
  const isAdminMode = Boolean(ghlMvp.adminMode);

  const testConnection = async () => {
    if (!ghlMvp.locationId) return;
    setTesting(true);
    setResult(null);
    try {
      const response = await sessionApi.testGhlMvpConnection({
        locationId: ghlMvp.locationId,
      });
      setResult({
        ok: true,
        message: `${response.account_count || 0} social accounts available`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="ghl-mvp-status">
      <div className="ghl-mvp-status-main">
        <span className={`badge ${ghlMvp.connected ? 'success' : 'warning'}`}>
          <span className="dot" />
          {isAdminMode ? 'Direct admin' : ghlMvp.connected ? 'GHL token saved' : 'GHL token missing'}
        </span>
        {ghlMvp.locationId && <span className="mono">Location {ghlMvp.locationId}</span>}
        <span className="mono">User {ghlMvp.userId}</span>
      </div>
      <div className="ghl-mvp-status-actions">
        {result && (
          <span className={`ghl-mvp-result ${result.ok ? 'ok' : 'err'}`}>
            <Icon name={result.ok ? 'check' : 'alert'} size={12} />
            {result.message}
          </span>
        )}
        {ghlMvp.locationId && (
          <button className="btn sm" onClick={testConnection} disabled={testing}>
            {testing ? <Spinner /> : <Icon name="zap" size={12} />}
            Test backend
          </button>
        )}
      </div>
    </div>
  );
}
