import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { brandApi } from './api.js';
import { useLogoUpload } from './hooks.js';

const ACCEPTED_MIME = ['image/jpeg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Logo upload + remove UI for the Brand tab.
 *
 * Preview lifecycle:
 * - When `logoObjectKey` is set, the persisted logo is fetched as a blob via
 *   `brandApi.downloadLogo` (auth-bearer attached). A plain `<img src>` cannot
 *   attach the bearer, so the protected stream endpoint must be fetched
 *   manually and exposed as an `URL.createObjectURL(blob)` URL.
 * - When the user picks a new file, an instant local blob preview shows
 *   immediately. Once the upload completes and the parent updates
 *   `logoObjectKey`, the resolved-from-server preview takes over and the
 *   local blob is revoked.
 *
 * `onUpload(objectKey)` fires after a successful POST /brand/logo. The parent
 * is expected to either call PUT /brand on Save or to optimistically reflect
 * the new key in the `logoObjectKey` prop so this component can refresh the
 * preview from the back.
 *
 * `onRemove()` fires when the user clicks "Remove logo"; the parent issues
 * PUT /brand with `logo_object_key: ""` (the backend treats `""` as "clear
 * the slot"; `null` would mean "do not touch").
 */
export function LogoUploader({ agencyId, logoObjectKey, onUpload, onRemove }) {
  const inputRef = useRef(null);
  const [upload, { loading: uploading }] = useLogoUpload();
  const [localPreview, setLocalPreview] = useState(null);
  const [resolvedPreview, setResolvedPreview] = useState(null);
  const [error, setError] = useState(null);

  // Resolve the persisted logo via the auth-bearing stream endpoint whenever
  // the canonical key changes. The backend file is fresh on disk as soon as
  // the POST /brand/logo returns, so this works both on first load (key from
  // GET /brand) and right after a successful upload (key from the POST
  // response, propagated through the parent).
  useEffect(() => {
    if (!agencyId || !logoObjectKey) {
      setResolvedPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return undefined;
    }
    let cancelled = false;
    let createdUrl = null;
    brandApi
      .downloadLogo(agencyId, logoObjectKey)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setResolvedPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return createdUrl;
        });
        setLocalPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
      })
      .catch(() => {
        // The 401 path triggers `notifyUnauthorized` inside the client; a 404
        // here just means the file is missing on the back. Either way leave
        // the preview blank — the parent surfaces auth issues via its own
        // `statusMessage`.
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [agencyId, logoObjectKey]);

  // Cleanup the local-file blob on unmount.
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const previewSrc = resolvedPreview || localPreview || '';
  const hasLogo = Boolean(previewSrc) || Boolean(logoObjectKey);
  const canRemove = Boolean(logoObjectKey) || Boolean(localPreview);
  const disabled = !agencyId || uploading;

  const handlePick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);

    if (!ACCEPTED_MIME.includes(file.type)) {
      setError('Logo must be a JPG or PNG image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Logo must be 5 MB or smaller.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return objectUrl;
    });

    try {
      const result = await upload({ agencyId, file });
      onUpload?.(result?.object_key || '');
      // Don't clear localPreview here — the resolved-preview effect will
      // revoke it once the auth-fetched blob lands. Until then, the local
      // blob keeps the UI from flickering through an empty state.
    } catch (err) {
      setError(err?.body?.error || err?.message || 'Failed to upload logo.');
      setLocalPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    }
  };

  const handleRemove = () => {
    if (disabled) return;
    setLocalPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setError(null);
    onRemove?.();
  };

  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>Logo</div>
      <div className="brand-logo-box">
        {previewSrc ? (
          <img
            className="brand-logo-img"
            src={previewSrc}
            alt="Agency logo"
            data-testid="brand-logo-preview"
          />
        ) : (
          <div
            className="brand-logo-img"
            aria-hidden
            style={{ background: 'var(--bg-soft)' }}
          />
        )}
        <button
          className="btn sm brand-logo-replace"
          type="button"
          onClick={handlePick}
          disabled={disabled}
          data-testid="brand-logo-replace"
        >
          {uploading ? <Spinner /> : <Icon name="edit" size={12} />}{' '}
          {hasLogo ? 'Replace' : 'Upload'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFile}
        style={{ display: 'none' }}
        data-testid="brand-logo-input"
      />
      <div className="brand-logo-actions">
        {canRemove && (
          <button
            className="btn sm brand-logo-remove"
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            data-testid="brand-logo-remove"
          >
            <Icon name="trash" size={12} /> Remove logo
          </button>
        )}
      </div>
      {error && (
        <div
          className="hint brand-logo-hint brand-logo-error"
          data-testid="brand-logo-error"
          style={{ marginTop: 6 }}
        >
          {error}
        </div>
      )}
      {!error && (
        <div className="hint brand-logo-hint" style={{ marginTop: 6 }}>
          JPG or PNG up to 5 MB.
        </div>
      )}
    </div>
  );
}
