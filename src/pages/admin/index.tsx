import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/components/UserProvider';
import { useToast } from '@/components/ToastProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  EmptyState,
  FilterBar,
  Input,
  LoadingCard,
  Modal,
  NumberInput,
  PageContainer,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  StatGrid,
  StatusBadge,
  useConfirm,
  useDebouncedValue,
  type Column,
  type SelectOption
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api-client';
import { paginationConfig } from '@/config';
import {
  ASSIGNABLE_ROLES,
  GROUP_STATUS_VALUES,
  USER_ROLES,
  USER_ROLE_VALUES,
  USER_STATUS,
  USER_STATUS_VALUES
} from '@/lib/constants';
import { formatDate, formatDateTime, roleLabel, statusLabel } from '@/lib/format';
import { strings } from '@/lib/i18n';
import type { PageMeta } from '@/lib/query';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  groups: { id: string; name: string; supervisor: { id: string; name: string } }[];
  supervisedGroups: { id: string; name: string }[];
};

type Lookups = {
  supervisors: { id: string; name: string; email: string; groupCount: number }[];
  groups: { id: string; name: string; status: string; supervisorId: string }[];
  roles: { code: string; name: string; rank: number }[];
};

type UsersResponse = {
  users: AdminUser[];
  meta: PageMeta;
  facets: { roles: Record<string, number>; statuses: Record<string, number> };
};

type AdminGroup = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  createdAt: string;
  supervisor: { id: string; name: string; email: string };
};

type SecurityPolicy = {
  maxLoginAttempts: number;
  loginLockoutMinutes: number;
  maxLoginAttemptsPerIp: number;
  ipLockoutMinutes: number;
  maxRegistrationsPerIp: number;
  registrationWindowMinutes: number;
  requireStrongPasswords: boolean;
};

type SecurityResponse = {
  policy: SecurityPolicy;
  lockedAccounts: { email: string; failedAttempts: number; lastAttemptAt: string | null }[];
  recentFailures: { id: string; email: string; ipAddress: string; reason: string | null; createdAt: string }[];
};

const TABS = [
  { key: 'registrations', label: strings.admin.tabs.registrations },
  { key: 'users', label: strings.admin.tabs.users },
  { key: 'groups', label: strings.admin.tabs.groups },
  { key: 'security', label: strings.admin.tabs.security },
  { key: 'settings', label: strings.admin.tabs.settings }
] as const;

type TabKey = (typeof TABS)[number]['key'];

const ALL_OPTION = '';

function toOptions(values: string[], labeller: (value: string) => string): SelectOption[] {
  return values.map((value) => ({ value, label: labeller(value) }));
}

function useLookups() {
  const [lookups, setLookups] = useState<Lookups>({ supervisors: [], groups: [], roles: [] });

  useEffect(() => {
    let cancelled = false;
    api
      .get<Lookups>('/api/admin/lookups')
      .then((data) => {
        if (!cancelled) setLookups(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return lookups;
}

export default function AdminPage() {
  const { user, loading } = useCurrentUser();
  const [tab, setTab] = useState<TabKey>('registrations');

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title={strings.admin.title} description={strings.admin.subtitle} />
        <LoadingCard />
      </PageContainer>
    );
  }

  if (user?.role !== USER_ROLES.ADMIN) {
    return (
      <PageContainer>
        <PageHeader title={strings.admin.title} />
        <Alert tone="warning">{strings.admin.accessDenied}</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={strings.admin.title} description={strings.admin.subtitle} />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item.key}
            variant={tab === item.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === 'registrations' && <RegistrationsPanel />}
      {tab === 'users' && <UsersPanel />}
      {tab === 'groups' && <GroupsPanel />}
      {tab === 'security' && <SecurityPanel />}
      {tab === 'settings' && <SettingsPanel />}
    </PageContainer>
  );
}

function RegistrationsPanel() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<UsersResponse>('/api/users', {
        query: { status: USER_STATUS.PENDING, page, pageSize: paginationConfig.pageSize, sortBy: 'createdAt', sortDir: 'asc' }
      });
      setUsers(data.users);
      setMeta(data.meta);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.admin.tabs.registrations)));
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(target: AdminUser, status: string) {
    setBusy(target.id);
    try {
      await api.patch(`/api/users/${target.id}`, { status });
      toast.success(
        status === USER_STATUS.APPROVED
          ? strings.admin.registrations.approved(target.name)
          : strings.admin.registrations.rejected(target.name)
      );
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: strings.common.name,
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      )
    },
    { key: 'phone', header: strings.common.phone, render: (row) => row.phone ?? '—' },
    { key: 'createdAt', header: strings.admin.users.joined, render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: strings.common.actions,
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" loading={busy === row.id} onClick={() => decide(row, USER_STATUS.APPROVED)}>
            {strings.admin.registrations.approve}
          </Button>
          <Button size="sm" variant="danger" loading={busy === row.id} onClick={() => decide(row, USER_STATUS.REJECTED)}>
            {strings.admin.registrations.reject}
          </Button>
        </div>
      )
    }
  ];

  return (
    <Card>
      <CardHeader title={strings.admin.registrations.title} />
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle={strings.admin.registrations.empty}
          emptyDescription=""
        />
        {meta && <Pagination meta={meta} onPageChange={setPage} disabled={loading} />}
      </div>
    </Card>
  );
}

