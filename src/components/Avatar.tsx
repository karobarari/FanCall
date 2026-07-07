import { AVATAR_COLORS, AVATAR_ICONS, avatarColor, initials, parseAvatar } from '../lib/avatar';

// Renders the user's chosen preset ("<color>-<icon>") when set, otherwise
// falls back to initials on a colour derived from the name.
export default function Avatar({
  name,
  avatar,
  size = 56,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
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
