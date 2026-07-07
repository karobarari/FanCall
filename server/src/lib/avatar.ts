// Preset avatar allowlist. A stored avatar is "<color>-<icon>" from these
// lists — keep them in sync with the rendering maps in src/lib/avatar.ts on
// the frontend, which owns the actual hex values and emoji.
export const AVATAR_COLORS = ['sky', 'gold', 'green', 'purple', 'orange', 'teal'] as const;
export const AVATAR_ICONS = ['ball', 'trophy', 'crown', 'star', 'bolt', 'flame', 'shield', 'lion'] as const;

export const AVATAR_MESSAGE = 'Invalid avatar preset';

export function isValidAvatar(value: string): boolean {
  const dash = value.indexOf('-');
  if (dash === -1) return false;
  const color = value.slice(0, dash);
  const icon = value.slice(dash + 1);
  return (
    (AVATAR_COLORS as readonly string[]).includes(color) &&
    (AVATAR_ICONS as readonly string[]).includes(icon)
  );
}