function UsersPanel() {
  const toast = useToast();
  const lookups = useLookups();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [role, setRole] = useState(ALL_OPTION);
  const [status, setStatus] = useState(ALL_OPTION);
  const [groupId, setGroupId] = useState(ALL_OPTION);
  const [supervisorId, setSupervisorId] = useState(ALL_OPTION);
  const [onlyWithoutGroup, setOnlyWithoutGroup] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(paginationConfig.pageSize);

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, role, status, groupId, supervisorId, onlyWithoutGroup, sortBy, sortDir, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<UsersResponse>('/api/users', {
        query: {
          search,
          role,
          status,
          groupId,
          supervisorId,
          hasGroup: onlyWithoutGroup ? 'false' : undefined,
          sortBy,
          sortDir,
          page,
          pageSize
        }
      });
      setData(response);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.admin.tabs.users)));
    } finally {
      setLoading(false);
    }
  }, [search, role, status, groupId, supervisorId, onlyWithoutGroup, sortBy, sortDir, page, pageSize, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const activeFilters = [search, role, status, groupId, supervisorId].filter(Boolean).length + (onlyWithoutGroup ? 1 : 0);

  function clearFilters() {
    setSearchInput('');
    setRole(ALL_OPTION);
    setStatus(ALL_OPTION);
    setGroupId(ALL_OPTION);
    setSupervisorId(ALL_OPTION);
    setOnlyWithoutGroup(false);
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: strings.common.name,
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      )
    },
    { key: 'role', header: strings.common.role, render: (row) => <Badge>{roleLabel(row.role)}</Badge> },
    { key: 'status', header: strings.common.status, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'groups',
      header: strings.admin.users.groups,
      render: (row) => {
        if (row.role === USER_ROLES.SUPERVISOR) {
          return row.supervisedGroups.length > 0 ? (
            <span className="text-xs text-slate-600">
              {row.supervisedGroups.map((group) => group.name).join(', ')}
            </span>
          ) : (
            <span className="text-xs text-slate-400">{strings.admin.users.noGroup}</span>
          );
        }
        return row.groups.length > 0 ? (
          <div className="text-xs text-slate-600">
            {row.groups.map((group) => (
              <p key={group.id}>
                {group.name}
                <span className="text-slate-400"> · {group.supervisor.name}</span>
              </p>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">{strings.admin.users.noGroup}</span>
        );
      }
    },
    {
      key: 'lastLoginAt',
      header: strings.admin.users.lastLogin,
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : strings.admin.users.never}
        </span>
      )
    },
    {
      key: 'actions',
      header: strings.common.actions,
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>
          {strings.common.edit}
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {data && (
        <StatGrid columns={4}>
          <StatCard label={strings.common.all} value={data.meta.total} />
          <StatCard label={roleLabel(USER_ROLES.SUPERVISOR)} value={data.facets.roles[USER_ROLES.SUPERVISOR] ?? 0} />
          <StatCard label={roleLabel(USER_ROLES.MEMBER)} value={data.facets.roles[USER_ROLES.MEMBER] ?? 0} />
          <StatCard
            label={statusLabel(USER_STATUS.PENDING)}
            value={data.facets.statuses[USER_STATUS.PENDING] ?? 0}
            tone={(data.facets.statuses[USER_STATUS.PENDING] ?? 0) > 0 ? 'amber' : undefined}
          />
        </StatGrid>
      )}

      <FilterBar onClear={clearFilters} activeCount={activeFilters}>
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={strings.admin.users.searchPlaceholder}
          className="min-w-[16rem] flex-1"
        />
        <Select
          compact
          label={strings.admin.users.filterRole}
          value={role}
          onChange={setRole}
          placeholder={strings.common.all}
          options={toOptions(USER_ROLE_VALUES, roleLabel)}
          containerClassName="min-w-[10rem]"
        />
        <Select
          compact
          label={strings.admin.users.filterStatus}
          value={status}
          onChange={setStatus}
          placeholder={strings.common.all}
          options={toOptions(USER_STATUS_VALUES, statusLabel)}
          containerClassName="min-w-[10rem]"
        />
        <Select
          compact
          label={strings.admin.users.filterSupervisor}
          value={supervisorId}
          onChange={setSupervisorId}
          placeholder={strings.common.all}
          options={lookups.supervisors.map((supervisor) => ({
            value: supervisor.id,
            label: `${supervisor.name} (${supervisor.groupCount})`
          }))}
          containerClassName="min-w-[12rem]"
        />
        <Select
          compact
          label={strings.admin.users.filterGroup}
          value={groupId}
          onChange={setGroupId}
          placeholder={strings.common.all}
          options={lookups.groups.map((group) => ({ value: group.id, label: group.name }))}
          containerClassName="min-w-[12rem]"
        />
        <Select
          compact
          label={strings.admin.users.sortBy}
          value={`${sortBy}:${sortDir}`}
          onChange={(value) => {
            const [field, direction] = value.split(':');
            setSortBy(field);
            setSortDir(direction);
          }}
          options={[
            { value: 'createdAt:desc', label: strings.admin.users.newestFirst },
            { value: 'createdAt:asc', label: strings.admin.users.oldestFirst },
            { value: 'name:asc', label: strings.admin.users.nameAsc },
            { value: 'name:desc', label: strings.admin.users.nameDesc },
            { value: 'lastLoginAt:desc', label: strings.admin.users.lastLogin }
          ]}
          containerClassName="min-w-[11rem]"
        />
        <Checkbox
          label={strings.admin.users.noGroup}
          checked={onlyWithoutGroup}
          onChange={setOnlyWithoutGroup}
          className="pb-1"
        />
      </FilterBar>

      <Card>
        <DataTable columns={columns} rows={data?.users ?? []} rowKey={(row) => row.id} loading={loading} />
        {data && (
          <Pagination meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading} />
        )}
      </Card>

      <EditUserModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(USER_ROLES.MEMBER as string);
  const [status, setStatus] = useState(USER_STATUS.APPROVED as string);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? '');
    setRole(user.role);
    setStatus(user.status);
  }, [user]);

  if (!user) return null;

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await api.patch(`/api/users/${user.id}`, { name, email, phone, role, status });
      toast.success(strings.admin.users.updated(name));
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const isAdminAccount = user.role === USER_ROLES.ADMIN;

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={strings.common.edit}
      description={user.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {strings.common.cancel}
          </Button>
          <Button onClick={save} loading={saving}>
            {strings.common.saveChanges}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={strings.common.name} value={name} onChange={setName} />
        <Input label={strings.common.email} type="email" value={email} onChange={setEmail} />
        <Input label={strings.common.phone} type="tel" value={phone} onChange={setPhone} optional required={false} />

        {isAdminAccount ? (
          <Alert tone="warning">{strings.admin.users.roleChangeBlocked}</Alert>
        ) : (
          <>
            <Select
              label={strings.common.role}
              value={role}
              onChange={setRole}
              options={toOptions(ASSIGNABLE_ROLES, roleLabel)}
            />
            <Select
              label={strings.common.status}
              value={status}
              onChange={setStatus}
              options={toOptions(USER_STATUS_VALUES, statusLabel)}
            />
          </>
        )}
      </div>
    </Modal>
  );
}

function GroupsPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const lookups = useLookups();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [supervisorId, setSupervisorId] = useState(ALL_OPTION);
  const [status, setStatus] = useState(ALL_OPTION);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(paginationConfig.pageSize);

  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSupervisor, setNewGroupSupervisor] = useState('');
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<AdminGroup | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, supervisorId, status, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ groups: AdminGroup[]; meta: PageMeta }>('/api/groups', {
        query: { search, supervisorId, status, page, pageSize, paginated: 'true' }
      });
      setGroups(response.groups);
      setMeta(response.meta);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.admin.tabs.groups)));
    } finally {
      setLoading(false);
    }
  }, [search, supervisorId, status, page, pageSize, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createGroup() {
    setCreating(true);
    try {
      await api.post('/api/groups', { name: newGroupName, supervisorEmail: newGroupSupervisor });
      toast.success(strings.success.created(strings.common.group));
      setNewGroupName('');
      setNewGroupSupervisor('');
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  const activeFilters = [search, supervisorId, status].filter(Boolean).length;

  const columns: Column<AdminGroup>[] = [
    {
      key: 'name',
      header: strings.common.group,
      render: (row) => (
        <Link href={`/groups/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
      )
    },
    {
      key: 'supervisor',
      header: strings.common.supervisor,
      render: (row) => (
        <div>
          <p className="text-sm">{row.supervisor.name}</p>
          <p className="text-xs text-slate-500">{row.supervisor.email}</p>
        </div>
      )
    },
    { key: 'members', header: strings.common.members, align: 'right', render: (row) => row.memberCount },
    { key: 'status', header: strings.common.status, render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: strings.common.date, render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: strings.common.actions,
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setManaging(row)}>
          {strings.admin.groups.manageMembers}
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={strings.admin.groups.createForSupervisor} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input
            label={strings.common.name}
            value={newGroupName}
            onChange={setNewGroupName}
            placeholder={strings.groups.namePlaceholder}
          />
          <Select
            label={strings.admin.groups.supervisorEmail}
            value={newGroupSupervisor}
            onChange={setNewGroupSupervisor}
            placeholder={strings.common.none}
            options={lookups.supervisors.map((supervisor) => ({
              value: supervisor.email,
              label: `${supervisor.name} · ${supervisor.email}`
            }))}
          />
          <div className="flex items-end">
            <Button
              onClick={createGroup}
              loading={creating}
              disabled={!newGroupName.trim() || !newGroupSupervisor}
              fullWidth
            >
              {strings.common.create}
            </Button>
          </div>
        </div>
      </Card>

      <FilterBar
        onClear={() => {
          setSearchInput('');
          setSupervisorId(ALL_OPTION);
          setStatus(ALL_OPTION);
        }}
        activeCount={activeFilters}
      >
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={strings.admin.groups.searchPlaceholder}
          className="min-w-[16rem] flex-1"
        />
        <Select
          compact
          label={strings.admin.groups.filterSupervisor}
          value={supervisorId}
          onChange={setSupervisorId}
          placeholder={strings.common.all}
          options={lookups.supervisors.map((supervisor) => ({
            value: supervisor.id,
            label: `${supervisor.name} (${supervisor.groupCount})`
          }))}
          containerClassName="min-w-[12rem]"
        />
        <Select
          compact
          label={strings.admin.groups.filterStatus}
          value={status}
          onChange={setStatus}
          placeholder={strings.common.all}
          options={toOptions(GROUP_STATUS_VALUES, statusLabel)}
          containerClassName="min-w-[10rem]"
        />
      </FilterBar>

      <Card>
        <DataTable columns={columns} rows={groups} rowKey={(row) => row.id} loading={loading} />
        {meta && <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading} />}
      </Card>

      <GroupMembersModal
        group={managing}
        onClose={() => setManaging(null)}
        onChanged={load}
        confirm={confirm}
      />
    </div>
  );
}

function GroupMembersModal({
  group,
  onClose,
  onChanged,
  confirm
}: {
  group: AdminGroup | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<
    { id: string; name: string; email: string; isActive: boolean; isSupervisor: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    try {
      const data = await api.get<{ members: typeof members }>(`/api/groups/${group.id}/members`);
      setMembers(data.members);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.common.members)));
    } finally {
      setLoading(false);
    }
  }, [group, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!group) return null;

  async function add() {
    if (!group) return;
    setBusy('add');
    try {
      const result = await api.post<{ member: { name: string } }>(`/api/groups/${group.id}/members`, { email });
      toast.success(strings.admin.groups.added(result.member.name));
      setEmail('');
      await load();
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  }

  async function remove(member: { id: string; name: string }) {
    if (!group) return;
    const confirmed = await confirm({
      title: strings.confirm.deleteTitle(member.name),
      message: strings.confirm.irreversible,
      destructive: true,
      confirmLabel: strings.common.remove
    });
    if (!confirmed) return;

    setBusy(member.id);
    try {
      await api.delete(`/api/groups/${group.id}/members`, { userId: member.id });
      toast.success(strings.admin.groups.removed(member.name));
      await load();
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  }

  const active = members.filter((member) => member.isActive);

  return (
    <Modal open={Boolean(group)} onClose={onClose} title={group.name} description={group.supervisor.name} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label={strings.admin.groups.memberEmail}
            type="email"
            value={email}
            onChange={setEmail}
            containerClassName="flex-1 min-w-[14rem]"
          />
          <Button onClick={add} loading={busy === 'add'} disabled={!email.trim()}>
            {strings.admin.groups.addMember}
          </Button>
        </div>

        {loading ? (
          <LoadingCard />
        ) : active.length === 0 ? (
          <EmptyState title={strings.emptyState.noMembers} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    {member.isSupervisor && (
                      <Badge tone="info" className="ml-2">
                        {strings.common.supervisor}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                </div>
                {!member.isSupervisor && (
                  <Button size="sm" variant="danger" loading={busy === member.id} onClick={() => remove(member)}>
                    {strings.common.remove}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function SecurityPanel() {
  const toast = useToast();
  const [data, setData] = useState<SecurityResponse | null>(null);
  const [form, setForm] = useState<SecurityPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<SecurityResponse>('/api/admin/security');
      setData(response);
      setForm(response.policy);
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(strings.admin.tabs.security)));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.patch('/api/admin/security', form);
      toast.success(strings.success.saved);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function unlock(email: string) {
    setBusy(email);
    try {
      await api.delete('/api/admin/security', { email });
      toast.success(strings.admin.security.unlocked(email));
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  }

  function update(key: keyof SecurityPolicy, value: number | boolean) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  if (loading || !form || !data) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={strings.admin.security.title} description={strings.admin.security.subtitle} />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <NumberInput
            label={strings.admin.security.maxLoginAttempts}
            value={String(form.maxLoginAttempts)}
            onChange={(value) => update('maxLoginAttempts', Number(value))}
            hint={strings.admin.security.maxLoginAttemptsHint}
            min={1}
            max={100}
          />
          <NumberInput
            label={strings.admin.security.loginLockoutMinutes}
            value={String(form.loginLockoutMinutes)}
            onChange={(value) => update('loginLockoutMinutes', Number(value))}
            min={1}
            max={1440}
          />
          <NumberInput
            label={strings.admin.security.maxLoginAttemptsPerIp}
            value={String(form.maxLoginAttemptsPerIp)}
            onChange={(value) => update('maxLoginAttemptsPerIp', Number(value))}
            min={1}
            max={1000}
          />
          <NumberInput
            label={strings.admin.security.ipLockoutMinutes}
            value={String(form.ipLockoutMinutes)}
            onChange={(value) => update('ipLockoutMinutes', Number(value))}
            min={1}
            max={1440}
          />
          <NumberInput
            label={strings.admin.security.maxRegistrationsPerIp}
            value={String(form.maxRegistrationsPerIp)}
            onChange={(value) => update('maxRegistrationsPerIp', Number(value))}
            min={1}
            max={1000}
          />
          <NumberInput
            label={strings.admin.security.registrationWindowMinutes}
            value={String(form.registrationWindowMinutes)}
            onChange={(value) => update('registrationWindowMinutes', Number(value))}
            min={1}
            max={1440}
          />
        </div>

        <Checkbox
          className="mt-4"
          label={strings.admin.security.requireStrongPasswords}
          hint={strings.admin.security.requireStrongPasswordsHint}
          checked={form.requireStrongPasswords}
          onChange={(checked) => update('requireStrongPasswords', checked)}
        />

        <div className="mt-5">
          <Button onClick={save} loading={saving}>
            {strings.common.saveChanges}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={strings.admin.security.lockedAccounts} />
        <div className="mt-4">
          {data.lockedAccounts.length === 0 ? (
            <EmptyState title={strings.admin.security.noLockedAccounts} description="" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.lockedAccounts.map((account) => (
                <li key={account.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.email}</p>
                    <p className="text-xs text-slate-500">
                      {account.failedAttempts} · {account.lastAttemptAt ? formatDateTime(account.lastAttemptAt) : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" loading={busy === account.email} onClick={() => unlock(account.email)}>
                    {strings.admin.security.unlock}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={strings.admin.security.recentFailures} />
        <div className="mt-4">
          {data.recentFailures.length === 0 ? (
            <EmptyState title={strings.admin.security.noRecentFailures} description="" />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.recentFailures.map((failure) => (
                <li key={failure.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="truncate">{failure.email}</span>
                  <span className="text-xs text-slate-500">
                    {failure.ipAddress} · {failure.reason ?? ''} · {formatDateTime(failure.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

type SiteSettings = {
  companyName: string;
  tagline: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  copyrightOwner: string;
  facebookUrl: string | null;
  twitterUrl: string | null;
  newsletterEnabled: boolean;
};

function SettingsPanel() {
  const toast = useToast();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ settings: SiteSettings }>('/api/settings')
      .then((data) => setSettings(data.settings))
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [toast]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await api.patch('/api/settings', settings);
      toast.success(strings.admin.settings.saved);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function update(key: keyof SiteSettings, value: string | boolean) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  if (loading || !settings) return <LoadingCard />;

  const fields: { key: keyof SiteSettings; label: string; type?: 'text' | 'email' | 'tel' }[] = [
    { key: 'companyName', label: strings.admin.settings.companyName },
    { key: 'tagline', label: strings.admin.settings.tagline },
    { key: 'address', label: strings.admin.settings.address },
    { key: 'contactEmail', label: strings.admin.settings.contactEmail, type: 'email' },
    { key: 'contactPhone', label: strings.admin.settings.contactPhone, type: 'tel' },
    { key: 'copyrightOwner', label: strings.admin.settings.copyrightOwner },
    { key: 'facebookUrl', label: strings.admin.settings.facebookUrl },
    { key: 'twitterUrl', label: strings.admin.settings.twitterUrl }
  ];

  return (
    <Card>
      <CardHeader title={strings.admin.settings.title} />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            type={field.type ?? 'text'}
            value={String(settings[field.key] ?? '')}
            onChange={(value) => update(field.key, value)}
            required={false}
          />
        ))}
      </div>

      <Checkbox
        className="mt-4"
        label={strings.admin.settings.newsletterEnabled}
        checked={settings.newsletterEnabled}
        onChange={(checked) => update('newsletterEnabled', checked)}
      />

      <div className="mt-5">
        <Button onClick={save} loading={saving}>
          {strings.common.saveChanges}
        </Button>
      </div>
    </Card>
  );
}
