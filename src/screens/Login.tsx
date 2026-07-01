import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { API_URL, apiGet } from "../lib/api";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled.",
  session: "That sign-in link expired — please try again.",
  conflict: "An account already exists with this email — log in with your password instead.",
  failed: "Something went wrong signing you in. Please try again.",
};

interface Team {
  id: string;
  name: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { user, login, signup } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    () => OAUTH_ERROR_MESSAGES[searchParams.get("oauth_error") ?? ""] ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");

  // Only needed for signup, but the endpoint is public and cheap, so fetch
  // once up front rather than gating it on which button gets clicked.
  useEffect(() => {
    apiGet<{ teams: Team[] }>("/teams")
      .then(({ teams }) => {
        setTeams(teams);
        if (teams.length) setTeamId(teams[0].id);
      })
      .catch(() => {
        // Login still works without this; signup will just surface the
        // "pick a team" error from the server if it's tried.
      });
  }, []);

  if (user) return <Navigate to="/app" replace />;

  async function submit(action: "login" | "signup") {
    setError(null);
    setBusy(true);
    try {
      if (action === "login") await login(email, password);
      else await signup(email, password, displayName, teamId);
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
      <p className="text-center text-[#73726c] text-[15px] mt-2 mb-4">
        FanCall
      </p>
      <input
        className="h-12 border border-[#e4e3de] rounded-xl px-3.5 text-[15px] text-[#1a1a18] bg-white w-full box-border placeholder:text-[#73726c]"
        placeholder="Display Name"
        type="text"
        autoComplete="name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <select
        className="h-12 border border-[#e4e3de] rounded-xl px-3.5 text-[15px] text-[#1a1a18] bg-white w-full box-border"
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
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

      <div className="flex items-center gap-3 my-1 text-[#73726c] text-[13px]">
        <div className="flex-1 h-px bg-[#e4e3de]" />
        or
        <div className="flex-1 h-px bg-[#e4e3de]" />
      </div>

      <a
        href={`${API_URL}/auth/google`}
        className="h-12 rounded-xl border border-[#e4e3de] text-[#1a1a18] text-[15px] font-medium w-full flex items-center justify-center no-underline active:scale-[0.99]"
      >
        Continue with Google
      </a>
      <a
        href={`${API_URL}/auth/apple`}
        className="h-12 rounded-xl border border-[#e4e3de] text-[#1a1a18] text-[15px] font-medium w-full flex items-center justify-center no-underline active:scale-[0.99]"
      >
        Continue with Apple
      </a>
    </div>
  );
}
