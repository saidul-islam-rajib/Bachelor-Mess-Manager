import { useEffect, useRef, useState, type ReactNode } from 'react';

type RevealState = 'static' | 'hidden' | 'shown';

const BELOW_FOLD_RATIO = 0.85;

export default function Reveal({
  children,
  delayMs = 0,
  className = ''
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>('static');

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (node.getBoundingClientRect().top <= window.innerHeight * BELOW_FOLD_RATIO) return undefined;

    setState('hidden');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setState('shown');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (state === 'static') {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-out ${
        state === 'hidden' ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
      } ${className}`}
    >
      {children}
    </div>
  );
}
