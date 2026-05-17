import { useEffect, useState } from 'react';
import { ColorInput } from '../../shared/ColorInput.jsx';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { Toggle } from '../../shared/Toggle.jsx';
import { useAgency } from '../../app/providers/TenantProvider.jsx';
import { LogoUploader } from './LogoUploader.jsx';
import { useAvailableFonts, useBrand, useSaveBrand } from './hooks.js';
import { defaultsApi } from '../defaults/api.js';
import { useReelDefaults } from '../defaults/hooks.js';
import './brand.css';

/**
 * Brand page — identity (colors, font, logo upload).
 *
 * Body sent to PUT /v1/admin/agencies/{id}/brand is exactly the
 * BrandSettingsUpsertPayload shape: primary_color, secondary_color,
 * logo_position, font_family, logo_object_key?, intro_logo_object_key?.
 * `logo_position` is still persisted with the value hydrated from the
 * backend so the Pydantic contract stays intact; the UI to edit it was
 * removed in a later hotfix (there was no live preview to justify it).
 *
 * Feature 28 — dynamic fonts + reset defaults:
 *   - The font dropdown is populated from `GET /v1/admin/fonts` instead of
 *     a hardcoded array; the first option ("Default") maps to `null` in the
 *     PUT body and tells the renderer to fall back to Inter.
 *   - "Reset to default" buttons next to primary color, secondary color and
 *     the font dropdown set the corresponding field to `null` so the renderer
 *     falls back (colors → webhook payload; font → Inter). `null` is
 *     persisted explicitly: `buildBrandBody` never omits the key.
 */
