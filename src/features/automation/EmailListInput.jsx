import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { isValidEmail, normaliseEmail } from '../../lib/utils/email.js';

/**
 * Chip-style editor for a list of recipient emails. Mirrors the
 * `HashtagsEditor` pattern in `src/features/social/SocialConfig.jsx` so
 * the keyboard affordances stay consistent across the app:
 *
 *   - Commit on Enter, comma, space, or blur (when non-empty).
 *   - Backspace on an empty input removes the last chip.
 *   - Pasting `"a@x.com, b@y.com"` commits both entries.
 *   - Normalisation (trim + lowercase) before dedup; duplicates are
 *     silently ignored.
 *   - Invalid email → red inline banner under the editor for ~2.5 s.
 *
 * The component is fully controlled: it owns nothing except the in-flight
 * draft and the transient error message.
 *
 * Props:
 *   - value: string[]           — current list of normalised emails
 *   - onChange: (next) => void  — receives the new array
 *   - id?: string               — id forwarded to the inner input
 *   - placeholder?: string
 *   - disabled?: boolean
 */
export function EmailListInput({
  value,
  onChange,
  id,
  placeholder = 'Add email, e.g. ops@example.com',
  disabled = false,
}) {
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const errorTimerRef = useRef(null);
  const emails = Array.isArray(value) ? value : [];

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const flashError = (msg) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 2500);
  };

  const commit = (raw) => {
    const candidate = normaliseEmail(raw);
    if (!candidate) {
      // Empty / whitespace: don't error, just no-op clear.
      setDraft('');
      return;
    }
    if (!isValidEmail(candidate)) {
      flashError(`"${String(raw).trim()}" is not a valid email address.`);
      return;
    }
    if (emails.includes(candidate)) {
      setDraft('');
      setErrorMessage(null);
      return;
    }
    onChange([...emails, candidate]);
    setDraft('');
    setErrorMessage(null);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === ' ' && draft.trim().length > 0) {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === 'Backspace' && draft === '' && emails.length > 0) {
      event.preventDefault();
      onChange(emails.slice(0, -1));
      setErrorMessage(null);
    }
  };

  const handleChange = (event) => {
    if (disabled) return;
    const next = event.target.value;
    // Paste / IME flows can land a string with embedded commas; treat each
    // comma-separated segment as a commit and keep the trailing tail as the
    // new draft.
    if (next.includes(',')) {
      const parts = next.split(',');
      const tail = parts.pop();
      parts.forEach((part) => commit(part));
      setDraft(tail);
      return;
    }
    setDraft(next);
  };

  const handleBlur = () => {
    if (disabled) return;
    if (draft.trim()) commit(draft);
  };

  const removeAt = (index) => {
    if (disabled) return;
    const next = emails.slice();
    next.splice(index, 1);
    onChange(next);
    setErrorMessage(null);
  };

  return (
    <div className="email-list-input-wrap">
      <div
        className={`email-list-input ${disabled ? 'is-disabled' : ''}`}
        data-testid="review-emails-editor"
      >
        {emails.map((email, idx) => (
          <span key={`${email}-${idx}`} className="email-chip" data-testid="review-emails-chip">
            <span className="email-chip-label">{email}</span>
            <button
              type="button"
              className="email-chip-remove"
              aria-label={`Remove ${email}`}
              onClick={() => removeAt(idx)}
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          className="email-list-text"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? placeholder : ''}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          data-testid="review-emails-input"
        />
      </div>
      {errorMessage && (
        <div
          className="email-list-input-error card card-danger"
          role="alert"
          data-testid="review-emails-error"
        >
          <Icon name="alert" size={12} /> {errorMessage}
        </div>
      )}
    </div>
  );
}
