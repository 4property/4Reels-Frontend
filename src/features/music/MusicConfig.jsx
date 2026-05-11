import { useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import {
  useDecommissionTrack,
  useReconfigureTrack,
  useRegisterTrack,
  useTracks,
} from './hooks.js';
import { MusicLibrary } from './MusicLibrary.jsx';
import { MusicRules } from './MusicRules.jsx';
import './music.css';

export function MusicConfig() {
  const { tracks, count, loading, error, agencyId, refetch } = useTracks();
  const [registerTrack, registerState] = useRegisterTrack();
  const [reconfigureTrack, reconfigureState] = useReconfigureTrack();
  const [decommissionTrack, decommissionState] = useDecommissionTrack();
  const [tab, setTab] = useState('library');
  const [actionError, setActionError] = useState(null);

  const refreshAfter = async (operation) => {
    setActionError(null);
    try {
      await operation();
      refetch();
    } catch (err) {
      setActionError(err);
    }
  };

  const busy =
    registerState.loading || reconfigureState.loading || decommissionState.loading;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Music
            <span className="count-chip">{count} tracks</span>
          </h1>
          <p className="page-subtitle music-warning">
            <Icon name="shield" size={13} />
            Only royalty-free or licensed tracks are allowed.
          </p>
        </div>
      </div>

      {!agencyId && !loading && (
        <div className="card music-note">
          <div className="t-medium">No agency selected.</div>
          <div className="t-sm t-muted">
            Music is configured per agency.
          </div>
        </div>
      )}

      {(error || actionError) && (
        <div className="card music-note danger">
          <div className="t-medium">Music request failed.</div>
          <div className="t-sm t-muted">
            {(actionError || error)?.message || 'The backend rejected the request.'}
          </div>
        </div>
      )}

      <div className="subtabs">
        <button
          className={`subtab ${tab === 'library' ? 'active' : ''}`}
          onClick={() => setTab('library')}
        >
          <Icon name="music" size={12} /> Library
        </button>
        <button
          className={`subtab ${tab === 'rules' ? 'active' : ''}`}
          onClick={() => setTab('rules')}
        >
          <Icon name="zap" size={12} /> Selection rules
        </button>
      </div>

      {tab === 'library' ? (
        <MusicLibrary
          tracks={tracks}
          loading={loading}
          disabled={!agencyId || busy}
          onCreate={(body) =>
            refreshAfter(() => registerTrack({ agencyId, body }))
          }
          onUpdate={(musicId, body) =>
            refreshAfter(() => reconfigureTrack({ agencyId, musicId, body }))
          }
          onDelete={(musicId) =>
            refreshAfter(() => decommissionTrack({ agencyId, musicId }))
          }
        />
      ) : (
        <MusicRules tracks={tracks} />
      )}
    </div>
  );
}
