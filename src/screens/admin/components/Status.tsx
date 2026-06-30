export function Loading({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-muted text-sm">
      {label}
    </div>
  );
}

export function ErrorBlock({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center gap-3">
      <p className="text-muted text-sm m-0">{label}</p>
      <button
        onClick={onRetry}
        className="rounded-[10px] border border-white/15 text-ink px-3 py-1.5 text-[13px] hover:bg-white/5"
      >
        Retry
      </button>
    </div>
  );
}
