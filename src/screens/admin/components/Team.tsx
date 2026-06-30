import { HIGHLIGHT_TEAM } from "../config";

export function Team({ name }: { name: string }) {
  const hl = HIGHLIGHT_TEAM !== "" && name === HIGHLIGHT_TEAM;
  return (
    <span className={hl ? "font-semibold text-gold" : "font-medium text-ink"}>
      {name}
    </span>
  );
}
