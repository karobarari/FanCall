import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import { DataProvider } from './data/store';
import AppLayout from './components/AppLayout';
import Login from './screens/Login';
import MakeYourCall from './screens/MakeYourCall';
import Leaderboard from './screens/Leaderboard';
import Admin from './screens/Admin';
import './playpage.css';

function Routed() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-muted font-sans">
        Loading…
      </div>
    );
  }
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-[#f4f4f2] flex justify-center">
            <div className="w-full max-w-[440px] bg-white min-h-screen flex flex-col">
              <Login />
            </div>
          </div>
        }
      />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<MakeYourCall />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="admin" element={<Admin />} />
        </Route>
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
          <Routed />
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}
