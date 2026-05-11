/** Seed state for the Reel Defaults form. One flat object so `setState(ch =>
 *  ({ ...ch }))` updates are trivial and each tab can receive a `set(patch)`
 *  helper.
 */
/** Default platform list persisted to /defaults.platforms (back jsonb owner). */
export const DEFAULT_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'gbp'];

/** Namespaced keys used inside defaults.settings to host the Automation
 *  toggles that the back's /automation endpoint refuses (extra='forbid').
 *  See feature 6 for the rationale. */
export const AUTOMATION_SETTINGS_KEYS = {
  quietHoursEnabled: 'automation.quietHoursEnabled',
  skipWeekends: 'automation.skipWeekends',
  autoCaptions: 'automation.autoCaptions',
  regenOnUpdate: 'automation.regenOnUpdate',
  reviewEmails: 'automation.reviewEmails',
  reviewWindowEnabled: 'automation.reviewWindowEnabled',
  reviewWindowHours: 'automation.reviewWindowHours',
};

export const INITIAL_DEFAULTS = {
  // Platforms (canonical owner: defaults.platforms on back)
  platforms: DEFAULT_PLATFORMS,

  // Automation-namespaced toggles persisted under defaults.settings
  [AUTOMATION_SETTINGS_KEYS.quietHoursEnabled]: true,
  [AUTOMATION_SETTINGS_KEYS.skipWeekends]: false,
  [AUTOMATION_SETTINGS_KEYS.autoCaptions]: true,
  [AUTOMATION_SETTINGS_KEYS.regenOnUpdate]: false,
  [AUTOMATION_SETTINGS_KEYS.reviewEmails]: '',
  [AUTOMATION_SETTINGS_KEYS.reviewWindowEnabled]: true,
  [AUTOMATION_SETTINGS_KEYS.reviewWindowHours]: 1,

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
  subHighlightWord: true,
  subHighlightColor: '#2b57f6',
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

  // Intro / outro
  introEnabled: true,
  introSource: 'uploaded',
  introDuration: 2.5,
  introFile: { name: 'agency-intro.mp4', size: '4.2 MB', duration: '0:02' },
  outroEnabled: true,
  outroSource: 'uploaded',
  outroDuration: 3,
  outroFile: { name: 'agency-outro-cta.mp4', size: '5.8 MB', duration: '0:03' },
  skipForRentals: false,
};
