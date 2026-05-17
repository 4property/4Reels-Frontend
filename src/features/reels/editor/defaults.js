/**
 * Seed data used when opening the editor. In a real backend these would come
 * from `GET /reels/:id/photos`, `/subtitles`, `/slides`, etc. — for now the
 * editor still takes them as in-memory state so we keep the current behavior.
 */

export const CRANFORD_PHOTOS = [
  { kind: 'cranford-primary', label: 'EXTERIOR · SIGN', aiScore: 96 },
  { kind: 'cranford-garden', label: 'GARDEN', aiScore: 91 },
  { kind: 'cranford-exterior', label: 'EXTERIOR · BUILDING', aiScore: 88 },
  { kind: 'cranford-living', label: 'LIVING ROOM', aiScore: 93 },
  { kind: 'cranford-kitchen', label: 'KITCHEN', aiScore: 84 },
  { kind: 'cranford-bedroom', label: 'BEDROOM', aiScore: 90 },
  { kind: 'cranford-bathroom', label: 'BATHROOM', aiScore: 78 },
  { kind: 'cranford-garden', label: 'GARDEN · ALT', aiScore: 72 },
  { kind: 'cranford-kitchen', label: 'KITCHEN · DETAIL', aiScore: 66 },
  { kind: 'cranford-bathroom', label: 'BATHROOM · ALT', aiScore: 58 },
];

/**
 * Feature 36: subtitles are stored as numeric seconds (`inSeconds` /
 * `outSeconds`) so the editor can drive the PATCH body verbatim. The legacy
 * `start: '0:00'` / `end: '0:04'` string shape was display-only; mapping it
 * 1:1 to floats keeps the backend contract front-and-centre.
 */
export const CRANFORD_SUBTITLES = [
  { id: 's1', inSeconds: 0, outSeconds: 4, text: 'Welcome to Cranford Court' },
  { id: 's2', inSeconds: 4, outSeconds: 9, text: 'A private development in Stillorgan, Dublin 4' },
  { id: 's3', inSeconds: 9, outSeconds: 14, text: 'Beautiful communal gardens and mature trees' },
  { id: 's4', inSeconds: 14, outSeconds: 19, text: 'Bright living room with original fireplace' },
  { id: 's5', inSeconds: 19, outSeconds: 24, text: 'Fitted kitchen with integrated appliances' },
  { id: 's6', inSeconds: 24, outSeconds: 29, text: 'Double bedroom with built-in storage' },
  { id: 's7', inSeconds: 29, outSeconds: 33, text: 'Fully tiled bathroom with shower' },
  { id: 's8', inSeconds: 33, outSeconds: 36, text: 'Book a viewing with CKP Estate Agents' },
];

export const DEFAULT_DESCRIPTION =
  '🏡 2-bed apartment · Cranford Court\n' +
  '📍 Stillorgan Road, Dublin 4\n' +
  '💰 €385,000\n' +
  '🛏 2 · 🛁 1 · 📐 68 m²\n\n' +
  'A bright two-bed apartment in a sought-after private development with mature gardens and off-street parking.\n\n' +
  '👉 Book a viewing: ckpestateagents.ie/view/r8832\n\n' +
  '#dublinhomes #stillorgan #dublin4 #propertytour #ckpestateagents';

export const DEFAULT_SLIDES = [
  { id: 'sl1', kind: 'intro-video', label: 'Intro · CKP', duration: 2.5, enabled: true, locked: false, source: 'default' },
  { id: 'sl2', kind: 'outro-video', label: 'Outro · Book a viewing', duration: 3, enabled: true, locked: false, source: 'default' },
];

export const DEFAULT_TAKE = {
  id: 't1',
  name: 'Take 1',
  duration: '0:34',
  size: '1.2 MB',
  recorded: '2 min ago',
  active: true,
  waveform: [
    0.2, 0.4, 0.6, 0.8, 0.7, 0.5, 0.3, 0.6, 0.9, 0.8, 0.6, 0.4, 0.5, 0.7, 0.9,
    0.8, 0.6, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.2, 0.3, 0.5, 0.7, 0.9, 0.8,
    0.6, 0.4, 0.3, 0.2, 0.4, 0.6, 0.5, 0.3, 0.4, 0.6, 0.7, 0.5, 0.3, 0.2, 0.4,
    0.6, 0.8, 0.6, 0.4, 0.3,
  ],
};

/**
 * Per-platform content policy — single source of truth for what each social
 * network allows in its description, used both by the global template editor
 * (`/social`) and the per-reel override panel (`ReelEditor > Descriptions`).
 *
 * Field meanings:
 *   - `descLimit`        — max characters in the description body.
 *   - `titleLimit`       — max chars for the title field; 0 means the network
 *                          has no separate title (caption is one block).
 *   - `supportsLinks`    — true if URLs in the description render as clickable
 *                          links on the platform. Instagram and TikTok do NOT
 *                          auto-link URLs in captions.
 *   - `supportsHashtags` — true if hashtags surface meaningful reach on the
 *                          platform. GBP/GMB posts ignore hashtags.
 *   - `linkWarning`      — copy shown to the user when the description contains
 *                          a URL on a `supportsLinks: false` network. Null when
 *                          links are fine.
 *   - `hashtagsNote`     — short copy shown next to the hashtags editor (purely
 *                          informational; the back-of-truth limit lives in
 *                          `MAX_HASHTAGS_PER_PLATFORM` in social/constants.js).
 *   - `notes`            — one-liner shown as an info banner above the editor
 *                          to set user expectations for the platform.
 *
 * Sources: official platform docs (last verified 2026-05). When a platform
 * changes policy, update this map first; everything else derives.
 */
