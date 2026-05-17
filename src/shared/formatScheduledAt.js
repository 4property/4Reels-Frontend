/**
 * Format a scheduled-publication timestamp for the post-approve banner.
 *
 * The backend amplifies the `POST /approve` response with a
 * `scheduled_at` field (ISO8601 UTC, e.g. `"2026-05-15T09:00:00Z"`).
 * Non-null values mean "this reel will publish in the future"; null /
 * missing means "publishing right away" (the legacy behaviour).
 *
 * The returned string follows the contract from feature 10's spec:
 *   `"dd/mm/yyyy a las HH:MM"`
 *
 * Why not `date-fns` / `dayjs`?
 *   - The blocklist in `docs/architecture.md` keeps the bundle small;
 *     adding a date library for one banner is overkill.
 *   - `Intl.DateTimeFormat` already does the locale-aware formatting we
 *     need, and is supported in every browser we target.
 *
 * Why browser-local TZ by default?
 *   - The admin user typically reviews approvals from the same office
 *     timezone as the agency; rendering UTC literally would force them
 *     to do math in their head ("9:00 UTC… that's 10:00 here").
 *   - For unit tests (`node --test`) we want a deterministic output, so
 *     the helper accepts an explicit `timeZone` (IANA name) override.
 *
 * Edge cases (return `null`, never throw):
 *   - `null`, `undefined`, empty string → `null`.
 *   - Strings that `new Date(...)` can't parse → `null`.
 *   - Non-string inputs → `null`.
 *
 * @param {unknown} isoString  ISO8601 timestamp from the backend (typically UTC).
 * @param {object} [options]
 * @param {string} [options.timeZone]  IANA TZ name (e.g. `"Europe/Dublin"`,
 *                                     `"UTC"`). Defaults to the browser's
 *                                     resolved TZ.
 * @param {string} [options.locale]    BCP 47 locale tag. Defaults to `"es-ES"`
 *                                     so the formatted string fits the
 *                                     Spanish copy ("Publicará el …").
 * @returns {string | null}            Formatted `"dd/mm/yyyy a las HH:MM"` or
 *                                     `null` if input is unusable.
 */
export function formatScheduledAt(isoString, options = {}) {
  if (typeof isoString !== "string") return null;
  if (isoString === "") return null;

  const date = new Date(isoString);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const { timeZone, locale = "es-ES" } = options;

  // Build the date portion (dd/mm/yyyy) and the time portion (HH:MM)
  // independently so the joined string always matches the spec even if a
  // locale flips the order or punctuation.
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = dateFormatter.formatToParts(date);
  const day = pickPart(parts, "day");
  const month = pickPart(parts, "month");
  const year = pickPart(parts, "year");
  if (!day || !month || !year) return null;

  const timeParts = timeFormatter.formatToParts(date);
  let hour = pickPart(timeParts, "hour");
  const minute = pickPart(timeParts, "minute");
  if (hour === null || minute === null) return null;
  // `hour12: false` returns "24" for midnight on some Node builds; normalise.
  if (hour === "24") hour = "00";

  return `${day}/${month}/${year} a las ${hour}:${minute}`;
}

function pickPart(parts, type) {
  const part = parts.find((p) => p.type === type);
  return part ? part.value : null;
}

export default formatScheduledAt;
