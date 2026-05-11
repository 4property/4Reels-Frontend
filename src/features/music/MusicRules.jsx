import { Icon } from '../../shared/Icon.jsx';
import { Toggle } from '../../shared/Toggle.jsx';

export function MusicRules({ tracks }) {
  const defaultTracks = tracks.filter((track) => track.is_default);
  const libraryTracks = tracks.filter((track) => !track.is_default);

  return (
    <div className="stack gap-8">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Default pool</div>
            <div className="card-subtitle">
              Tracks marked as default are eligible for automatic reel selection.
            </div>
          </div>
        </div>
        <TrackChipList tracks={defaultTracks} empty="No default tracks selected." />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Library-only tracks</div>
            <div className="card-subtitle">
              These tracks stay available for manual assignment.
            </div>
          </div>
        </div>
        <TrackChipList tracks={libraryTracks} empty="All tracks are in the default pool." />
      </div>

      <div className="card">
        <div className="card-body">
          <Toggle
            on={true}
            onChange={() => {}}
            label="Fall back to full library if no default track exists"
            sub="The renderer can pick any registered track when the default pool is empty."
          />
        </div>
      </div>
    </div>
  );
}

function TrackChipList({ tracks, empty }) {
  if (tracks.length === 0) {
    return <div className="empty">{empty}</div>;
  }
  return (
    <div className="music-rule-chip-list">
      {tracks.map((track) => (
        <Chip key={track.music_id} title={track.display_name} />
      ))}
    </div>
  );
}

function Chip({ title }) {
  return (
    <span className="music-chip">
      <Icon name="music" size={10} /> {title}
    </span>
  );
}
