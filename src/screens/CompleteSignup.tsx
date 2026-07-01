import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost } from "../lib/api";

interface Team {
  id: string;
  name: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

// Landing spot after a brand-new Google/Apple sign-in. The provider already
// confirmed who they are (a pending cookie holds that), but FanCall still
// needs a team + username before an account can exist — same requirement a
// password signup has, just reached via a different door.
export default function CompleteSignup() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    apiGet<{ teams: Team[] }>("/teams")
      .then(({ teams }) => {
        setTeams(teams);
        if (teams.length) setTeamId(teams[0].id);
      })
      .catch(() => setError("Couldn't load teams — refresh to try again."))
      .finally(() => setLoadingTeams(false));
  }, []);

  if (user) return <Navigate to="/app" replace />;

  async function submit() {
    setError(null);
    if (!USERNAME_PATTERN.test(displayName)) {
      setError("Username must be 3-20 characters: letters, numbers, underscore.");
      return;
    }
    if (!teamId) {
      setError("Pick a team.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/auth/oauth/complete", { team_id: teamId, display_name: displayName });
      await refreshMe();
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center p-4 gap-3">
      <p className="text-center text-[#1a1a18] text-[17px] font-medium mt-2 mb-1">
        Finish setting up your account
      </p>
      <p className="text-center text-[#73726c] text-[13px] mb-3">
        Pick a username and your team.
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
        className="h-12 border border-[#e4e3de] rounded-xl px-3.5 text-[15px] text-[#1a1a18] bg-white w-full box-border"
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        disabled={loadingTeams}
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-[#c0392b] text-center text-[13px] m-0">{error}</p>
      )}

      <button
        className="h-12 rounded-xl bg-[#0f6e56] text-white border-0 text-[15px] font-medium cursor-pointer w-full active:scale-[0.99]"
        disabled={busy || loadingTeams}
        onClick={submit}
      >
        {busy ? "Finishing up…" : "Continue"}
      </button>
    </div>
  );
}
