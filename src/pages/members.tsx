import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import { useGroupMonth } from '@/components/GroupMonthControls';
import { Collapsible, Listbox, PageTitle, useConfirm } from '@/components/ui';
import InviteMembers from '@/components/members/InviteMembers';
import GroupSettings from '@/components/members/GroupSettings';
import MessComments from '@/components/members/MessComments';
import YourGroups from '@/components/members/YourGroups';
import { GROUP_STATUS, USER_ROLES } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { MESS_COMMENTS_ANCHOR } from '@/lib/routes';

type Member = {
  membershipId: string;
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  isActive: boolean;
  isSupervisor: boolean;
  joinedAt: string;
  leftAt: string | null;
  stayDays: number;
};

type RosterData = { canManage: boolean; members: Member[] };

type Tab = 'roster' | 'invites' | 'settings' | 'groups';

const COMMENTS_ANCHOR = MESS_COMMENTS_ANCHOR;

function formatStay(days: number) {
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} year${years === 1 ? '' : 's'}` : `${years}y ${rest}m`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MembersPage() {
  const { user, refresh: refreshUser } = useCurrentUser();
  const toast = useToast();
  const confirm = useConfirm();

  const [showClosed, setShowClosed] = useState(false);
  const { groups, groupId, setGroupId, loadingGroups, limits, hiddenInactive, reloadGroups } = useGroupMonth({
    includeInactive: showClosed
  });

  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<Tab>('roster');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentsSection = useRef<HTMLDivElement>(null);

  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groups, groupId]);

  const load = useCallback(async () => {
    if (!groupId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.members.loadFailed);
      setData(body);
    } catch (err) {
      toast.error((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = data?.canManage ?? false;
  const canCreateGroup = user?.role === USER_ROLES.SUPERVISOR;
  const showGroupsTab = canCreateGroup || groups.length > 1;

  const refreshGroups = useCallback(() => reloadGroups({ fresh: true }), [reloadGroups]);

  const handleGroupChanged = useCallback(async () => {
    if (showClosed) {
      await refreshGroups();
      return;
    }
    setShowClosed(true);
  }, [showClosed, refreshGroups]);

  useEffect(() => {
    if (tab === 'settings' && !canManage) setTab('roster');
    if (tab === 'invites' && !canManage) setTab('roster');
    if (tab === 'groups' && !showGroupsTab) setTab('roster');
  }, [tab, canManage, showGroupsTab]);

  useEffect(() => {
    if (window.location.hash !== `#${COMMENTS_ANCHOR}`) return;
    setCommentsOpen(true);
  }, []);

  useEffect(() => {
    if (!commentsOpen || !groupId) return;
    if (window.location.hash !== `#${COMMENTS_ANCHOR}`) return;
    commentsSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [commentsOpen, groupId]);

  async function setActive(member: Member, isActive: boolean) {
    setBusy(member.id);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, isActive })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.members.updateFailed);
      toast.success(
        isActive ? strings.members.reactivated(member.name) : strings.members.deactivated(member.name)
      );
      await load();
      await refreshGroups();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function makeSupervisor(member: Member) {
    const accepted = await confirm({
      title: strings.groups.handoverConfirm(member.name),
      message: strings.groups.handoverMessage,
      confirmLabel: strings.groups.handover
    });
    if (!accepted) return;

    setBusy(member.id);
    try {
      const res = await fetch(`/api/groups/${groupId}/supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.groups.handoverFailed);
      toast.success(strings.groups.handoverDone(member.name));
      await Promise.all([load(), refreshGroups(), refreshUser()]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function leave() {
    const accepted = await confirm({
      title: strings.members.leaveConfirm(selectedGroup?.name ?? ''),
      confirmLabel: strings.members.leaveGroup,
      destructive: true
    });
    if (!accepted) return;

    setBusy(user?.id ?? '');
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? strings.members.leaveFailed);
      toast.success(strings.members.leftGroup);

      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy('');
    }
  }

  const active = data?.members.filter((member) => member.isActive) ?? [];
  const past = data?.members.filter((member) => !member.isActive) ?? [];
  const me = data?.members.find((member) => member.id === user?.id && member.isActive);
  const canLeave = Boolean(me && !me.isSupervisor);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'roster', label: strings.members.tabs.roster },
    ...(canManage ? [{ id: 'invites' as Tab, label: strings.members.tabs.invites }] : []),
    ...(canManage ? [{ id: 'settings' as Tab, label: strings.members.tabs.settings }] : []),
    ...(showGroupsTab ? [{ id: 'groups' as Tab, label: strings.members.tabs.groups }] : [])
  ];

  return (
    <section className="mx-auto max-w-content px-4 py-8 sm:py-10">
      <PageTitle title={strings.members.title} description={strings.members.subtitle} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{strings.members.title}</h1>
        <p className="mt-1 text-slate-600">{strings.members.subtitle}</p>
      </div>

      {loadingGroups && groups.length === 0 ? (
        <Card>{strings.common.loading}</Card>
      ) : groups.length === 0 ? (
        <div className="space-y-6">
          <Card>{strings.members.noGroups}</Card>
          {canCreateGroup && (
            <YourGroups
              groups={groups}
              limits={limits}
              canCreate={canCreateGroup}
              selectedId={groupId}
              onSelect={setGroupId}
              onChanged={refreshGroups}
            />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <Listbox
                className="min-w-0 flex-1"
                label={strings.members.groupLabel}
                value={groupId}
                onChange={setGroupId}
                options={groups.map((group) => ({
                  value: group.id,
                  label:
                    group.status === GROUP_STATUS.ACTIVE
                      ? group.name
                      : `${group.name} (${strings.groups.inactive})`
                }))}
              />

              {(showClosed || hiddenInactive > 0) && (
                <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showClosed}
                    onChange={(event) => setShowClosed(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {strings.members.showClosed}
                  {!showClosed && hiddenInactive > 0 ? ` (${hiddenInactive})` : ''}
                </label>
              )}
            </div>

            {selectedGroup && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    selectedGroup.status === GROUP_STATUS.ACTIVE
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {selectedGroup.status}
                </span>
                <span className="min-w-0 truncate">
                  {strings.members.supervisedBy(selectedGroup.supervisor.name, selectedGroup.supervisor.email)}
                </span>
              </div>
            )}
          </Card>

          {tabs.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm sm:w-fit">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-pressed={tab === item.id}
                  className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                    tab === item.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {tab === 'roster' &&
            (loading || !data ? (
              <Card>{strings.common.loading}</Card>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  <Stat label={strings.members.activeCount} value={String(active.length)} />
                  <Stat label={strings.members.pastCount} value={String(past.length)} />
                  <Stat
                    label={strings.members.longestStay}
                    value={active.length > 0 ? formatStay(Math.max(...active.map((m) => m.stayDays))) : '—'}
                  />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold">{strings.members.current}</h2>
                    {canLeave && (
                      <button
                        type="button"
                        onClick={leave}
                        disabled={busy === user?.id}
                        className="inline-flex min-h-[2rem] items-center rounded-full border border-red-200 px-4 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {strings.members.leaveGroup}
                      </button>
                    )}
                  </div>

                  <ul className="mt-4 divide-y divide-slate-100">
                    {active.map((member) => (
                      <li
                        key={member.membershipId}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar member={member} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {member.name}
                              {member.id === user?.id && <span className="ml-1 text-xs text-green-600">(you)</span>}
                              {member.isSupervisor && (
                                <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-normal text-white">
                                  supervisor
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {member.email}
                              {member.phone && ` · ${member.phone}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatStay(member.stayDays)}</p>
                            <p className="text-xs text-slate-500">
                              {strings.members.since(shortDate(member.joinedAt))}
                            </p>
                          </div>
                          {canManage && !member.isSupervisor && (
                            <>
                              <button
                                type="button"
                                onClick={() => makeSupervisor(member)}
                                disabled={busy === member.id}
                                className="rounded-full border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                              >
                                {strings.groups.handover}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActive(member, false)}
                                disabled={busy === member.id}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {strings.common.remove}
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {past.length > 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-lg font-semibold">{strings.members.past}</h2>
                    <p className="mt-1 text-sm text-slate-500">{strings.members.pastHint}</p>
                    <ul className="mt-4 divide-y divide-slate-100">
                      {past.map((member) => (
                        <li
                          key={member.membershipId}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar member={member} muted />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-600">{member.name}</p>
                              <p className="truncate text-xs text-slate-500">
                                {member.leftAt
                                  ? strings.members.left(shortDate(member.leftAt))
                                  : strings.members.noLongerActive}{' '}
                                · {strings.members.stay(formatStay(member.stayDays))}
                              </p>
                            </div>
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setActive(member, true)}
                              disabled={busy === member.id}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {strings.members.addBack}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

          {tab === 'invites' && canManage && <InviteMembers groupId={groupId} />}

          {tab === 'settings' && canManage && <GroupSettings groupId={groupId} onChanged={handleGroupChanged} />}

          {tab === 'groups' && showGroupsTab && (
            <YourGroups
              groups={groups}
              limits={limits}
              canCreate={canCreateGroup}
              selectedId={groupId}
              onSelect={setGroupId}
              onChanged={refreshGroups}
            />
          )}

          {groupId && (
            <div ref={commentsSection}>
              <Collapsible
                id={COMMENTS_ANCHOR}
                className="scroll-mt-24"
                title={strings.comments.title}
                description={strings.comments.sectionDescription}
                open={commentsOpen}
                onOpenChange={setCommentsOpen}
              >
                <MessComments key={groupId} groupId={groupId} />
              </Collapsible>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Avatar({ member, muted = false }: { member: Member; muted?: boolean }) {
  if (member.profileImage) {

    return (
      <img
        src={member.profileImage}
        alt=""
        className={`h-10 w-10 rounded-full object-cover ${muted ? 'opacity-60' : ''}`}
      />
    );
  }
  const initials = member.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
        muted ? 'bg-slate-100 text-slate-400' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {initials || '?'}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold sm:text-2xl">{value}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</div>;
}
