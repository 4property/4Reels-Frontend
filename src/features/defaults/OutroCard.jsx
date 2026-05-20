import { UploadVideoCard } from './UploadVideoCard.jsx';

const OUTRO_COPY = {
  title: 'Outro video',
  subtitle: 'Plays at the end of every reel. Great for CTAs and contact info.',
  previewTag: 'OUTRO',
  previewNoneLabel: 'No outro',
  chipFallbackName: 'outro',
  removeAria: 'Remove outro',
  deleteFallbackError: 'Failed to delete outro.',
};

/**
 * Feature 33 — thin wrapper over `UploadVideoCard` for the outro slot. The
 * server contract (POST `/outro/upload`, GET `/outro/file`, DELETE `/outro`,
 * `outro_*` fields on `/defaults`) lives on the shared component so the intro
 * card (feature 34) can mirror the same behavior.
 */
export function OutroCard(props) {
  return <UploadVideoCard kind="outro" copy={OUTRO_COPY} {...props} />;
}
