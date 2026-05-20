import { ColorInput } from '../../../shared/ColorInput.jsx';
import { Segmented } from '../../../shared/Segmented.jsx';
import { Toggle } from '../../../shared/Toggle.jsx';
import { useAvailableFonts } from '../../brand/hooks.js';
import { AUTOMATION_SETTINGS_KEYS } from '../initialState.js';

const BG_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'pill', label: 'Pill' },
  { id: 'block', label: 'Block' },
  { id: 'outline', label: 'Outline' },
];

export function SubtitlesTab({ state, set }) {
  const {
    subFont, subWeight, subSize, subColor,
    subBgStyle, subBgColor, subBgOpacity,
    subPosition, subAlign, subUppercase, subMaxChars,
  } = state;

  const autoCaptions = state[AUTOMATION_SETTINGS_KEYS.autoCaptions];
  // Subdue the per-style cards when AI subtitles are off. The cards stay
  // interactive (pointer-events left alone) so an agency can still adjust
  // typography ahead of re-enabling captions.
  const subduedClass = autoCaptions ? '' : ' subtitles-tab-subdued';

  // Font dropdown is fed by the global admin catalog (`GET /v1/admin/fonts`),
  // same source the Brand tab uses — keeps both surfaces in sync.
  const { items: fontItems, loading: fontsLoading } = useAvailableFonts();

  return (
    <>
      <div className="card" data-testid="auto-captions-card">
        <div className="card-header">
          <div>
            <div className="card-title">Auto-generate AI subtitles</div>
            <div className="card-subtitle">
              Off keeps the reel without spoken-word subtitles; the
              settings below still apply when re-enabled.
            </div>
          </div>
          <Toggle
            on={autoCaptions}
            onChange={(v) => set({ [AUTOMATION_SETTINGS_KEYS.autoCaptions]: v })}
          />
        </div>
      </div>

      <div className={`card${subduedClass}`}>
        <div className="card-header"><div><div className="card-title">Typography</div></div></div>
        <div className="card-body stack" style={{ gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
            <div className="field">
              <div className="label">Font family</div>
              {/* List served by GET /v1/admin/fonts (backend catalog), same
                  source as the Brand tab — keeps both dropdowns in sync. */}
              <select
                className="select"
                value={subFont}
                onChange={(e) => set({ subFont: e.target.value })}
                disabled={fontsLoading}
                data-testid="subtitles-font-select"
              >
                {fontsLoading ? (
                  <option value={subFont}>Loading fonts…</option>
                ) : (
                  <>
                    {/* Legacy values retired in feature 28 stay rendered via
                        this fallback so the saved selection is still visible,
                        but can't be re-selected once changed. */}
                    {subFont && !fontItems.some((f) => f.family === subFont) && (
                      <option value={subFont}>{subFont}</option>
                    )}
                    {fontItems.map((font) => (
                      <option key={font.family} value={font.family}>
                        {font.display_name || font.family}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div className="field">
              <div className="label">Weight</div>
              <select className="select" value={subWeight} onChange={(e) => set({ subWeight: e.target.value })}>
                <option value="500">Medium</option><option value="600">Semibold</option>
                <option value="700">Bold</option><option value="800">Extra bold</option>
              </select>
            </div>
          </div>

          <div className="field">
            <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Font size <span className="mono">{subSize}px</span>
            </div>
            <input
              type="range" min="28" max="72" value={subSize}
              onChange={(e) => set({ subSize: +e.target.value })}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <div className="label">Text color</div>
              <ColorInput value={subColor} onChange={(v) => set({ subColor: v })} />
            </div>
            <div className="field">
              <div className="label">Text case</div>
              <Segmented
                options={[{ value: false, label: 'Sentence' }, { value: true, label: 'UPPERCASE' }]}
                value={subUppercase}
                onChange={(v) => set({ subUppercase: v })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <div className="label">Max chars per line</div>
              <input
                type="number"
                className="input"
                value={subMaxChars}
                onChange={(e) => set({ subMaxChars: +e.target.value })}
              />
            </div>
            <div className="field">
              <div className="label">Alignment</div>
              <Segmented
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
                value={subAlign}
                onChange={(v) => set({ subAlign: v })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`card${subduedClass}`}>
        <div className="card-header"><div><div className="card-title">Background & position</div></div></div>
        <div className="card-body stack" style={{ gap: 14 }}>
          <div className="field">
            <div className="label">Background style</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {BG_STYLES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => set({ subBgStyle: o.id })}
                  className={`btn sm ${subBgStyle === o.id ? 'primary' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {subBgStyle !== 'none' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <div className="label">Background color</div>
                <ColorInput value={subBgColor} onChange={(v) => set({ subBgColor: v })} />
              </div>
              <div className="field">
                <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Opacity <span className="mono">{subBgOpacity}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={subBgOpacity}
                  onChange={(e) => set({ subBgOpacity: +e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          <div className="field">
            <div className="label">Vertical position</div>
            <Segmented
              options={[
                { value: 'top', label: 'Top' },
                { value: 'middle', label: 'Middle' },
                { value: 'bottom', label: 'Bottom' },
              ]}
              value={subPosition}
              onChange={(v) => set({ subPosition: v })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
