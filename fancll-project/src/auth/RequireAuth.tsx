import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Layout route. If signed in, render the nested routes via <Outlet />.
// If not, bounce to login. Mount this once and it covers every child route.
export default function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <Outlet />;
}
