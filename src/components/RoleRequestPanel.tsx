import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Collapsible, Textarea, useConfirm } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { useCurrentUser } from '@/components/UserProvider';
import { api, errorMessage } from '@/lib/api-client';
import { USER_ROLES } from '@/lib/constants';
import { formatDate, roleLabel } from '@/lib/format';
import { strings } from '@/lib/i18n';

type RoleRequest = {
  id: string;
  requestedRole: string;
  status: string;
  reason: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

type Response = {
  requests: RoleRequest[];
  policy: { autoApproveSupervisor: boolean; allowSelfRoleSwitch: boolean };
};

export function RoleRequestPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, refresh } = useCurrentUser();

  const [data, setData] = useState<Response | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<Response>('/api/role-requests', { query: { scope: 'mine' } });
      setData(response);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || user.role === USER_ROLES.ADMIN) return null;

  const pending = data?.requests.find((request) => request.status === 'PENDING') ?? null;
  const isSupervisor = user.role === USER_ROLES.SUPERVISOR;
  const targetRole = isSupervisor ? USER_ROLES.MEMBER : USER_ROLES.SUPERVISOR;

  async function submit() {
    setBusy(true);
    try {
      const result = await api.post<{ autoApproved: boolean; message: string }>('/api/role-requests', {
        requestedRole: targetRole,
        reason
      });
      toast.success(result.message);
      setReason('');
      if (result.autoApproved) await refresh();
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    const confirmed = await confirm({
      title: strings.roleRequests.cancel,
      message: strings.confirm.irreversible,
      destructive: true
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await api.delete(`/api/role-requests/${id}`);
      toast.success(strings.roleRequests.cancelled);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Collapsible
      title={strings.roleRequests.yourRole}
      description={strings.roleRequests.switchNote}
      badge={
        <span className="flex shrink-0 items-center gap-2">
          {pending && <Badge tone="warning">{strings.roleRequests.pendingBadge}</Badge>}
          <Badge tone="info">{roleLabel(user.role)}</Badge>
        </span>
      }
    >
      <div>
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{strings.common.loading}</p>
        ) : pending ? (
          <div className="space-y-3">
            <Alert tone="warning">
              {strings.roleRequests.pending} ({roleLabel(pending.requestedRole)},{' '}
              {strings.roleRequests.requestedOn(formatDate(pending.createdAt))})
            </Alert>
            <Button variant="secondary" size="sm" loading={busy} onClick={() => cancel(pending.id)}>
              {strings.roleRequests.cancel}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!isSupervisor && (
              <Textarea
                label={strings.roleRequests.reasonLabel}
                value={reason}
                onChange={setReason}
                placeholder={strings.roleRequests.reasonPlaceholder}
                rows={2}
                optional
              />
            )}

            <Button loading={busy} onClick={submit}>
              {isSupervisor ? strings.roleRequests.becomeMember : strings.roleRequests.becomeSupervisor}
            </Button>

            {data?.policy.autoApproveSupervisor && !isSupervisor && (
              <p className="text-xs text-green-700 dark:text-green-400">{strings.roleRequests.autoApproveHint}</p>
            )}
          </div>
        )}

        {data && data.requests.filter((request) => request.status !== 'PENDING').length > 0 && (
          <ul className="mt-5 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
            {data.requests
              .filter((request) => request.status !== 'PENDING')
              .slice(0, 4)
              .map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {roleLabel(request.requestedRole)} · {formatDate(request.createdAt)}
                  </span>
                  <Badge tone={request.status === 'APPROVED' ? 'success' : 'neutral'}>{request.status}</Badge>
                </li>
              ))}
          </ul>
        )}
      </div>
    </Collapsible>
  );
}

export default RoleRequestPanel;
