import { useNavigate, useParams } from 'react-router-dom';
import { ReelEditor } from './editor/ReelEditor.jsx';

/**
 * Reads the site_id and source_property_id from
 * `/reels/:siteId/:sourcePropertyId` and navigates back to `/reels` on close.
 */
export function ReelEditorRoute() {
  const { siteId, sourcePropertyId } = useParams();
  const navigate = useNavigate();
  return (
    <ReelEditor
      siteId={siteId}
      sourcePropertyId={sourcePropertyId}
      onClose={() => navigate('/reels')}
    />
  );
}
