/**
 * Single source of truth for the 16 canonical placeholder variables that the
 * backend accepts inside `agency_social_templates.description_template` (see
 * `modules/configuration/domain/social_templates_variables.py:21-40` in the
 * back). The backend rejects unknown variables with HTTP 422 +
 * `{ error: 'SOCIAL_TEMPLATE_UNKNOWN_VARIABLE', details: {<platform>: [...]} }`.
 *
 * Consumers:
 *   - `src/app/providers/TenantProvider.jsx` builds the clickable chip list
 *     (`STATIC_VARIABLES`) from this array, attaching a realistic sample per
 *     key.
 *   - `tests/support/mock-backend.js` re-uses both the list and the regex to
 *     validate PUTs and respond with the same 422 shape as the live backend,
 *     so Playwright tests exercise the real error path.
 *
 * Order matches the grouping the editor presents to the user:
 *   1. Property fields  (8): property_title → property_type
 *   2. Location         (3): city, neighborhood, neighborhood_tag, eircode
 *                            (eircode is location-ish; kept after the tag)
 *   3. Descriptive      (1): short_description
 *   4. Agent            (3): agent_name, agent_phone, agent_email
 *   5. Links            (2): booking_link, property_url
 */
export const ALLOWED_SOCIAL_TEMPLATE_VARIABLES = [
  'property_title',
  'price',
  'bedrooms',
  'bathrooms',
  'size_m2',
  'property_type',
  'city',
  'neighborhood',
  'neighborhood_tag',
  'eircode',
  'short_description',
  'agent_name',
  'agent_phone',
  'agent_email',
  'booking_link',
  'property_url',
];

/**
 * Mirrors `SOCIAL_TEMPLATE_VARIABLE_PATTERN` in
 * `modules/configuration/domain/social_templates_variables.py` (back). Use it
 * with `String.prototype.matchAll(...)` to scan a description template for
 * `{{var}}` placeholders. The capture group is the variable key.
 */
export const SOCIAL_TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Hashtag validator — mirrors the regex the backend enforces on every entry
 * of `agency_social_templates.hashtags` (see feature 20 back review). Each
 * hashtag must start with `#`, contain only word chars or `-`, and be at most
 * 50 chars including the `#`. Used both client-side (SocialConfig hashtag
 * editor, to drop invalid chips on insert) and inside `tests/support/mock-backend.js`
 * so the 422 SOCIAL_TEMPLATE_INVALID_HASHTAG path stays in lockstep with the
 * live backend.
 */
export const HASHTAG_PATTERN = /^#[\w-]{1,50}$/;

/**
 * Maximum hashtags per platform — mirrors the same backend cap. The UI
 * disables the input once this many chips exist for a given network; the
 * mock backend returns 422 with `details.hashtag_errors_by_platform[platform].count`
 * if a PUT pushes past it.
 */
export const MAX_HASHTAGS_PER_PLATFORM = 30;
