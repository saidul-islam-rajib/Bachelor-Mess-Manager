import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { MembersScreen } from './MembersScreen';
import { en, t } from '@/core/i18n/en';

jest.mock('@/core/storage', () => {
  const mem = new Map<string, string>([
    ['auth.token', 'tok'],
    ['auth.user', JSON.stringify({ id: 'u1', name: 'Rafi', email: 'r@x.com', role: 'MEMBER' })],
  ]);
  return {
    STORAGE_KEYS: { token: 'auth.token', apiUrl: 'server.url' },
    storage: {
      get: async (k: string) => mem.get(k) ?? null,
      set: async (k: string, v: string) => void mem.set(k, v),
      remove: async (k: string) => void mem.delete(k),
    },
  };
});

const ok = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, headers: { get: () => null }, json: async () => body } as unknown as Response);

const mem = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  membershipId: `m${id}`, id, name, email: `${id}@x.com`, phone: null, profileImage: null, isActive: true,
  isSupervisor: false, isCoSupervisor: false, joinedAt: '2026-01-01T00:00:00Z', leftAt: null, stayDays: 30, ...extra,
});
const info = { supervisors: [], maxSupervisors: 2, siteMaxSupervisors: 2, overriddenByGroup: false, canAddMore: true };
const members = (canManage: boolean, mainId: string) => ({
  canManage, isAdmin: false, supervisors: info,
  members: [mem('u1', 'Rafi', { isSupervisor: mainId === 'u1' }), mem('u2', 'Sajib', { isSupervisor: mainId === 'u2' })],
});

const route = (canManage: boolean, mainId: string, extra: (url: string, init?: RequestInit) => Promise<Response> | null = () => null) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const custom = extra(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/groups')) return ok({ groups: [{ id: 'g1', name: 'Mess' }] });
    if (url.endsWith('/members')) return ok(members(canManage, mainId));
    if (url.endsWith('/api/invitations')) return ok({ invitations: [{ id: 'i1', status: 'PENDING', group: { id: 'g2', name: 'Other mess' }, inviter: { id: 'u9', name: 'Boss', email: 'b@x.com' } }] });
    if (url.endsWith('/invitations')) return ok({ invitations: [{ id: 'i2', status: 'PENDING', invitee: { id: 'u5', name: 'New', email: 'new@x.com' } }] });
    return ok({}, 404);
  });

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <MembersScreen />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('MembersScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows a plain member the list without supervisor actions', async () => {
    route(false, 'u2');
    await renderScreen();
    expect(await screen.findByText('Sajib')).toBeTruthy();
    expect(screen.getByText(en.members.supervisor)).toBeTruthy();
    expect(screen.queryByText(en.members.invite)).toBeNull();
    expect(screen.queryByLabelText(`${en.members.remove} Sajib`)).toBeNull();
    expect(screen.getByText(en.members.leave)).toBeTruthy();
  });

  it('accepts an invitation', async () => {
    const spy = route(false, 'u2', (url, init) => (url.endsWith('/api/invitations/i1') && init?.method === 'PATCH' ? ok({ invitation: { id: 'i1', status: 'ACCEPTED' } }) : null));
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.members.accept));
    await waitFor(() => expect(screen.getByText(en.members.accepted)).toBeTruthy());
    const patch = spy.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ status: 'ACCEPTED' });
  });

  it('asks before the supervisor removes a member', async () => {
    const spy = route(true, 'u1', (url, init) => (url.endsWith('/members') && init?.method === 'DELETE' ? ok({ removed: true, left: false }) : null));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText(`${en.members.remove} Sajib`));
    expect(spy.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
    expect(screen.getByText(t(en.members.confirmRemove, { name: 'Sajib' }))).toBeTruthy();
    await fireEvent.press(screen.getByText(en.members.confirm));
    await waitFor(() => expect(screen.getByText(en.members.updated)).toBeTruthy());
    const del = spy.mock.calls.find(([, i]) => i?.method === 'DELETE');
    expect(JSON.parse(String(del?.[1]?.body))).toEqual({ userId: 'u2' });
  });

  it('sends an invitation by email and hides hand over from a co-supervisor', async () => {
    const spy = route(true, 'u2', (url, init) => (url.endsWith('/invitations') && init?.method === 'POST' ? ok({ invitation: { id: 'i3' }, invitee: { id: 'u6', name: 'N', email: 'n@x.com' }, resent: false, warning: null }, 201) : null));
    await renderScreen();
    expect(await screen.findByLabelText(en.members.inviteEmail)).toBeTruthy();
    expect(screen.queryByLabelText(`${en.members.makeSupervisor} Sajib`)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(en.members.inviteEmail), 'n@x.com');
    await fireEvent.press(screen.getByText(en.members.inviteSend));
    await waitFor(() => expect(screen.getByText(en.members.invited)).toBeTruthy());
    const post = spy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ email: 'n@x.com' });
  });
});
