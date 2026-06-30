import { CheckCircle2 } from "lucide-react";
import { cap } from "../utils";

export function StatusBadge({ status }: { status: string }) {
  if (status === "finished")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 text-gold text-[12px] font-semibold px-2.5 py-1">
        <CheckCircle2 size={13} /> Finished
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 text-muted text-[12px] font-semibold px-2.5 py-1">
      {cap(status) || "Scheduled"}
    </span>
  );
}
