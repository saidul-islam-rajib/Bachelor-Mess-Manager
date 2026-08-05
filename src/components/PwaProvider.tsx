import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type InstallChoice = { outcome: 'accepted' | 'dismissed' };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type Platform = 'android' | 'ios' | 'desktop' | 'unknown';

type PwaContextValue = {
  installable: boolean;
  installed: boolean;
  platform: Platform;
  needsManualInstall: boolean;
  updateReady: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  applyUpdate: () => void;
  clearCaches: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error('usePwa must be used within a PwaProvider');
  return ctx;
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

function detectInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [updateReady, setUpdateReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(detectInstalled());

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => setInstalled(detectInstalled());
    media.addEventListener('change', onDisplayChange);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      media.removeEventListener('change', onDisplayChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);

      if (typeof caches !== 'undefined') {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined);
      }

      return;
    }

    let cancelled = false;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return;

        if (registration.waiting) {
          setWaiting(registration.waiting);
          setUpdateReady(true);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(installing);
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => undefined);

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    setUpdateReady(false);
  }, [waiting]);

  const clearCaches = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' });
  }, []);

  const value = useMemo(
    () => ({
      installable: deferred !== null,
      installed,
      platform,
      needsManualInstall: platform === 'ios' && !installed,
      updateReady,
      promptInstall,
      applyUpdate,
      clearCaches
    }),
    [deferred, installed, platform, updateReady, promptInstall, applyUpdate, clearCaches]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
