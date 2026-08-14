import { useEffect, type RefObject } from 'react';

export function useInfiniteScroll({
  target,
  onIntersect,
  enabled,
  rootMargin = '200px'
}: {
  target: RefObject<Element>;
  onIntersect: () => void;
  enabled: boolean;
  rootMargin?: string;
}) {
  useEffect(() => {
    if (!enabled) return;

    const node = target.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [target, onIntersect, enabled, rootMargin]);
}
