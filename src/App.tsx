import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import RequireAdmin from "./auth/RequireAdmin";
import { DataProvider } from "./data/store";
import AppLayout from "./components/AppLayout";
import Login from "./screens/Login";
import Signup from "./screens/Signup";
import CompleteSignup from "./screens/CompleteSignup";
import Payment from "./screens/Payment";
import MakeYourCall from "./screens/MakeYourCall";
import Leaderboard from "./screens/Leaderboard";
import Admin from "./screens/Admin";
import "./playpage.css";

// The centered white card every pre-auth screen (login/signup/complete
// profile) sits inside.
function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f4f2] flex justify-center">
      <div className="w-full max-w-[440px] bg-white min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}

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
        path="/login"
        element={
          <AuthCard>
            <Login />
          </AuthCard>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthCard>
            <Signup />
          </AuthCard>
        }
      />
      <Route
        path="/complete-signup"
        element={
          <AuthCard>
            <CompleteSignup />
          </AuthCard>
        }
      />
      <Route
        path="/payment"
        element={
          <AuthCard>
            <Payment />
          </AuthCard>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<MakeYourCall />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<Admin />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
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
