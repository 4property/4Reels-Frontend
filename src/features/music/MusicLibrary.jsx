import { useMemo, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Segmented } from '../../shared/Segmented.jsx';

const EMPTY_FORM = {
  display_name: '',
  object_key: '',
  duration_seconds: '30',
  is_default: false,
};

export function MusicLibrary({ tracks, loading, disabled, onCreate, onUpdate, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = useMemo(
    () =>
      tracks.filter((track) => {
        if (filter === 'default' && !track.is_default) return false;
        const needle = `${track.display_name} ${track.object_key}`.toLowerCase();
        return !search || needle.includes(search.toLowerCase());
      }),
    [filter, search, tracks],
  );

  const submit = async (event) => {
    event.preventDefault();
    const body = {
      display_name: form.display_name.trim(),
      object_key: form.object_key.trim(),
      duration_seconds: Number(form.duration_seconds),
      is_default: Boolean(form.is_default),
    };
    if (editingId) {
      await onUpdate(editingId, body);
    } else {
      await onCreate(body);
    }
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (track) => {
    setEditingId(track.music_id);
    setForm({
      display_name: track.display_name || '',
      object_key: track.object_key || '',
      duration_seconds: String(track.duration_seconds || 30),
      is_default: Boolean(track.is_default),
    });
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <form className="music-form" onSubmit={submit}>
        <label className="field">
          <span className="label">Display name</span>
          <input
            className="input"
            value={form.display_name}
            onChange={(event) =>
              setForm((current) => ({ ...current, display_name: event.target.value }))
            }
            placeholder="Sunset Drive"
            required
            disabled={disabled}
          />
        </label>
        <label className="field music-form-key">
          <span className="label">Object key</span>
          <input
            className="input mono"
            value={form.object_key}
            onChange={(event) =>
              setForm((current) => ({ ...current, object_key: event.target.value }))
            }
            placeholder="agencies/ckp/music/sunset-drive.mp3"
            required
            disabled={disabled}
          />
        </label>
        <label className="field music-form-duration">
          <span className="label">Duration</span>
          <input
            className="input"
            type="number"
            min="1"
            max="600"
            value={form.duration_seconds}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                duration_seconds: event.target.value,
              }))
            }
            required
            disabled={disabled}
          />
        </label>
        <label className="music-default-check">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(event) =>
              setForm((current) => ({ ...current, is_default: event.target.checked }))
            }
            disabled={disabled}
          />
          <span>Default track</span>
        </label>
        <div className="music-form-actions">
          {editingId && (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              disabled={disabled}
            >
              <Icon name="close" size={14} /> Cancel
            </button>
          )}
          <button className="btn primary" type="submit" disabled={disabled}>
            <Icon name={editingId ? 'check' : 'plus'} size={14} />
            {editingId ? 'Save track' : 'Register track'}
          </button>
        </div>
      </form>

      <div className="card-header music-card-head">
        <div className="row gap-4 grow min-w-0 row-wrap">
          <div className="search music-search">
            <Icon name="search" size={14} />
            <input
              placeholder="Search tracks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Segmented
            options={[
              { value: 'all', label: 'All' },
              { value: 'default', label: 'Default' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="muted t-sm">
          {tracks.filter((track) => track.is_default).length} default
        </div>
      </div>

      <div className="music-table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Track</th>
              <th>Object key</th>
              <th>Duration</th>
              <th>Default</th>
              <th>Created</th>
              <th style={{ width: 88 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((track) => (
              <tr key={track.music_id}>
                <td>
                  <div className="music-row-title">{track.display_name}</div>
                  <div className="music-row-artist mono">{track.music_id}</div>
                </td>
                <td className="mono">{track.object_key}</td>
                <td className="num">{formatDuration(track.duration_seconds)}</td>
                <td>
                  {track.is_default ? (
                    <span className="badge accent">default</span>
                  ) : (
                    <span className="badge">library</span>
                  )}
                </td>
                <td>{formatDate(track.created_at)}</td>
                <td>
                  <div className="row gap-2">
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label={`Edit ${track.display_name}`}
                      onClick={() => startEdit(track)}
                      disabled={disabled}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label={`Delete ${track.display_name}`}
                      onClick={() => onDelete(track.music_id)}
                      disabled={disabled}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && tracks.length === 0 && <div className="empty">Loading...</div>}
      {!loading && tracks.length === 0 && <div className="empty">No music tracks yet.</div>}
      {!loading && tracks.length > 0 && filtered.length === 0 && (
        <div className="empty">No tracks match the current filter.</div>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  const total = Number(seconds) || 0;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
