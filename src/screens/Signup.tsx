import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import OAuthButtons from "../components/OAuthButtons";
import ClubBadge from "../components/ClubBadge";
import { fetchTeams, type Team } from "../lib/teams";

const selectClass =
  "h-12 border border-[#e4e3de] rounded-xl px-3.5 text-[15px] text-[#1a1a18] bg-white w-full box-border";

export default function Signup() {
  const navigate = useNavigate();
  const { user, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTeams()
      .then(setTeams)
      .catch(() => {
        // Left empty — the picker just shows "Choose your club" with no
        // options; submit already blocks on an empty teamId either way.
      });
  }, []);

  if (user) return <Navigate to="/app" replace />;

  async function submit() {
    setError(null);
    if (!teamId) {
      setError("Choose your club to continue.");
      return;
    }
    setBusy(true);
    try {
      await signup(email, password, displayName, teamId);
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
        placeholder="Username"
        type="text"
        autoComplete="username"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <select
        className={selectClass + (teamId ? "" : " text-[#73726c]")}
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
      >
        <option value="" disabled>
          Choose your club
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id} className="text-[#1a1a18]">
            {t.name}
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
        autoComplete="new-password"
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
        {busy ? "Creating account…" : "Create account"}
      </button>
      <Link
        to="/login"
        className="bg-transparent border-0 text-[#73726c] text-sm p-3 cursor-pointer text-center no-underline"
      >
        Already have an account? Sign in
      </Link>

      <OAuthButtons />
    </div>
  );
}
