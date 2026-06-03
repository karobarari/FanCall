import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { user, login, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in — don't show the form.
  if (user) return <Navigate to="/app/fixtures" replace />;

  async function submit(action: "login" | "signup") {
    setError(null);
    setBusy(true);
    try {
      if (action === "login") await login(email, password);
      else await signup(email, password);
      navigate("/app/fixtures");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen center">
      <div className="logo">logo</div>
      <p className="app-name">FanCall</p>

      <input
        className="field"
        placeholder="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field"
        placeholder="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p
          style={{
            color: "#c0392b",
            textAlign: "center",
            fontSize: 13,
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <button className="btn" disabled={busy} onClick={() => submit("login")}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <button
        className="ghost"
        disabled={busy}
        onClick={() => submit("signup")}
      >
        Create account
      </button>
    </div>
  );
}
