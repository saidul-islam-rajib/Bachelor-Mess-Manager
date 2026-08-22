import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useTheme } from '@/components/ThemeProvider';
import { THEME_OPTION_VALUES } from '@/lib/constants';

export default function ThemeSync() {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const syncedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || syncedForUserId.current === user.id) return;
    syncedForUserId.current = user.id;

    if (user.theme && THEME_OPTION_VALUES.includes(user.theme) && user.theme !== theme) {
      setTheme(user.theme as typeof theme);
    }
  }, [user, theme, setTheme]);

  return null;
}
