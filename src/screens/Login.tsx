import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import OAuthButtons from "../components/OAuthButtons";
import ClubBadge from "../components/ClubBadge";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled.",
  session: "That sign-in link expired — please try again.",
  conflict: "An account already exists with this email — log in with your password instead.",
  failed: "Something went wrong signing you in. Please try again.",
};

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    () => OAUTH_ERROR_MESSAGES[searchParams.get("oauth_error") ?? ""] ?? null,
  );
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center p-4 gap-3">
      <ClubBadge size={72} className="mx-auto" />
      <p className="text-center text-[#73726c] text-[15px] mt-2 mb-4">
        FanCall
      </p>
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
        onClick={submit}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <Link
        to="/signup"
        className="bg-transparent border-0 text-[#73726c] text-sm p-3 cursor-pointer text-center no-underline"
      >
        Create account
      </Link>

      <OAuthButtons />
    </div>
  );
}
