import { Navigate } from 'react-router-dom';
import { useCan } from './useCan.js';

/**
 * Route-level guard. Renders `children` if the current user has the given
 * (module, level), otherwise redirects to `redirectTo` (default `/reels`).
 *
 * Usage in Shell:
 *   <Route path="/v1/admin" element={
 *     <RequirePermission module="admin">
 *       <AdminView/>
 *     </RequirePermission>
 *   }/>
 */
export function RequirePermission({ module, level = 'read', redirectTo = '/reels', children }) {
  const allowed = useCan(module, level);
  if (!allowed) return <Navigate to={redirectTo} replace />;
  return children;
}
