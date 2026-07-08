import { API_URL } from '../lib/api';
import { AVATAR_COLORS, AVATAR_ICONS, avatarColor, initials, parseAvatar } from '../lib/avatar';

// Renders, in priority order: an uploaded photo, then the chosen preset
// ("<color>-<icon>"), then initials on a colour derived from the name.
// avatarUrl is a path relative to the API's own origin (e.g.
// "/uploads/avatars/<id>.png?v=...") — resolved against API_URL rather than
// the frontend's own origin, since the file is served by the backend.
export default function Avatar({
  name,
  avatar,
  avatarUrl,
  size = 56,
}: {
  name: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    const apiOrigin = API_URL.replace(/\/api\/?$/, '');
    return (
      <img
        src={`${apiOrigin}${avatarUrl}`}
        alt={name}
        width={size}
        height={size}
        className="rounded-full ring-2 ring-city-gold object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  const preset = parseAvatar(avatar);
  return (
    <div
      className="rounded-full ring-2 ring-city-gold flex items-center justify-center font-extrabold text-navy shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: preset ? AVATAR_COLORS[preset.color] : avatarColor(name),
        fontSize: size * (preset ? 0.5 : 0.32),
      }}
    >
      {preset ? AVATAR_ICONS[preset.icon] : initials(name)}
    </div>
  );
}
