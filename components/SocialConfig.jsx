// Social networks config — connections + description template (plain text + tag chips) per network
const SocialConfig = () => {
  const [activeNet, setActiveNet] = React.useState("instagram");

  // Default templates per network — plain strings with {{variable}} tags
  const defaultTemplates = {
    instagram: `🏡 {{property_title}}\n📍 {{neighborhood}}, {{city}}\n💰 {{price}}\n🛏 {{bedrooms}} · 🛁 {{bathrooms}} · 📐 {{size_m2}} m²\n\n{{short_description}}\n\n👉 Book a viewing: {{booking_link}}\n\n#dublinhomes #{{neighborhood_tag}} #propertytour #realestate`,
    tiktok: `🏡 {{property_title}}\n💰 {{price}} · 🛏 {{bedrooms}} · 🛁 {{bathrooms}}\n\nDM for a viewing 📲\n\n#fyp #housetour #{{neighborhood_tag}} #dublin #realestate`,
    youtube: `{{property_title}} · {{neighborhood}}, {{city}}\n\n{{short_description}}\n\nPrice: {{price}}\nBedrooms: {{bedrooms}} · Bathrooms: {{bathrooms}} · Size: {{size_m2}} m²\n\nBook a viewing: {{booking_link}}`,
    facebook: `New listing · {{property_title}} in {{neighborhood}}\n\n{{short_description}}\n\n💰 {{price}} · 🛏 {{bedrooms}} · 🛁 {{bathrooms}} · 📐 {{size_m2}} m²\n\nBook a viewing: {{booking_link}}`,
    linkedin: `New listing · {{property_title}}\n\n{{short_description}}\n\nLocated in {{neighborhood}}, {{city}}. Bedrooms: {{bedrooms}} · Bathrooms: {{bathrooms}} · {{size_m2}} m².\n\nBook a viewing: {{booking_link}}`,
    gmb: `{{property_title}} — {{neighborhood}}, {{city}}. {{short_description}} Price: {{price}}. Book a viewing: {{booking_link}}`,
  };

  const [templates, setTemplates] = React.useState(() => {
    const out = {};
    window.MOCK.socials.forEach(s => {
      out[s.id] = defaultTemplates[s.id] || defaultTemplates.instagram;
    });
    return out;
  });

  const textareaRef = React.useRef(null);

  const text = templates[activeNet] || "";
  const setText = (t) => setTemplates({ ...templates, [activeNet]: t });

  // Insert a {{tag}} at cursor position in the textarea
  const insertTag = (key) => {
    const ta = textareaRef.current;
    const token = `{{${key}}}`;
    if (!ta) { setText(text + token); return; }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const renderPreview = (content) => {
    let out = content;
    window.MOCK.variables.forEach(v => {
      out = out.replaceAll(`{{${v.key}}}`, v.sample);
    });
    return out;
  };

  const previewText = renderPreview(text);
  const charCount = text.length;
  const activeNetObj = window.MOCK.socials.find(s => s.id === activeNet);
  const netLimits = { instagram: 2200, tiktok: 2200, youtube: 5000, facebook: 63206, linkedin: 3000, gmb: 1500 };
  const limit = netLimits[activeNet] || 2200;

  // Highlighted rendering of the raw template so {{tags}} look like pills
  const renderHighlighted = (raw) => {
    const parts = [];
    let i = 0;
    const re = /\{\{([a-z0-9_]+)\}\}/gi;
    let m;
    let key = 0;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > i) parts.push(<span key={key++}>{raw.slice(i, m.index)}</span>);
      parts.push(
        <span key={key++} className="tag-chip-inline">{`{{${m[1]}}}`}</span>
      );
      i = m.index + m[0].length;
    }
    if (i < raw.length) parts.push(<span key={key++}>{raw.slice(i)}</span>);
    return parts;
  };

  return (
    <div>
      <style>{`
        .tag-chip-inline {
          display: inline-block;
          padding: 1px 6px;
          margin: 0 1px;
          border-radius: 4px;
          background: var(--accent-soft-2);
          color: var(--accent);
          border: 1px solid var(--accent);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.4;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 4px 9px 4px 7px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
          transition: all 0.12s;
          user-select: none;
        }
        .tag-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft-2); }
        .tag-chip .chip-plus { color: var(--text-muted); font-weight: 600; }
        .tag-chip:hover .chip-plus { color: var(--accent); }
        .desc-editor-wrap {
          position: relative;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        .desc-editor-wrap:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft-2);
        }
        .desc-editor-wrap textarea {
          position: relative;
          display: block;
          width: 100%;
          min-height: 280px;
          padding: 14px 16px;
          border: 0;
          outline: 0;
          resize: vertical;
          background: transparent;
          color: var(--text);
          font-family: inherit;
          font-size: 13px;
          line-height: 1.65;
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Social networks</h1>
          <p className="page-subtitle">Connect your channels and edit the description template for each network.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn"><Icon name="eye" size={14}/> Preview all</button>
          <button className="btn primary"><Icon name="check" size={14}/> Save changes</button>
        </div>
      </div>

      {/* Connections strip */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", flex: "none" }}>
          <Icon name="link" size={14}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {window.MOCK.socials.filter(s => s.connected).length} of {window.MOCK.socials.length} networks connected
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Templates below are applied when 4reels publishes to each connected network.
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {window.MOCK.socials.map(s => (
            <span key={s.id} title={`${s.name} · ${s.connected ? s.handle : "Not connected"}`}
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: s.connected ? s.color : "var(--bg-sunken)",
                color: s.connected ? "white" : "var(--text-subtle)",
                display: "grid", placeItems: "center",
                opacity: s.connected ? 1 : 0.5,
                border: s.connected ? "none" : "1px dashed var(--border-strong)",
              }}>
              <Icon name={s.icon} size={13}/>
            </span>
          ))}
        </div>
      </div>

      {/* Template editor */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">Description templates</div>
            <div className="card-subtitle">Plain text per network. Click a tag to insert it — tags get replaced with real property data when publishing.</div>
          </div>
          <button className="btn sm" onClick={() => setTemplates({ ...templates, [activeNet]: defaultTemplates[activeNet] || "" })}>
            <Icon name="copy" size={12}/> Reset to default
          </button>
        </div>

        {/* Network tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 20px", gap: 4, overflowX: "auto" }}>
          {window.MOCK.socials.map(s => (
            <button key={s.id} className={`subtab ${activeNet === s.id ? "active" : ""}`}
                    onClick={() => setActiveNet(s.id)}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: s.color, color: "white", display: "grid", placeItems: "center" }}>
                <Icon name={s.icon} size={10} />
              </span>
              {s.name}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 0 }}>
          {/* Left: textarea with tag palette */}
          <div style={{ padding: 20, borderRight: "1px solid var(--divider)" }}>
            <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Template for <span style={{ color: "var(--text)", fontWeight: 500 }}>{activeNetObj?.name}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: charCount > limit ? "var(--danger)" : "var(--text-muted)" }}>
                {charCount}/{limit}
              </div>
            </div>

            <div className="desc-editor-wrap">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                placeholder="Write your description... Use tags like {{property_title}} for dynamic content."
              />
            </div>

            {/* Tag palette */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Insert a tag
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {window.MOCK.variables.map(v => (
                  <button key={v.key} className="tag-chip" onClick={() => insertTag(v.key)} title={`Sample: ${v.sample}`}>
                    <span className="chip-plus">+</span>
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: live preview */}
          <div style={{ padding: 20, background: "var(--bg-soft)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Live preview · <span style={{ color: "var(--text)", fontWeight: 500 }}>{activeNetObj?.name}</span></span>
            </div>
            <SocialPreviewCard net={activeNetObj} text={previewText} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Raw template</div>
                <div style={{
                  fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: 10, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto",
                  lineHeight: 1.6, fontFamily: "inherit",
                }}>
                  {renderHighlighted(text)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>With sample data</div>
                <div style={{
                  fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: 10, whiteSpace: "pre-wrap", color: "var(--text)",
                  maxHeight: 200, overflow: "auto", lineHeight: 1.6,
                }}>{previewText}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SocialPreviewCard = ({ net, text }) => {
  if (!net) return null;
  const excerpt = text.split("\n").filter(Boolean).slice(0, 4).join(" ");
  return (
    <div style={{ maxWidth: 320, margin: "0 auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: net.color, color: "white", display: "grid", placeItems: "center" }}>
          <Icon name={net.icon} size={16}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{net.handle || "Your page"}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{net.name} · Sponsored</div>
        </div>
        <Icon name="more" size={16} style={{ color: "var(--text-muted)" }}/>
      </div>
      <div style={{ aspectRatio: "3/4", position: "relative" }}>
        <Cover kind="cranford-primary" ratio="3/4" style={{ borderRadius: 0, height: "100%" }} video/>
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>2-bed apt · Cranford Court</div>
          <div style={{ fontSize: 11 }}>€385,000</div>
        </div>
      </div>
      <div style={{ padding: 12, fontSize: 12, color: "var(--text)", lineHeight: 1.5, maxHeight: 84, overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ fontWeight: 600 }}>{net.handle || "your_page"} </span>
        {excerpt}
      </div>
      <div style={{ padding: "8px 12px 12px", display: "flex", gap: 14, color: "var(--text-muted)" }}>
        <Icon name="heart" size={16}/><Icon name="send" size={16}/><Icon name="share" size={16}/>
      </div>
    </div>
  );
};

window.SocialConfig = SocialConfig;
window.SocialPreviewCard = SocialPreviewCard;
