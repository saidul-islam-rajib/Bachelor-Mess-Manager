import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/components/UserProvider';

const BEAT_MS = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'focus'] as const;

export default function PresenceTracker() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const active = useRef(false);
  const sending = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const markActive = () => {
      active.current = true;
    };

    const beat = async () => {
      if (!active.current || sending.current) return;
      if (document.visibilityState !== 'visible') return;

      active.current = false;
      sending.current = true;
      try {
        await fetch('/api/auth/heartbeat', { method: 'POST', keepalive: true });
      } catch {
        active.current = true;
      } finally {
        sending.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        active.current = true;
        beat();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisible);

    const timer = window.setInterval(beat, BEAT_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [userId]);

  return null;
}
