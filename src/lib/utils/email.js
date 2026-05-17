/**
 * Email helpers shared across features (currently feature 26 review-emails
 * chip editor in /automation; back feature 27 consumes the same list).
 *
 * The regex matches the back's `EMAIL_PATTERN` (single `@`, dot in the
 * domain, no whitespace). Anything stricter belongs server-side.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercase + trim. Returns '' for non-strings or empty input. */
export function normaliseEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

/** Cheap regex check. Does NOT verify deliverability. */
export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  return EMAIL_PATTERN.test(value);
}