export const PLATFORM_POLICY = {
  instagram: {
    descLimit: 2200,
    titleLimit: 0,
    supportsLinks: false,
    supportsHashtags: true,
    linkWarning:
      'Instagram does not turn URLs into clickable links in captions. Point viewers to "link in bio" or include the URL as plain text.',
    hashtagsNote: 'Hashtags work; up to 30 per post recommended.',
    notes: 'Single caption block, no title. URLs are not clickable.',
  },
  tiktok: {
    descLimit: 2200,
    titleLimit: 0,
    supportsLinks: false,
    supportsHashtags: true,
    linkWarning:
      'TikTok captions do not auto-link URLs (only Business accounts can add a bio link). Mention "link in bio" instead.',
    hashtagsNote: 'Hashtags count toward the description character limit.',
    notes: 'Caption with hashtags. URLs are not clickable in the feed.',
  },
  youtube: {
    descLimit: 5000,
    titleLimit: 100,
    supportsLinks: true,
    supportsHashtags: true,
    linkWarning: null,
    hashtagsNote:
      'First 3 hashtags appear above the title; up to 15 recommended.',
    notes:
      'Title (100 chars) + description (5000 chars). URLs are clickable. Hashtags help discovery.',
  },
  facebook: {
    descLimit: 63206,
    titleLimit: 0,
    supportsLinks: true,
    supportsHashtags: true,
    linkWarning: null,
    hashtagsNote: 'Hashtags supported but offer limited reach on Facebook.',
    notes:
      'Single post body with link preview. ~500 chars recommended despite the high limit.',
  },
  linkedin: {
    descLimit: 3000,
    titleLimit: 0,
    supportsLinks: true,
    supportsHashtags: true,
    linkWarning: null,
    hashtagsNote: '3–5 hashtags is the LinkedIn sweet spot.',
    notes: 'Single post body. URLs render with a link preview card.',
  },
  gbp: {
    descLimit: 1500,
    titleLimit: 58,
    supportsLinks: true,
    supportsHashtags: false,
    linkWarning: null,
    hashtagsNote: 'Google Business Profile posts ignore hashtags — skip them.',
    notes:
      'Update title (58 chars) + body (1500 chars). URLs render as a CTA button.',
  },
  gmb: {
    descLimit: 1500,
    titleLimit: 58,
    supportsLinks: true,
    supportsHashtags: false,
    linkWarning: null,
    hashtagsNote: 'Google Business Profile posts ignore hashtags — skip them.',
    notes:
      'Update title (58 chars) + body (1500 chars). URLs render as a CTA button.',
  },
  pinterest: {
    descLimit: 500,
    titleLimit: 100,
    supportsLinks: true,
    supportsHashtags: true,
    linkWarning: null,
    hashtagsNote: 'Up to 20 hashtags help Pin discovery.',
    notes: 'Pin title (100 chars) + description (500 chars). URLs are clickable.',
  },
};

/** Defaults for any platform not yet in PLATFORM_POLICY. */
export const DEFAULT_PLATFORM_POLICY = Object.freeze({
  descLimit: 2200,
  titleLimit: 0,
  supportsLinks: true,
  supportsHashtags: true,
  linkWarning: null,
  hashtagsNote: '',
  notes: '',
});

export function getPlatformPolicy(platformId) {
  return PLATFORM_POLICY[platformId] || DEFAULT_PLATFORM_POLICY;
}

/**
 * Derived legacy alias: `NETWORK_LIMITS[platform]` returns the description
 * character limit. Kept so existing imports (`SocialConfig.jsx`,
 * `DescriptionsPanel.jsx`) keep working without churn.
 */
export const NETWORK_LIMITS = Object.fromEntries(
  Object.entries(PLATFORM_POLICY).map(([id, p]) => [id, p.descLimit]),
);

/**
 * Variables that, when substituted at publish time, produce a URL. Used by
 * `findLinksInText` so a template like "Book at {{property_url}}" is flagged
 * on Instagram/TikTok even before substitution.
 */
const LINK_VARIABLES = ['property_url', 'booking_link'];

/**
 * Detect anything that will render as a URL after template substitution:
 *   - Inline absolute URLs (`http://...`, `https://...`).
 *   - `www.example.com/...` patterns that platforms usually auto-link.
 *   - Template variables that resolve to a URL (`{{property_url}}`,
 *     `{{booking_link}}`).
 *
 * Returns an array of `{ kind, match }` so callers can both render a warning
 * and (optionally) highlight the offending fragments. Empty array = no links.
 */
export function findLinksInText(text) {
  const out = [];
  if (!text || typeof text !== 'string') return out;
  const urlRe = /(https?:\/\/[^\s]+|\bwww\.[^\s]+)/gi;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    out.push({ kind: 'url', match: m[0] });
  }
  for (const key of LINK_VARIABLES) {
    if (text.includes(`{{${key}}}`)) {
      out.push({ kind: 'variable', match: `{{${key}}}` });
    }
  }
  return out;
}
