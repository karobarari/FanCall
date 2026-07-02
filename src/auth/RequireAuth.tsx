import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Layout route. If signed in and paid, render the nested routes via
// <Outlet />. If not signed in, bounce to login; if signed in but the demo
// payment step hasn't been completed, bounce to /payment. Mount this once
// and it covers every child route.
export default function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.paid) return <Navigate to="/payment" replace />;
  return <Outlet />;
}
