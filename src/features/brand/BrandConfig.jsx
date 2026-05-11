import { useEffect, useState } from 'react';
import { ColorInput } from '../../shared/ColorInput.jsx';
import { Cover } from '../../shared/Cover.jsx';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { useAgency } from '../../app/providers/TenantProvider.jsx';
import { useBrand, useSaveBrand } from './hooks.js';
import './brand.css';

const FONTS = ['Inter', 'Söhne', 'Manrope', 'Plus Jakarta Sans', 'Helvetica'];

const LOGO_POSITIONS = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-right', label: 'Bottom right' },
];

/**
 * Brand page — identity (colors, font, logo position) + live preview.
 *
 * Body sent to PUT /v1/admin/agencies/{id}/brand is exactly the
 * BrandSettingsUpsertPayload shape: primary_color, secondary_color,
 * logo_position, font_family, logo_object_key?, intro_logo_object_key?.
 * The legacy tagline / watermark_enabled / outro_* fields were removed
 * from this UI in feature 6 (the back rejects them with extra='forbid').
 */
export function BrandConfig() {
  const agency = useAgency();
  const { brand, agencyId, loading, refetch } = useBrand();
  const [save, { loading: saving }] = useSaveBrand();

  const [primary, setPrimary] = useState('#0F172A');
  const [secondary, setSecondary] = useState('#FFFFFF');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoObjectKey, setLogoObjectKey] = useState('');
  const [introLogoObjectKey, setIntroLogoObjectKey] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    setPrimary(brand?.primary_color || '#0F172A');
    setSecondary(brand?.secondary_color || '#FFFFFF');
    setLogoPosition(brand?.logo_position || 'bottom-right');
    setFontFamily(brand?.font_family || 'Inter');
    setLogoObjectKey(brand?.logo_object_key || '');
    setIntroLogoObjectKey(brand?.intro_logo_object_key || '');
  }, [brand]);

  const handleSave = async () => {
    if (!agencyId) return;
    setStatusMessage(null);
    try {
      const body = {
        primary_color: primary,
        secondary_color: secondary,
        logo_position: logoPosition,
        font_family: fontFamily,
      };
      if (logoObjectKey) body.logo_object_key = logoObjectKey;
      if (introLogoObjectKey) body.intro_logo_object_key = introLogoObjectKey;
      await save({ agencyId, body });
      setStatusMessage({ tone: 'success', text: 'Brand saved.' });
      await refetch();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save brand.',
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

      <div className="brand-layout">
        <div className="stack gap-8">
          <IdentityCard
            agencyName={agency?.name || ''}
            primary={primary}
            setPrimary={setPrimary}
            secondary={secondary}
            setSecondary={setSecondary}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
          />

          <LogoPlacementCard position={logoPosition} setPosition={setLogoPosition} />
        </div>

        <LivePreview
          agencyName={agency?.name || ''}
          secondary={secondary}
          fontFamily={fontFamily}
          logoPosition={logoPosition}
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
}) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Identity</div></div>
      <div className="card-body brand-identity-body">
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Logo</div>
          <div className="brand-logo-box">
            <div className="brand-logo-img" aria-hidden style={{ background: 'var(--bg-soft)' }} />
            <button className="btn sm brand-logo-replace" type="button" disabled>
              <Icon name="edit" size={12} /> Replace
            </button>
          </div>
          <div className="hint brand-logo-hint" style={{ marginTop: 6 }}>
            Logo upload not implemented yet.
          </div>
        </div>
        <div className="stack gap-7">
          <div className="field">
            <div className="label">Agency</div>
            <input className="input" value={agencyName} readOnly />
          </div>
          <div className="brand-cols-2">
            <div className="field">
              <div className="label">Primary color</div>
              <ColorInput value={primary} onChange={setPrimary} />
            </div>
            <div className="field">
              <div className="label">Secondary color</div>
              <ColorInput value={secondary} onChange={setSecondary} />
            </div>
          </div>
          <div className="field">
            <div className="label">Heading font</div>
            <select
              className="select"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
            >
              {FONTS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoPlacementCard({ position, setPosition }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Logo placement</div>
          <div className="card-subtitle">Where the brand logo sits on every reel frame.</div>
        </div>
      </div>
      <div className="card-body">
        <div className="brand-cols-2">
          <div className="field">
            <div className="label">Position</div>
            <div className="brand-cols-2" style={{ gap: 6 }}>
              {LOGO_POSITIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`btn sm ${position === p.id ? 'primary' : ''}`}
                  onClick={() => setPosition(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LivePreview({ agencyName, secondary, fontFamily, logoPosition }) {
  return (
    <div className="brand-preview-wrap">
      <div className="card" style={{ padding: 16 }}>
        <div className="brand-preview-label">Live preview · 3:4</div>
        <div className="brand-preview-frame">
          <Cover kind="ranelagh" ratio="3/4" label="SAMPLE FRAME" video />

          <div className={`brand-watermark pos-${logoPosition}`} style={{ color: secondary }}>
            {agencyName}
          </div>

          <div className="brand-caption" style={{ fontFamily: `"${fontFamily}", sans-serif` }}>
            South-facing garden · renovated 2024
          </div>
        </div>
      </div>
    </div>
  );
}