export function BrandConfig() {
  const agency = useAgency();
  const { brand, agencyId, loading, refetch } = useBrand();
  const [save, { loading: saving }] = useSaveBrand();
  const {
    items: fontItems,
    loading: fontsLoading,
  } = useAvailableFonts();

  // `null` for primary/secondary/fontFamily means "render with the default".
  // We start with `null` so a fresh agency (no brand row yet) defaults to the
  // webhook/system fallback; the effect below hydrates from the back.
  const [primary, setPrimary] = useState(null);
  const [secondary, setSecondary] = useState(null);
  const [fontFamily, setFontFamily] = useState(null);
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoObjectKey, setLogoObjectKey] = useState('');
  const [introLogoObjectKey, setIntroLogoObjectKey] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  // HOTFIX 2026-05-15: per-agency switch to hide the listing agent photo
  // from rendered reels. Persists as `showAgentPhoto` (camelCase, matching
  // INITIAL_DEFAULTS) inside the JSONB `agency_reel_defaults.settings`
  // column — same bucket as subtitle settings (feature 31) and music rules
  // (feature 24), so no Alembic migration is required. The PUT body for
  // /brand stays untouched: this toggle issues its own PUT /defaults with
  // only `{settings: {showAgentPhoto}}` and relies on the back's shallow
  // merge to preserve the rest of `settings`.
  const { defaults: reelDefaults, refetch: refetchDefaults } = useReelDefaults();
  const [showAgentPhoto, setShowAgentPhoto] = useState(true);

  useEffect(() => {
    // The back's `agency_brand_settings` columns are NOT NULL with
    // server defaults, so a "cleared" override comes through as an
    // empty string (not as JSON `null`). Treat both `null` and `""`
    // identically: they mean "no agency override, render the default".
    // Using `||` instead of `??` collapses both into `null` so the
    // <ColorWithReset> / dropdown UI shows the "Using default" hint.
    setPrimary(brand?.primary_color || null);
    setSecondary(brand?.secondary_color || null);
    setLogoPosition(brand?.logo_position || 'bottom-right');
    setFontFamily(brand?.font_family || null);
    setLogoObjectKey(brand?.logo_object_key || '');
    setIntroLogoObjectKey(brand?.intro_logo_object_key || '');
  }, [brand]);

  useEffect(() => {
    // `showAgentPhoto` defaults to `true` so agencies that have never
    // flipped the switch keep their historical reels. Treat any falsy
    // non-undefined value (`false`, `0`, `""`) as "hide".
    const stored = reelDefaults?.settings?.showAgentPhoto;
    setShowAgentPhoto(stored === undefined ? true : Boolean(stored));
  }, [reelDefaults]);

  const buildBrandBody = (overrides = {}) => {
    // `null` is preserved (not omitted). The back's BrandSettingsUpsertPayload
    // accepts `str | None` on these three fields; sending `null` tells it to
    // clear the override and use the default at render time.
    const base = {
      primary_color: primary,
      secondary_color: secondary,
      logo_position: logoPosition,
      font_family: fontFamily,
      logo_object_key: logoObjectKey || '',
      intro_logo_object_key: introLogoObjectKey || '',
    };
    return { ...base, ...overrides };
  };

  const handleSave = async () => {
    if (!agencyId) return;
    setStatusMessage(null);
    try {
      await save({ agencyId, body: buildBrandBody() });
      // Persist the agent-photo toggle into agency_reel_defaults.settings.
      // The back merges shallow, so sending only the one key keeps every
      // other setting (subtitles, music rules, INITIAL_DEFAULTS shape) intact.
      await defaultsApi.saveDefaults(agencyId, {
        settings: { showAgentPhoto },
      });
      setStatusMessage({ tone: 'success', text: 'Brand saved.' });
      await refetch();
      await refetchDefaults();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save brand.',
      });
    }
  };

  const handleLogoUpload = (objectKey) => {
    setLogoObjectKey(objectKey);
    setStatusMessage({
      tone: 'success',
      text: 'Logo uploaded. Click "Save brand" to apply.',
    });
  };

  const handleLogoRemove = async () => {
    if (!agencyId) return;
    setStatusMessage(null);
    setLogoObjectKey('');
    try {
      await save({
        agencyId,
        body: buildBrandBody({ logo_object_key: '' }),
      });
      setStatusMessage({ tone: 'success', text: 'Logo removed.' });
      await refetch();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to remove logo.',
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Brand</h1>
          <p className="page-subtitle">
            These settings are applied to every reel that this agency generates.
          </p>
        </div>
        <div className="row gap-4">
          <button
            className="btn primary"
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !agencyId}
          >
            {saving ? <Spinner /> : <Icon name="check" size={14} />}
            Save brand
          </button>
        </div>
      </div>

      {!agencyId && !loading && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="t-medium">No agency selected.</div>
          <div className="t-sm t-muted">
            Open the app from a GoHighLevel sub-account that is linked to an agency, or
            assign one in the admin panel.
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`card ${statusMessage.tone === 'danger' ? 'card-danger' : ''}`}
          style={{ padding: 12, marginBottom: 16 }}
        >
          <Icon name={statusMessage.tone === 'danger' ? 'alert' : 'info'} size={13} />{' '}
          {statusMessage.text}
        </div>
      )}

      <div className="stack gap-6">
        <IdentityCard
          agencyName={agency?.name || ''}
          primary={primary}
          setPrimary={setPrimary}
          secondary={secondary}
          setSecondary={setSecondary}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          fontItems={fontItems}
          fontsLoading={fontsLoading}
          agencyId={agencyId}
          logoObjectKey={logoObjectKey}
          onLogoUpload={handleLogoUpload}
          onLogoRemove={handleLogoRemove}
        />
        <AgentCard
          showAgentPhoto={showAgentPhoto}
          setShowAgentPhoto={setShowAgentPhoto}
        />
      </div>
    </div>
  );
}

/**
 * Agent photo visibility — HOTFIX 2026-05-15.
 *
 * When the toggle is OFF, future reel renders for this agency omit the
 * listing agent's photo (the backend nulls `agent_photo_url` before
 * preparing assets; the existing pipeline already short-circuits on a
 * falsy URL). Reels that were rendered while the photo was visible keep
 * it until they are regenerated.
 */
function AgentCard({ showAgentPhoto, setShowAgentPhoto }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Agent</div>
          <div className="card-subtitle">
            Controls how the listing agent appears in rendered reels.
          </div>
        </div>
      </div>
      <div className="card-body">
        <Toggle
          on={showAgentPhoto}
          onChange={setShowAgentPhoto}
          label="Show agent photo in reels"
          sub="Off hides the agent's photo from every reel this agency renders from now on. Already-rendered reels keep their photo until regenerated."
        />
      </div>
    </div>
  );
}

