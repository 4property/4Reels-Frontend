import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Segmented } from '../../shared/Segmented.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { Toggle } from '../../shared/Toggle.jsx';
import { defaultsApi } from './api.js';
import {
  useIntroDelete,
  useIntroUpload,
  useOutroDelete,
  useOutroUpload,
} from './hooks.js';

const ACCEPTED_MIME = ['video/mp4', 'video/quicktime'];
const ACCEPT_ATTR = '.mp4,.mov,video/mp4,video/quicktime';
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_DURATION_S = 10;
const MIN_DURATION_S = 1;

/**
 * Feature 33 (outro) + feature 34 (intro) — shared card wired to the live
 * backend. The two kinds use identical UX and validation; only the endpoint
 * path, the persisted field names and the human-facing copy differ. Both
 * `OutroCard` and `IntroCard` are thin wrappers around this component.
 *
 *   POST /v1/admin/agencies/{id}/{kind}/upload  (multipart, field `file`)
 *   GET  /v1/admin/agencies/{id}/{kind}/file
 *   DELETE /v1/admin/agencies/{id}/{kind}
 *   PUT /v1/admin/agencies/{id}/defaults  ← for `{kind}_enabled` (composed
 *                                            in the parent's "Save defaults").
 *
 * The card derives its persisted state from the `defaults` slice the parent
 * page reads via `useReelDefaults`:
 *
 *   - `defaults.{kind}_source` ∈ {"uploaded", "none"}  (default: "none").
 *   - `defaults.{kind}_object_key` is the S3-style key.
 *   - `defaults.{kind}_duration_seconds` is the ffprobe-derived length.
 *
 * Source segmented:
 *   - "Uploaded video"   primary, enabled
 *   - "Brand card"       disabled with tooltip "Coming soon"
 *   - "None"             enabled — clicking it dispatches DELETE /{kind}
 *
 * Client-side validation mirrors the server:
 *   - size ≤ 50 MB
 *   - mime ∈ {video/mp4, video/quicktime}
 *   - duration ∈ [1s, 10s], probed locally via `<video>` + loadedmetadata
 *     (injectable through `probeDurationSeconds` for tests, or via the
 *     `window.__4reelsProbe{Intro|Outro}Duration` hook).
 *
 * The "Enabled" toggle persists `{kind}_enabled` via the shared PUT /defaults
 * dispatched from the parent's "Save defaults" button — no PUT fires here.
 */
