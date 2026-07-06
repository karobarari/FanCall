import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Layout route for admin-only pages. Mounted inside RequireAuth, so `user`
// is guaranteed to exist here — this only adds the is_admin check. Bounces
// non-admins back to the app rather than showing a dashboard whose actions
// would all just 403 against the server anyway (that's still the real
// enforcement — see requireAdmin in the backend — this is the UI-side match).
export default function RequireAdmin() {
  const { user } = useAuth();
  if (!user?.is_admin) return <Navigate to="/app" replace />;
  return <Outlet />;
}
