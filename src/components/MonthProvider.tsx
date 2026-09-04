import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { currentMonthKey, isMonthKey } from '@/lib/month';

const MONTH_STORAGE_KEY = 'bachelor_point_month';

type MonthContextValue = {
  month: string;
  setMonth: (month: string) => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

export function useSelectedMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) {
    throw new Error('useSelectedMonth must be used within a MonthProvider');
  }
  return ctx;
}

function readStoredMonth(): string {
  if (typeof window === 'undefined') return currentMonthKey();
  const stored = window.localStorage.getItem(MONTH_STORAGE_KEY);
  return isMonthKey(stored) ? stored : currentMonthKey();
}

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonthState] = useState<string>(() => readStoredMonth());

  const setMonth = useCallback((next: string) => {
    setMonthState(next);
    window.localStorage.setItem(MONTH_STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ month, setMonth }), [month, setMonth]);

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export default MonthProvider;
