import { apiRequest } from '../../lib/api/client.js';

/**
 * Admin-only fonts catalog (feature 28).
 *
 *   GET /v1/admin/fonts → { items: [{ family, display_name, available }], count }
 *
 * The endpoint is global (no agency_id). Only `family` values returned here are
 * accepted by PUT `/v1/admin/agencies/{id}/brand` for `font_family`; any other
 * value triggers a Pydantic 422 (`UNKNOWN_FONT_FAMILY:` in `detail[0].msg`).
 * `font_family=null` is also valid and means "render with the system default
 * (Inter)".
 */
export const fontsApi = {
  listAvailableFonts: () => apiRequest('/v1/admin/fonts'),
};

export const listAvailableFonts = () => fontsApi.listAvailableFonts();
