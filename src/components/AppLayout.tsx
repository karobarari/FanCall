import { useState, type CSSProperties } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Avatar from "./Avatar";
import ClubBadge from "./ClubBadge";

function navClass({ isActive }: { isActive: boolean }) {
  const base =
    "flex items-center gap-[11px] py-[11px] px-[13px] rounded-[10px] no-underline text-sm font-medium transition-colors";

  return isActive
    ? `${base} bg-gold/15 text-gold`
    : `${base} text-muted hover:bg-white/[0.06] hover:text-ink`;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleLogout() {
    setSigningOut(true);

    try {
      await logout();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-ink font-sans overflow-x-hidden">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed top-4 left-4 z-50 bg-navy-deep border border-white/10 text-ink p-2 rounded-md"
        aria-label="Toggle menu"
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-56
          bg-navy-deep border-r border-white/10
          py-[22px] px-4 flex flex-col gap-7
          z-40
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center gap-3 pt-14">
          <ClubBadge size={42} logoUrl={user?.team_logo_url} alt={user?.team_name} />

          <div className="flex flex-col leading-[1.2]">
            <span className="font-bold text-base tracking-[0.3px]">
              FanCall
            </span>

            <span className="text-[10px] text-faint uppercase tracking-[1px]">
              Manchester City Predictions
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-1" onClick={() => setIsOpen(false)}>
          <NavLink to="/app" end className={navClass}>
            <span className="text-[13px] w-4 text-center" aria-hidden>
              ◆
            </span>
            Make Your Call
          </NavLink>

          <NavLink to="/app/leaderboard" className={navClass}>
            <span className="text-[13px] w-4 text-center" aria-hidden>
              ▲
            </span>
            Leaderboard
          </NavLink>

          {user?.is_admin && (
            <NavLink to="/app/admin" className={navClass}>
              <span className="text-[13px] w-4 text-center" aria-hidden>
                ⚙
              </span>
              Admin Dashboard
            </NavLink>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          {user && (
            <NavLink
              to="/app/profile"
              className="px-1 leading-[1.3] no-underline hover:opacity-80 flex items-center gap-2.5"
            >
              <Avatar name={user.display_name ?? user.email} avatar={user.avatar} size={40} />
              <div>
                <div className="font-medium text-sm text-ink">{user.display_name}</div>
                <div className="text-[11px] text-faint uppercase tracking-[0.5px]">
                  {user.team_name}
                </div>
              </div>
            </NavLink>
          )}
          <button
            className="bg-transparent border border-white/10 text-muted rounded-[10px] p-2.5 text-[13px] cursor-pointer hover:border-white/20 hover:text-ink"
            onClick={handleLogout}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </aside>

      {/* Main Content — theme-light re-skins every screen rendered below
          (via the CSS-variable cascade in playpage.css) to a light theme,
          while the sidebar above stays dark navy. */}
      <main
        className={`
          theme-light bg-surface text-ink
          min-h-screen
          transition-all duration-300
          pt-16 px-8
          ${isOpen ? "ml-56" : "ml-0"}
        `}
        // Per-club branding: only set when the club has actually configured
        // custom colours (teams.primary_color/secondary_color) — omitting
        // the property when unset (rather than passing undefined-as-string)
        // lets .theme-light's own default win, so an unbranded club still
        // gets the pilot's sky-blue/gold look instead of some empty value.
        style={{
          ...(user?.team_primary_color ? { "--color-gold": user.team_primary_color } : {}),
          ...(user?.team_secondary_color
            ? { "--color-city-gold": user.team_secondary_color }
            : {}),
        } as CSSProperties}
      >
        <Outlet />
      </main>
    </div>
  );
}
