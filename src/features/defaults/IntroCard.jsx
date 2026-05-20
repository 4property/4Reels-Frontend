import { UploadVideoCard } from './UploadVideoCard.jsx';

const INTRO_COPY = {
  title: 'Intro video',
  subtitle: 'Plays at the start of every reel.',
  previewTag: 'INTRO',
  previewNoneLabel: 'No intro',
  chipFallbackName: 'intro',
  removeAria: 'Remove intro',
  deleteFallbackError: 'Failed to delete intro.',
};

/**
 * Feature 34 — thin wrapper over `UploadVideoCard` for the intro slot. Mirrors
 * `OutroCard` exactly; the only differences are the kind prop, copy and the
 * resulting endpoint paths the shared component fires.
 */
export function IntroCard(props) {
  return <UploadVideoCard kind="intro" copy={INTRO_COPY} {...props} />;
}
