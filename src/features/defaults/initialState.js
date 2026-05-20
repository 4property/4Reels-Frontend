/** Seed state for the Reel Defaults form. One flat object so `setState(ch =>
 *  ({ ...ch }))` updates are trivial and each tab can receive a `set(patch)`
 *  helper.
 */
/** Default platform list persisted to /defaults.platforms (back jsonb owner). */
export const DEFAULT_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'gbp', 'pinterest'];

/** Namespaced keys persisted under defaults.settings. Hold / quiet hours
 *  / skip weekends moved to PUT /automation as native fields in front
 *  feature 16 (mirror of back feature 13); the remaining captions /
 *  regen / review-emails toggles still live here because the back's
 *  AutomationRulesUpsertPayload uses `extra='forbid'` and rejects them.
 *
 *  `quietHoursEnabled`, `skipWeekends`, `reviewWindowEnabled` and
 *  `reviewWindowHours` are kept on this object so older defaults blobs
 *  still serialize cleanly; the Automation page no longer reads or
 *  writes them.
 */
export const AUTOMATION_SETTINGS_KEYS = {
  autoCaptions: 'automation.autoCaptions',
  regenOnUpdate: 'automation.regenOnUpdate',
  reviewEmails: 'automation.reviewEmails',
};

export const INITIAL_DEFAULTS = {
  // Platforms (canonical owner: defaults.platforms on back)
  platforms: DEFAULT_PLATFORMS,

  // Automation-namespaced toggles persisted under defaults.settings
  [AUTOMATION_SETTINGS_KEYS.autoCaptions]: true,
  [AUTOMATION_SETTINGS_KEYS.regenOnUpdate]: false,
  [AUTOMATION_SETTINGS_KEYS.reviewEmails]: [],

  // Format & locale
  currency: 'EUR',
  currencyPosition: 'prefix',
  thousandsSep: ',',
  decimalSep: '.',
  priceRounding: 'exact',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  measurement: 'metric',
  language: 'en-IE',
  timezone: 'Europe/Dublin',

  // Subtitles
  subFont: 'Inter',
  subWeight: '700',
  subSize: 44,
  subColor: '#ffffff',
  subBgStyle: 'pill',
  subBgColor: '#0f1729',
  subBgOpacity: 82,
  subPosition: 'bottom',
  subAlign: 'center',
  subUppercase: false,
  subMaxChars: 36,

  // Video & timing
  aspect: '3:4',
  resolution: '1080p',
  fps: '30',
  duration: 'auto',
  minDuration: 20,
  maxDuration: 45,
  transition: 'crossfade',
  kenBurns: true,
  introCard: true,
  outroCard: true,

  // Audio
  musicVolume: 65,
  fadeIn: true,
  fadeOut: true,
  duckOnVoice: true,
  voiceover: false,

  // Captions
  captionLang: 'en',
  captionCase: 'sentence',
  emojiInCaptions: false,

  // Intro / outro — the duration of the uploaded clip is read from the
  // ffprobe-derived `{kind}_duration_seconds` field on the defaults blob, not
  // from this state. The admin SaaS removed the client-side caps on size and
  // duration in 2026-05; the UI no longer asks the operator for a target
  // length.
  introEnabled: true,
  introSource: 'uploaded',
  introFile: { name: 'agency-intro.mp4', size: '4.2 MB', duration: '0:02' },
  outroEnabled: true,
  outroSource: 'uploaded',
  outroFile: { name: 'agency-outro-cta.mp4', size: '5.8 MB', duration: '0:03' },
  skipForRentals: false,
};
