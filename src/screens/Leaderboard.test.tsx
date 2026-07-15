import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import Leaderboard from './Leaderboard';
import type { Standing } from '../data/store';
import type { User } from '../auth/AuthContext';

// Leaderboard reads the signed-in user, the club standings (via the store),
// and — when the league scope is enabled — the cross-club standings via
// apiGet. All three seams are mocked so the screen renders in isolation.
const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useLeaderboard: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('../data/store', () => ({ useLeaderboard: mocks.useLeaderboard }));
// Avatar imports API_URL from the same module, so the mock must provide it.
vi.mock('../lib/api', () => ({
  apiGet: mocks.apiGet,
  API_URL: 'http://localhost:3000/api',
}));

const me: User = {
  id: 'u-me',
  email: 'me@example.com',
  display_name: 'Me',
  avatar: null,
  avatar_url: null,
  team_id: 't-city',
  team_name: 'Manchester City',
  team_primary_color: null,
  team_secondary_color: null,
  team_logo_url: null,
  paid: true,
  is_admin: false,
};

function standing(
  overrides: Partial<Standing> & { user_id: string; rank: number },
): Standing {
  return {
    display_name: `Player ${overrides.user_id}`,
    total_points: 0,
    team_id: 't-city',
    team_name: 'Manchester City',
    team_logo_url: null,
    avatar: null,
    avatar_url: null,
    ...overrides,
  };
}

function mockStandings(leaderboard: Standing[], loading = false) {
  mocks.useLeaderboard.mockReturnValue({ leaderboard, loading, refresh: vi.fn() });
}

beforeEach(() => {
  mocks.useAuth.mockReturnValue({ user: me });
  mockStandings([]);
  mocks.apiGet.mockResolvedValue({ leaderboard: [] });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Leaderboard', () => {
  it('shows skeleton rows while the club standings are loading', () => {
    mockStandings([], true);
    const { container } = render(<Leaderboard />);

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText(/no players yet/i)).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no standings', () => {
    render(<Leaderboard />);

    expect(
      screen.getByText(/no players yet — be the first to make a call/i),
    ).toBeInTheDocument();
  });

  it('renders one row per player with rank, name and points', () => {
    mockStandings([
      standing({ user_id: 'u-1', rank: 1, display_name: 'Alice', total_points: 210 }),
      standing({ user_id: 'u-2', rank: 2, display_name: 'Bilal', total_points: 180 }),
      standing({ user_id: 'u-3', rank: 3, display_name: null, total_points: 90 }),
    ]);
    render(<Leaderboard />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('1')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Alice')).toBeInTheDocument();
    expect(within(rows[0]).getByText('210')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Bilal')).toBeInTheDocument();
    // Null display_name falls back to "Unknown" rather than a blank row.
    expect(within(rows[2]).getByText('Unknown')).toBeInTheDocument();
  });

  it("highlights the signed-in user's row and shows their rank card", () => {
    mockStandings([
      standing({ user_id: 'u-1', rank: 1, display_name: 'Alice', total_points: 210 }),
      standing({ user_id: 'u-me', rank: 2, display_name: 'Me', total_points: 150 }),
    ]);
    render(<Leaderboard />);

    const [aliceRow, myRow] = screen.getAllByRole('listitem');
    expect(myRow.className).toContain('border-gold');
    expect(aliceRow.className).not.toContain('border-gold');

    // Header rank card: "#2" plus the points figure.
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === '150 pts'),
    ).toBeInTheDocument();
  });

  it('omits the rank card when the signed-in user is not on the board', () => {
    mockStandings([
      standing({ user_id: 'u-1', rank: 1, display_name: 'Alice', total_points: 210 }),
    ]);
    render(<Leaderboard />);

    expect(screen.queryByText(/^#\d+$/)).not.toBeInTheDocument();
  });

  describe('league scope disabled', () => {
    it('hides the scope tabs and locks the screen to the club leaderboard', () => {
      mockStandings([
        standing({ user_id: 'u-1', rank: 1, display_name: 'Alice', total_points: 210 }),
      ]);
      const { container } = render(<Leaderboard />);

      // No scope switcher at all — the tabs are the only buttons on screen.
      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      // Club header, never the cross-club league one.
      expect(
        screen.getByText('Manchester City · Club standings'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/RYG-FanCall League/)).not.toBeInTheDocument();

      // The platform re-theme only applies in league scope.
      expect(container.firstElementChild).not.toHaveClass('theme-platform');

      // Club scope never shows the per-row club name sub-line.
      expect(screen.queryByText('Manchester City')).not.toBeInTheDocument();
    });

    it('never fetches the league leaderboard', () => {
      mockStandings([
        standing({ user_id: 'u-1', rank: 1, display_name: 'Alice', total_points: 210 }),
      ]);
      const { rerender } = render(<Leaderboard />);
      rerender(<Leaderboard />);

      expect(mocks.apiGet).not.toHaveBeenCalled();
    });
  });

  describe('rank change indicators', () => {
    it('shows movement arrows when ranks change, then clears them', () => {
      // Fake only the timeout pair: CountUp's requestAnimationFrame /
      // performance.now must stay real or the points tween never settles.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      mockStandings([
        standing({ user_id: 'u-1', rank: 1, display_name: 'Alice', total_points: 210 }),
        standing({ user_id: 'u-2', rank: 2, display_name: 'Bilal', total_points: 180 }),
      ]);
      const { rerender } = render(<Leaderboard />);
      expect(screen.queryByText(/[▲▼]/)).not.toBeInTheDocument();

      // A refresh comes in with Bilal and Alice swapped, plus a newcomer.
      mockStandings([
        standing({ user_id: 'u-2', rank: 1, display_name: 'Bilal', total_points: 220 }),
        standing({ user_id: 'u-1', rank: 2, display_name: 'Alice', total_points: 215 }),
        standing({ user_id: 'u-3', rank: 3, display_name: 'Cato', total_points: 90 }),
      ]);
      rerender(<Leaderboard />);

      expect(screen.getByText('▲1')).toBeInTheDocument(); // Bilal moved up
      expect(screen.getByText('▼1')).toBeInTheDocument(); // Alice moved down
      // A newcomer has no previous rank, so no arrow.
      const catoRow = screen
        .getAllByRole('listitem')
        .find((row) => within(row).queryByText('Cato'))!;
      expect(within(catoRow).queryByText(/[▲▼]/)).not.toBeInTheDocument();

      // Arrows are transient — gone after the indicator window elapses.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText(/[▲▼]/)).not.toBeInTheDocument();
    });

    it('shows no arrows when a refresh leaves ranks unchanged', () => {
      const board = [
        standing({ user_id: 'u-1', rank: 1, display_name: 'Alice', total_points: 210 }),
        standing({ user_id: 'u-2', rank: 2, display_name: 'Bilal', total_points: 180 }),
      ];
      mockStandings(board);
      const { rerender } = render(<Leaderboard />);

      // Same ranks, fresh array identity — as after a periodic refresh.
      mockStandings(board.map((row) => ({ ...row })));
      rerender(<Leaderboard />);

      expect(screen.queryByText(/[▲▼]/)).not.toBeInTheDocument();
    });
  });
});
