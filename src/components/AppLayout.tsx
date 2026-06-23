import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function navClass({ isActive }: { isActive: boolean }) {
  const base =
    'flex items-center gap-[11px] py-[11px] px-[13px] rounded-[10px] no-underline text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-gold/15 text-gold`
    : `${base} text-muted hover:bg-white/[0.06] hover:text-ink`;
}

export default function AppLayout() {
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full text-left bg-navy text-ink font-sans">
      <aside className="w-56 shrink-0 bg-navy-deep border-r border-white/10 py-[22px] px-4 flex flex-col gap-7">
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-[11px] bg-gradient-to-br from-gold to-[#b9802a] text-[#1a1205] font-extrabold text-[15px] flex items-center justify-center tracking-[-0.5px]">
            FC
          </div>
          <div className="flex flex-col leading-[1.2]">
            <span className="font-bold text-base tracking-[0.3px]">FanCall</span>
            <span className="text-[10px] text-faint uppercase tracking-[1px]">
              Sports Prediction Game
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink to="/app" end className={navClass}>
            <span className="text-[13px] w-4 text-center" aria-hidden>◆</span> Make Your Call
          </NavLink>
          <NavLink to="/app/leaderboard" className={navClass}>
            <span className="text-[13px] w-4 text-center" aria-hidden>▲</span> Leaderboard
          </NavLink>
          <NavLink to="/app/admin" className={navClass}>
            <span className="text-[13px] w-4 text-center" aria-hidden>⚙</span> Admin Dashboard
          </NavLink>
        </nav>

        <button
          className="mt-auto bg-transparent border border-white/10 text-muted rounded-[10px] p-2.5 text-[13px] cursor-pointer hover:border-white/20 hover:text-ink"
          onClick={handleLogout}
          disabled={signingOut}
        >
          {signingOut ? 'Signing out…' : 'Log out'}
        </button>
      </aside>

      <main className="flex-1 min-w-0 py-7 px-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