function IdentityCard({
  agencyName,
  primary,
  setPrimary,
  secondary,
  setSecondary,
  fontFamily,
  setFontFamily,
  fontItems,
  fontsLoading,
  agencyId,
  logoObjectKey,
  onLogoUpload,
  onLogoRemove,
}) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Identity</div></div>
      <div className="card-body brand-identity-body">
        <LogoUploader
          agencyId={agencyId}
          logoObjectKey={logoObjectKey}
          onUpload={onLogoUpload}
          onRemove={onLogoRemove}
        />
        <div className="stack gap-7">
          <div className="field">
            <div className="label">Agency</div>
            <input className="input" value={agencyName} readOnly />
          </div>
          <div className="brand-cols-2">
            <ColorField
              label="Primary color"
              value={primary}
              onChange={setPrimary}
              testId="brand-primary-color"
              tooltip="Use webhook fallback"
            />
            <ColorField
              label="Secondary color"
              value={secondary}
              onChange={setSecondary}
              testId="brand-secondary-color"
              tooltip="Use webhook fallback"
            />
          </div>
          <FontField
            value={fontFamily}
            onChange={setFontFamily}
            items={fontItems}
            loading={fontsLoading}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Color picker + "Reset to default" affordance. When `value` is `null` the
 * `<ColorInput>` shows an empty swatch and the field renders a "Using default"
 * hint; the PUT body still sends `null` for that key.
 *
 * The reset button is a small, secondary action so it doesn't compete with
 * the swatch/text input — it lives at the right of the input group, mirrored
 * on the dropdown variant below.
 */
function ColorField({ label, value, onChange, testId, tooltip }) {
  const isDefault = value === null || value === undefined;
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div className="brand-input-row">
        <ColorInput value={value || '#000000'} onChange={onChange} />
        <button
          type="button"
          className="btn ghost brand-reset-btn"
          onClick={() => onChange(null)}
          title={tooltip}
          data-testid={`${testId}-reset`}
          disabled={isDefault}
        >
          <Icon name="refresh" size={13} />
          Reset
        </button>
      </div>
      {isDefault && (
        <div className="brand-default-hint" data-testid={`${testId}-default-hint`}>
          Using default
        </div>
      )}
    </div>
  );
}

/**
 * Heading-font dropdown. While the catalog is loading the `<select>` is
 * disabled and labeled "Loading fonts…". Once loaded, the first option is
 * "Default (system fallback)" with `value=""` which maps to `null` in the
 * PUT body (see `BrandConfig.handleSave`). The rest of the options are the
 * `items` returned by `GET /v1/admin/fonts`, in the order the back returns
 * them.
 */
function FontField({ value, onChange, items, loading }) {
  const isDefault = value === null || value === undefined || value === '';
  const handleSelect = (event) => {
    const raw = event.target.value;
    onChange(raw === '' ? null : raw);
  };
  return (
    <div className="field">
      <div className="label">Heading font</div>
      <div className="brand-input-row">
        <select
          className="select brand-font-select"
          value={value || ''}
          onChange={handleSelect}
          disabled={loading}
          data-testid="brand-font-select"
        >
          {loading ? (
            <option value="">Loading fonts…</option>
          ) : (
            <>
              <option value="">Default (system fallback)</option>
              {items.map((font) => (
                <option key={font.family} value={font.family}>
                  {font.display_name || font.family}
                </option>
              ))}
            </>
          )}
        </select>
        <button
          type="button"
          className="btn ghost brand-reset-btn"
          onClick={() => onChange(null)}
          title="Use Inter default"
          data-testid="brand-font-reset"
          disabled={isDefault || loading}
        >
          <Icon name="refresh" size={13} />
          Reset
        </button>
      </div>
      {isDefault && !loading && (
        <div className="brand-default-hint" data-testid="brand-font-default-hint">
          Using default
        </div>
      )}
    </div>
  );
}
