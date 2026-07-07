// The real Manchester City crest (public/images/Manchester_City_FC_badge.svg),
// replacing the old "MC" text-in-a-circle placeholder everywhere it appeared.
export default function ClubBadge({
  size = 56,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/images/Manchester_City_FC_badge.svg"
      alt="Manchester City"
      width={size}
      height={size}
      className={`rounded-full ring-2 ring-city-gold shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
