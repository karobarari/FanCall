// A large, very low-opacity crest used as background texture behind a
// screen's header — purely decorative, so it's hidden from assistive tech
// and never intercepts clicks. The parent needs `relative` positioning;
// this renders behind sibling content via a negative z-index rather than
// relying on DOM order, so it stays out of the way regardless of what
// else is in the header.
export default function CrestWatermark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/images/Manchester_City_FC_badge.svg"
      alt=""
      aria-hidden="true"
      className={`pointer-events-none select-none absolute -z-10 opacity-[0.06] ${className}`}
    />
  );
}
