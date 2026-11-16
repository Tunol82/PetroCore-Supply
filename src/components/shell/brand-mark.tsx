export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="PetroCore"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="pc-brand-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b2545" />
          <stop offset="0.55" stopColor="#1e40af" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#pc-brand-mark)" />
      <path
        d="M24 18 L24 48 M24 18 L36 18 Q46 18 46 28 Q46 38 36 38 L24 38"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="41" cy="44" r="4" fill="#34d399" />
    </svg>
  );
}
