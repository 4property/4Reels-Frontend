import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Segmented } from '../../shared/Segmented.jsx';
import { Spinner } from '../../shared/Spinner.jsx';

const EMPTY_CREATE_FORM = {
  display_name: '',
  is_default: false,
  file: null,
  fileName: '',
};

const EMPTY_EDIT_FORM = {
  display_name: '',
  is_default: false,
};

const ACCEPTED_MIME = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'];
const ACCEPT_ATTR = ACCEPTED_MIME.join(',');
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Music library tab.
 *
 *   Create flow: <input type="file"> + display_name + is_default. The audio
 *   bytes go up as multipart; the server derives object_key and
 *   duration_seconds via ffprobe so the user never types them.
 *
 *   Edit flow: display_name + is_default only. object_key / duration_seconds
 *   stay server-owned and are surfaced read-only in the table.
 */
export function MusicLibrary({
  tracks,
  loading,
  disabled,
  uploading,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  const filtered = useMemo(
    () =>
      tracks.filter((track) => {
        if (filter === 'default' && !track.is_default) return false;
        const needle = `${track.display_name} ${track.object_key}`.toLowerCase();
        return !search || needle.includes(search.toLowerCase());
      }),
    [filter, search, tracks],
  );

  const resetCreateForm = () => {
    setCreateForm(EMPTY_CREATE_FORM);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePickFile = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setCreateForm((current) => ({ ...current, file: null, fileName: '' }));
      return;
    }
    if (file.type && !ACCEPTED_MIME.includes(file.type)) {
      setFileError('Unsupported format. Use mp3, m4a or wav.');
      event.target.value = '';
      setCreateForm((current) => ({ ...current, file: null, fileName: '' }));
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError('File too large (max 20MB).');
      event.target.value = '';
      setCreateForm((current) => ({ ...current, file: null, fileName: '' }));
      return;
    }
    setFileError(null);
    setCreateForm((current) => ({ ...current, file, fileName: file.name }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (editingId) {
      const body = {
        display_name: editForm.display_name.trim(),
        is_default: Boolean(editForm.is_default),
      };
      await onUpdate(editingId, body);
      setEditingId(null);
      setEditForm(EMPTY_EDIT_FORM);
      return;
    }

    if (!createForm.file) {
      setFileError('Selecciona un archivo de audio.');
      return;
    }
    const formData = new FormData();
    formData.append('file', createForm.file, createForm.file.name);
    formData.append('display_name', createForm.display_name.trim());
    formData.append('is_default', createForm.is_default ? 'true' : 'false');
    try {
      await onCreate(formData);
      resetCreateForm();
    } catch {
      // The parent surfaces the error message; keep form contents so the
      // user can correct and retry without re-picking the file.
    }
  };

  const startEdit = (track) => {
    setEditingId(track.music_id);
    setEditForm({
      display_name: track.display_name || '',
      is_default: Boolean(track.is_default),
    });
    setFileError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const isEdit = Boolean(editingId);
  const submitDisabled =
    disabled || uploading || (isEdit ? false : !createForm.file);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <form className="music-form" onSubmit={submit}>
        {isEdit ? (
          <>
            <label className="field music-form-name">
              <span className="label">Display name</span>
              <input
                className="input"
                value={editForm.display_name}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    display_name: event.target.value,
                  }))
                }
                placeholder="Sunset Drive"
                required
                disabled={disabled}
              />
            </label>
            <label className="music-default-check">
              <input
                type="checkbox"
                checked={editForm.is_default}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    is_default: event.target.checked,
                  }))
                }
                disabled={disabled}
              />
              <span>Default track</span>
            </label>
          </>
        ) : (
          <>
            <label className="field music-form-file">
              <span className="label">Audio file (mp3/m4a/wav, max 20MB)</span>
              <input
                ref={fileInputRef}
                className="input"
                type="file"
                accept={ACCEPT_ATTR}
                onChange={handlePickFile}
                required
                disabled={disabled || uploading}
                data-testid="music-upload-input"
              />
              {createForm.fileName && (
                <span className="music-file-name mono">{createForm.fileName}</span>
              )}
              {fileError && (
                <span
                  className="music-file-error"
                  data-testid="music-upload-error"
                >
                  {fileError}
                </span>
              )}
            </label>
            <label className="field music-form-name">
              <span className="label">Display name</span>
              <input
                className="input"
                value={createForm.display_name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    display_name: event.target.value,
                  }))
                }
                placeholder="Sunset Drive"
                required
                disabled={disabled || uploading}
              />
            </label>
            <label className="music-default-check">
              <input
                type="checkbox"
                checked={createForm.is_default}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    is_default: event.target.checked,
                  }))
                }
                disabled={disabled || uploading}
              />
              <span>Default track</span>
            </label>
          </>
        )}
        <div className="music-form-actions">
          {isEdit && (
            <button
              className="btn"
              type="button"
              onClick={cancelEdit}
              disabled={disabled}
            >
              <Icon name="close" size={14} /> Cancel
            </button>
          )}
          <button
            className="btn primary"
            type="submit"
            disabled={submitDisabled}
            data-testid="music-upload-submit"
          >
            {uploading ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              <>
                <Icon name={isEdit ? 'check' : 'plus'} size={14} />
                {isEdit ? 'Save track' : 'Upload track'}
              </>
            )}
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
                <td className="mono music-row-objectkey">{track.object_key}</td>
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
