import { useEffect, useState } from 'react';
import { TOLET_POST_LAYOUTS, TOLET_POST_LAYOUT_VALUES } from '@/lib/constants';

let cachedLayout: string | null = null;
let inflight: Promise<string> | null = null;

async function fetchLayout(): Promise<string> {
  if (cachedLayout) return cachedLayout;
  if (!inflight) {
    inflight = fetch('/api/settings')
      .then((res) => res.json())
      .then((body) => {
        const value = body?.settings?.toLetPostLayout;
        const resolved = typeof value === 'string' && TOLET_POST_LAYOUT_VALUES.includes(value) ? value : TOLET_POST_LAYOUTS.SIGNBOARD;
        cachedLayout = resolved;
        return resolved;
      })
      .catch(() => TOLET_POST_LAYOUTS.SIGNBOARD)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useToLetPostLayout(): string {
  const [layout, setLayout] = useState(cachedLayout ?? TOLET_POST_LAYOUTS.SIGNBOARD);

  useEffect(() => {
    let cancelled = false;
    fetchLayout().then((value) => {
      if (!cancelled) setLayout(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return layout;
}
