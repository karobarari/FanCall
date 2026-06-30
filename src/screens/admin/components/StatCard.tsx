import { type LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  valueClass = "text-ink",
  iconClass = "text-muted",
  accent,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  iconClass?: string;
  accent?: "green" | "gold";
  muted?: boolean;
}) {
  const accentBg =
    accent === "green"
      ? "bg-green/5 border-green/20"
      : accent === "gold"
        ? "bg-gold/5 border-gold/20"
        : "bg-panel border-white/10";
  return (
    <div
      className={`${accentBg} border rounded-card p-5 flex gap-4 ${muted ? "opacity-70" : ""}`}
    >
      <div className="w-12 h-12 shrink-0 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon size={20} className={iconClass} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide uppercase text-faint m-0">
          {label}
        </p>
        <p className={`text-[26px] leading-tight font-bold m-0 mt-1 ${valueClass}`}>
          {value}
        </p>
        {sub && <p className="text-[13px] text-muted m-0 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}
