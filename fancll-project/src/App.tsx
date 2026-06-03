import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import { DataProvider } from './data/store';
import TabLayout from './components/TabLayout';
import Login from './screens/Login';
import Fixtures from './screens/Fixtures';
import Predict from './screens/Predict';
import Leaderboard from './screens/Leaderboard';
import './styles.css';

function Routed() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="screen center">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<TabLayout />}>
          <Route index element={<Navigate to="fixtures" replace />} />
          <Route path="fixtures" element={<Fixtures />} />
          <Route path="leaderboard" element={<Leaderboard />} />
        </Route>
        <Route path="/predict/:fixtureId" element={<Predict />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <div className="shell">
            <Routed />
          </div>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}
