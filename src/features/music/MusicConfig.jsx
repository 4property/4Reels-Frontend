import { useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import {
  useDecommissionTrack,
  useReconfigureTrack,
  useTracks,
  useUploadTrack,
} from './hooks.js';
import { MusicLibrary } from './MusicLibrary.jsx';
import { MusicRules } from './MusicRules.jsx';
import './music.css';

export function MusicConfig() {
  const { tracks, count, loading, error, agencyId, refetch } = useTracks();
  const [uploadTrack, uploadState] = useUploadTrack();
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
      throw err;
    }
  };

  const busy =
    uploadState.loading || reconfigureState.loading || decommissionState.loading;

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
            {humanizeMusicError(actionError || error)}
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
          uploading={uploadState.loading}
          onCreate={(formData) =>
            refreshAfter(() => uploadTrack({ agencyId, formData }))
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

/**
 * Map the canonical music-upload error codes from feature 22 of the back to
 * user-friendly copy. Falls back to the backend's own message when the
 * code is unknown so the user always sees something actionable.
 */
function humanizeMusicError(err) {
  if (!err) return 'The backend rejected the request.';
  const status = err.status;
  const body = err.body || {};
  const code = body?.code || body?.error;

  if (status === 413) return 'File too large (max 20MB).';
  if (status === 400 && code === 'MUSIC_TRACK_AUDIO_INVALID') {
    if (body?.hint) return body.hint;
    return "Couldn't process the audio (corrupt file or unsupported format?).";
  }
  if (status === 422) {
    return body?.message || body?.error || 'Missing required fields (display_name).';
  }
  return body?.message || body?.error || err.message || 'The backend rejected the request.';
}
