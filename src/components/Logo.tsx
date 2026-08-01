export const LOGO_RING_PATH = 'M48.5 33.5 A17 17 0 1 1 30.5 15.05';
export const LOGO_PORTION_PATH = 'M36.4 27.6 L36.4 16.4 A11.2 11.2 0 0 1 47.6 27.6 Z';

type LogoProps = {
  className?: string;
  alt?: string;
  variant?: 'tile' | 'mark';
};

export default function Logo({ className = 'h-9 w-auto', alt = 'Bachelor Point', variant = 'tile' }: LogoProps) {
  const tile = variant === 'tile';
  const ink = tile ? '#ffffff' : '#0f172a';

  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={alt} xmlns="http://www.w3.org/2000/svg">
      <title>{alt}</title>
      {tile && <rect width="64" height="64" rx="15" fill="#0f172a" />}
      <path d={LOGO_RING_PATH} fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <path
        d={LOGO_PORTION_PATH}
        fill="#f59e0b"
        stroke="#f59e0b"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