export function UploadVideoCard({
  kind,
  copy,
  enabled,
  setEnabled,
  duration,
  setDuration,
  defaults,
  agencyId,
  refetchDefaults,
  probeDurationSeconds,
}) {
  if (kind !== 'intro' && kind !== 'outro') {
    throw new Error(`UploadVideoCard: invalid kind "${kind}"`);
  }
  const useUpload = kind === 'intro' ? useIntroUpload : useOutroUpload;
  const useRemove = kind === 'intro' ? useIntroDelete : useOutroDelete;
  const [upload, { loading: uploading }] = useUpload();
  const [remove, { loading: removing }] = useRemove();
  const [error, setError] = useState(null);
  const [optimistic, setOptimistic] = useState(null);
  const inputRef = useRef(null);

  const fields = useMemo(() => kindFields(kind), [kind]);
  const probe = probeDurationSeconds || defaultDurationProbe(kind);

  const persisted = useMemo(
    () => ({
      source: defaults?.[fields.source] || 'none',
      objectKey: defaults?.[fields.objectKey] || null,
      durationSeconds:
        typeof defaults?.[fields.durationSeconds] === 'number'
          ? defaults[fields.durationSeconds]
          : null,
    }),
    [defaults, fields],
  );

  // When the back finishes a roundtrip the optimistic shadow goes away.
  useEffect(() => {
    setOptimistic(null);
  }, [defaults]);

  const view = optimistic || persisted;
  const hasFile = view.source === 'uploaded' && Boolean(view.objectKey);

  const handleSource = async (next) => {
    const current = hasFile ? 'uploaded' : 'none';
    if (next === current) return;
    if (next === 'brand-card') return;
    setError(null);
    if (next === 'uploaded') {
      // No GET pressed; just open the picker.
      inputRef.current?.click();
      return;
    }
    if (next === 'none') {
      await runDelete();
    }
  };

  const handlePick = () => {
    if (uploading || removing) return;
    inputRef.current?.click();
  };

  const handleFile = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setError(null);

    if (!ACCEPTED_MIME.includes(picked.type)) {
      setError('Only MP4 or MOV');
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError('File must be ≤50MB');
      return;
    }

    let durationS;
    try {
      durationS = await probe(picked);
    } catch {
      setError('Could not read video metadata');
      return;
    }
    if (
      !Number.isFinite(durationS) ||
      durationS > MAX_DURATION_S ||
      durationS < MIN_DURATION_S
    ) {
      setError('Duration must be 1–10s');
      return;
    }

    try {
      const result = await upload({ agencyId, file: picked });
      setOptimistic({
        source: result?.[fields.source] || 'uploaded',
        objectKey: result?.[fields.objectKey] || null,
        durationSeconds:
          typeof result?.[fields.durationSeconds] === 'number'
            ? result[fields.durationSeconds]
            : durationS,
        fileName: picked.name,
        sizeBytes: picked.size,
      });
      await refetchDefaults?.();
    } catch (err) {
      setError(humaniseUploadError(err));
    }
  };

  const runDelete = async () => {
    setError(null);
    try {
      await remove({ agencyId });
      setOptimistic({
        source: 'none',
        objectKey: null,
        durationSeconds: null,
      });
      await refetchDefaults?.();
    } catch (err) {
      setError(err?.body?.error || err?.message || copy.deleteFallbackError);
    }
  };

  const previewUrl =
    hasFile && agencyId
      ? kind === 'intro'
        ? defaultsApi.introFileUrl(agencyId)
        : defaultsApi.outroFileUrl(agencyId)
      : null;
  const busy = uploading || removing;
  const testIds = kindTestIds(kind);

  return (
    <div className="card" data-testid={testIds.card}>
      <div className="card-header">
        <div>
          <div className="card-title">{copy.title}</div>
          <div className="card-subtitle">{copy.subtitle}</div>
        </div>
        <Toggle on={enabled} onChange={setEnabled} />
      </div>

      <div className="card-body" style={{ display: enabled ? 'block' : 'none' }}>
        <div className="io-body">
          <Preview
            source={hasFile ? 'uploaded' : 'none'}
            previewUrl={previewUrl}
            view={view}
            testIds={testIds}
            tagLabel={copy.previewTag}
            noneLabel={copy.previewNoneLabel}
          />
          <div className="stack gap-7">
            <div className="field">
              <div className="label">Source</div>
              <Segmented
                options={[
                  { value: 'uploaded', label: 'Uploaded video' },
                  {
                    value: 'brand-card',
                    label: 'Brand card',
                    disabled: true,
                    title: 'Coming soon',
                  },
                  { value: 'none', label: 'None' },
                ]}
                value={hasFile ? 'uploaded' : 'none'}
                onChange={handleSource}
              />
            </div>

            <div>
              <div className="label" style={{ marginBottom: 6 }}>Video file</div>
              {busy ? (
                <div className="io-file-chip" data-testid={testIds.uploading}>
                  <div className="io-file-icon"><Spinner /></div>
                  <div className="grow min-w-0">
                    <div className="io-file-name">
                      {uploading ? 'Uploading…' : 'Removing…'}
                    </div>
                    <div className="io-file-meta">Please wait</div>
                  </div>
                </div>
              ) : hasFile ? (
                <div className="io-file-chip" data-testid={testIds.fileChip}>
                  <div className="io-file-icon">
                    <Icon name="film" size={14} />
                  </div>
                  <div className="grow min-w-0">
                    <div className="io-file-name" data-testid={testIds.fileName}>
                      {chipName(view, persisted, copy.chipFallbackName)}
                    </div>
                    <div className="io-file-meta" data-testid={testIds.fileMeta}>
                      {formatChipMeta(view)}
                    </div>
                  </div>
                  <button
                    className="btn sm"
                    type="button"
                    onClick={handlePick}
                    data-testid={testIds.replace}
                  >
                    <Icon name="edit" size={12} /> Replace
                  </button>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={runDelete}
                    data-testid={testIds.trash}
                    aria-label={copy.removeAria}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="io-dropzone"
                  onClick={handlePick}
                  data-testid={testIds.dropzone}
                  style={{ width: '100%', cursor: 'pointer', border: 'none' }}
                >
                  <Icon name="upload" size={18} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Drop an MP4 / MOV, or{' '}
                    <span className="t-accent t-medium">browse</span>
                  </div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    Max 10s · MP4 or MOV · 50 MB
                  </div>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_ATTR}
                onChange={handleFile}
                style={{ display: 'none' }}
                data-testid={testIds.input}
              />
              {error && (
                <div
                  className={`hint ${kind}-error`}
                  data-testid={testIds.error}
                  style={{ marginTop: 6, color: 'var(--danger, #b03030)' }}
                >
                  {error}
                </div>
              )}
            </div>

            <div className="field">
              <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                {copy.durationLabel} <span className="mono">{Number(duration).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="1" max={MAX_DURATION_S} step="0.5"
                value={duration}
                onChange={(e) => setDuration(+e.target.value)}
                style={{ width: '100%' }}
              />
              <div className="hint">{copy.durationHint}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Preview({ source, previewUrl, view, testIds, tagLabel, noneLabel }) {
  if (source === 'uploaded' && previewUrl) {
    return (
      <div>
        <div className="io-preview">
          <video
            className="cover-media"
            src={previewUrl}
            muted
            loop
            playsInline
            data-testid={testIds.previewVideo}
          />
          <div className="io-preview-tag">
            <Icon name="play" size={9} /> {tagLabel}
          </div>
          {typeof view.durationSeconds === 'number' && (
            <div className="io-preview-duration" data-testid={testIds.previewDuration}>
              {formatSeconds(view.durationSeconds)}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="io-preview">
        <div className="io-none">
          <div>
            <Icon name="film" size={22} />
            <div style={{ fontSize: 11, marginTop: 6 }}>{noneLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function kindFields(kind) {
  return {
    source: `${kind}_source`,
    objectKey: `${kind}_object_key`,
    durationSeconds: `${kind}_duration_seconds`,
  };
}

function kindTestIds(kind) {
  return {
    card: `${kind}-card`,
    uploading: `${kind}-uploading`,
    fileChip: `${kind}-file-chip`,
    fileName: `${kind}-file-name`,
    fileMeta: `${kind}-file-meta`,
    replace: `${kind}-replace`,
    trash: `${kind}-trash`,
    dropzone: `${kind}-dropzone`,
    input: `${kind}-input`,
    error: `${kind}-error`,
    previewVideo: `${kind}-preview-video`,
    previewDuration: `${kind}-preview-duration`,
  };
}

function chipName(view, persisted, fallback) {
  if (view.fileName) return view.fileName;
  if (view.objectKey) {
    const slash = view.objectKey.lastIndexOf('/');
    return slash >= 0 ? view.objectKey.slice(slash + 1) : view.objectKey;
  }
  if (persisted?.objectKey) {
    const slash = persisted.objectKey.lastIndexOf('/');
    return slash >= 0 ? persisted.objectKey.slice(slash + 1) : persisted.objectKey;
  }
  return fallback;
}

function formatChipMeta(view) {
  const parts = [];
  if (typeof view.durationSeconds === 'number') {
    parts.push(formatSeconds(view.durationSeconds));
  }
  if (typeof view.sizeBytes === 'number') {
    parts.push(formatBytes(view.sizeBytes));
  }
  return parts.join(' · ') || '—';
}

function formatSeconds(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  if (total < 60) {
    return `${total.toFixed(total < 10 ? 1 : 0)}s`;
  }
  const m = Math.floor(total / 60);
  const s = Math.round(total - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function humaniseUploadError(err) {
  const code = err?.body?.code || err?.body?.detail?.[0]?.type;
  const msg = err?.body?.error || err?.body?.message || err?.message;
  if (code === 'INVALID_MIME' || /INVALID_MIME/i.test(msg || '')) {
    return 'Only MP4 or MOV';
  }
  if (code === 'FILE_TOO_LARGE' || err?.status === 413) {
    return 'File must be ≤50MB';
  }
  if (code === 'INVALID_DURATION' || /INVALID_DURATION/i.test(msg || '')) {
    return 'Duration must be 1–10s';
  }
  return msg || 'Failed to upload.';
}

/**
 * Default `<video>` probe — returns the clip's duration in seconds. Wrapped in
 * a function so tests can inject a deterministic stub via the
 * `probeDurationSeconds` prop or by setting
 * `window.__4reelsProbe{Intro|Outro}Duration` (Playwright cannot decode a fake
 * MP4 buffer through a real `<video>` element in headless Chromium, so the
 * smoke suite overrides the probe via the `window` hook before navigating).
 *
 * Each kind reads its own window hook so the two cards can coexist on the
 * Defaults > Intro & Outro tab without one stomping the other.
 */
function defaultDurationProbe(kind) {
  const hookName =
    kind === 'intro' ? '__4reelsProbeIntroDuration' : '__4reelsProbeOutroDuration';
  return (file) => {
    if (
      typeof window !== 'undefined' &&
      typeof window[hookName] === 'function'
    ) {
      return Promise.resolve(window[hookName](file));
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const cleanup = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore — best-effort cleanup
        }
      };
      video.onloadedmetadata = () => {
        const d = video.duration;
        cleanup();
        resolve(d);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error('metadata'));
      };
      video.src = url;
    });
  };
}
