import { useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { adminApi } from './api.js';

export function CreateAgencyModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('Europe/Dublin');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await adminApi.createAgency({
        name: name.trim(),
        slug: slug.trim() || undefined,
        timezone: timezone.trim() || undefined,
        status: 'active',
      });
      const agencyId = response?.agency?.agency_id;
      if (!agencyId) {
        throw new Error('Backend did not return an agency_id.');
      }
      onCreated(agencyId);
    } catch (err) {
      setError(err?.message || 'Failed to create the agency.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 480 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title">New agency</div>
            <div className="modal-sub">
              Create an agency, then configure its WordPress sources and GHL connection.
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="field">
            <span className="label">Agency name</span>
            <input
              className="input"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="CKP Estate Agents"
              required
            />
          </label>

          <label className="field">
            <span className="label">Slug (optional)</span>
            <input
              className="input mono"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="auto-generated from name if empty"
            />
          </label>

          <label className="field">
            <span className="label">Timezone</span>
            <input
              className="input"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Europe/Dublin"
            />
          </label>

          {error && (
            <div className="ghl-admin-message danger" style={{ margin: '0 0 12px' }}>
              <Icon name="alert" size={13} />
              {error}
            </div>
          )}

          <div className="modal-footer">
            <button className="btn" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : <Icon name="check" size={13} />}
              Create agency
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
