import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { strings } from '@/lib/i18n';

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; type: ToastType; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300',
  error: 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300',
  info: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
};

let counter = 0;

const DEDUPE_WINDOW_MS = 1000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastPush = useRef<{ key: string; at: number }>({ key: '', at: 0 });

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const key = `${type}|${message}`;
      const now = Date.now();
      if (lastPush.current.key === key && now - lastPush.current.at < DEDUPE_WINDOW_MS) return;
      lastPush.current = { key, at: now };

      const id = ++counter;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col gap-2 px-4 pt-4 sm:inset-x-auto sm:left-auto sm:right-4 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg ${TYPE_STYLES[toast.type]}`}
          >
            <span className="text-sm">{toast.message}</span>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              aria-label={strings.common.dismiss}
              className="-mr-1 rounded text-lg leading-none opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
