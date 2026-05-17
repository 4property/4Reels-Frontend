import { Toggle } from '../../../shared/Toggle.jsx';
import { IntroCard } from '../IntroCard.jsx';
import { OutroCard } from '../OutroCard.jsx';

export function IntroOutroTab({ state, set, defaults, agencyId, refetchDefaults }) {
  const {
    introEnabled, introDuration,
    outroEnabled, outroDuration,
    skipForRentals,
  } = state;

  return (
    <>
      <IntroCard
        enabled={introEnabled}
        setEnabled={(v) => set({ introEnabled: v })}
        duration={introDuration}
        setDuration={(v) => set({ introDuration: v })}
        defaults={defaults}
        agencyId={agencyId}
        refetchDefaults={refetchDefaults}
      />
      <OutroCard
        enabled={outroEnabled}
        setEnabled={(v) => set({ outroEnabled: v })}
        duration={outroDuration}
        setDuration={(v) => set({ outroDuration: v })}
        defaults={defaults}
        agencyId={agencyId}
        refetchDefaults={refetchDefaults}
      />

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rules</div>
            <div className="card-subtitle">When to skip the intro/outro automatically.</div>
          </div>
        </div>
        <div className="card-body stack" style={{ gap: 10 }}>
          <Toggle
            on={skipForRentals}
            onChange={(v) => set({ skipForRentals: v })}
            label="Skip on rentals"
            sub="Use intro/outro only on sale listings."
          />
          <Toggle
            on={false}
            onChange={() => {}}
            label="Skip when reel is shorter than 15s"
            sub="Avoids a tiny clip of pure branding."
          />
          <Toggle
            on={false}
            onChange={() => {}}
            label="Allow agent to disable per reel"
            sub="Editor will show a toggle to remove the default intro or outro for one reel."
          />
        </div>
      </div>
    </>
  );
}
