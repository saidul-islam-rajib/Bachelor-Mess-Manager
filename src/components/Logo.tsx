import { useState } from 'react';

// Prefers /logo.png (drop the real PNG into public/), and falls back to the
// bundled logo.svg so the logo always renders even before the PNG is added.
// Bump this if the logo file changes, to bust stale browser caches.
const LOGO_VERSION = '2';

export default function Logo({ className = 'h-9 w-auto', alt = 'Bachelor Point Logo' }: { className?: string; alt?: string }) {
  const [src, setSrc] = useState(`/logo.png?v=${LOGO_VERSION}`);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (!src.startsWith('/logo.svg')) setSrc(`/logo.svg?v=${LOGO_VERSION}`);
      }}
    />
  );
}
