export function EmptyState({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="bg-panel border border-dashed border-white/15 rounded-card p-10 text-center">
      <p className="text-[15px] font-semibold text-ink m-0">{title}</p>
      {lines.map((l, i) => (
        <p key={i} className="text-[13px] text-muted m-0 mt-1.5">
          {l}
        </p>
      ))}
    </div>
  );
}
