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

  if (user) return <Navigate to="/app" replace />;

  async function submit(action: "login" | "signup") {
    setError(null);
    setBusy(true);
    try {
      if (action === "login") await login(email, password);
      else await signup(email, password);
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center p-4 gap-3">
      <div className="w-[72px] h-[72px] border border-dashed border-[#e4e3de] rounded-xl flex items-center justify-center text-[#73726c] text-[13px] mx-auto">
        logo
      </div>
      <p className="text-center text-[#73726c] text-[15px] mt-2 mb-4">FanCall</p>

      <input
        className="h-12 border border-[#e4e3de] rounded-xl px-3.5 text-[15px] text-[#1a1a18] bg-white w-full box-border placeholder:text-[#73726c]"
        placeholder="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="h-12 border border-[#e4e3de] rounded-xl px-3.5 text-[15px] text-[#1a1a18] bg-white w-full box-border placeholder:text-[#73726c]"
        placeholder="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p className="text-[#c0392b] text-center text-[13px] m-0">{error}</p>
      )}

      <button
        className="h-12 rounded-xl bg-[#0f6e56] text-white border-0 text-[15px] font-medium cursor-pointer w-full active:scale-[0.99]"
        disabled={busy}
        onClick={() => submit("login")}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <button
        className="bg-transparent border-0 text-[#73726c] text-sm p-3 cursor-pointer text-center"
        disabled={busy}
        onClick={() => submit("signup")}
      >
        Create account
      </button>
    </div>
  );
}
