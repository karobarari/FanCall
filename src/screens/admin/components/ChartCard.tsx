import { type ReactNode } from "react";

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-panel border border-white/10 rounded-card p-5">
      <p className="text-[15px] font-semibold text-ink m-0">{title}</p>
      <p className="text-[13px] text-muted m-0 mt-0.5 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}
