import { Outlet, NavLink } from 'react-router-dom';

export default function TabLayout() {
  return (
    <>
      <Outlet />
      <nav className="tabbar">
        <NavLink
          to="/app/fixtures"
          className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
        >
          Fixtures
        </NavLink>
        <NavLink
          to="/app/leaderboard"
          className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
        >
          Leaderboard
        </NavLink>
      </nav>
    </>
  );
}
