// Preset avatars: a stored value is "<color>-<icon>" from the maps below
// (validated server-side against the matching lists in
// server/src/lib/avatar.ts). No stored value → fall back to a deterministic
// initials avatar: same username always renders the same initials + colour.

export const AVATAR_COLORS = {
  sky: '#6cabdd',
  gold: '#ffc659',
  green: '#4fae7d',
  purple: '#c77dff',
  orange: '#ff8a65',
  teal: '#5ec8d8',
} as const;

export const AVATAR_ICONS = {
  ball: '⚽',
  trophy: '🏆',
  crown: '👑',
  star: '⭐',
  bolt: '⚡',
  flame: '🔥',
  shield: '🛡️',
  lion: '🦁',
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;
export type AvatarIcon = keyof typeof AVATAR_ICONS;

export function makeAvatar(color: AvatarColor, icon: AvatarIcon): string {
  return `${color}-${icon}`;
}

export function parseAvatar(value: string | null | undefined): { color: AvatarColor; icon: AvatarIcon } | null {
  if (!value) return null;
  const dash = value.indexOf('-');
  if (dash === -1) return null;
  const color = value.slice(0, dash);
  const icon = value.slice(dash + 1);
  if (!(color in AVATAR_COLORS) || !(icon in AVATAR_ICONS)) return null;
  return { color: color as AvatarColor, icon: icon as AvatarIcon };
}

const PALETTE = Object.values(AVATAR_COLORS);

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function avatarColor(name: string): string {
  if (!name) return PALETTE[0];
  return PALETTE[hashCode(name) % PALETTE.length];
}

export function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : '?';
}
