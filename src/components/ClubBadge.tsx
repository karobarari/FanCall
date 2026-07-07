// The club's crest — logoUrl comes from the signed-in user's own club
// (teams.logo_url), falling back to the pilot's Man City crest for any
// club that hasn't had one set yet (every club except Man City, today).
export default function ClubBadge({
  size = 56,
  className = '',
  logoUrl,
  alt = 'Club crest',
}: {
  size?: number;
  className?: string;
  logoUrl?: string | null;
  alt?: string;
}) {
  return (
    <img
      src={logoUrl ?? '/images/Manchester_City_FC_badge.svg'}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ring-2 ring-city-gold shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
