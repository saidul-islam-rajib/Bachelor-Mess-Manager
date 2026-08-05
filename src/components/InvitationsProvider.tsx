import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { strings } from '@/lib/i18n';

export type Invitation = {
  id: string;
  createdAt: string;
  group: { id: string; name: string };
  inviter: { id: string; name: string; email: string };
};

export type InvitationStatus = 'ACCEPTED' | 'REJECTED';

type InvitationsContextValue = {
  invitations: Invitation[];
  count: number;
  loading: boolean;
  busyId: string | null;
  refresh: () => Promise<void>;
  respond: (invitation: Invitation, status: InvitationStatus) => Promise<void>;
};

const POLL_MS = 60_000;

const InvitationsContext = createContext<InvitationsContextValue | null>(null);

export function useInvitations() {
  const ctx = useContext(InvitationsContext);
  if (!ctx) {
    throw new Error('useInvitations must be used within an InvitationsProvider');
  }
  return ctx;
}

export function InvitationsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { user, refresh: refreshUser } = useCurrentUser();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setInvitations([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/invitations');
      const data = await res.json().catch(() => ({}));
      setInvitations(res.ok ? data.invitations ?? [] : []);
    } catch {
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const timer = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refresh]);

  const respond = useCallback(
    async (invitation: Invitation, status: InvitationStatus) => {
      setBusyId(invitation.id);
      try {
        const res = await fetch(`/api/invitations/${invitation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? strings.invitations.updateFailed);

        setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
        toast.success(
          status === 'ACCEPTED'
            ? strings.invitations.joinedGroup(invitation.group.name)
            : strings.invitations.declinedGroup(invitation.group.name)
        );
        refreshUser();
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [toast, refreshUser]
  );

  const value = useMemo(
    () => ({ invitations, count: invitations.length, loading, busyId, refresh, respond }),
    [invitations, loading, busyId, refresh, respond]
  );

  return <InvitationsContext.Provider value={value}>{children}</InvitationsContext.Provider>;
}

export function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
