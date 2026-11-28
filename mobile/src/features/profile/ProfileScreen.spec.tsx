import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { ProfileScreen } from './ProfileScreen';
import { en } from '@/core/i18n/en';

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

const profile = {
  member: {
    id: 'u1', name: 'Rafi', email: 'r@x.com', phone: null, profileImage: null, role: 'MEMBER', status: 'ACTIVE',
    memberSince: '2026-01-01T00:00:00Z', isSelf: true, groups: [],
  },
};
const requests = (list: unknown[] = []) => ({
  requests: list, canReview: false, policy: { autoApproveSupervisor: false, allowSelfRoleSwitch: false },
});

const route = (extra: (url: string, init?: RequestInit) => Promise<Response> | null = () => null, reqs: unknown[] = []) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const custom = extra(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/users/u1/profile')) return ok(profile);
    if (url.endsWith('/api/settings')) return ok({ settings: { companyName: 'Bachelor Point' } });
    if (url.includes('/api/role-requests') && init?.method !== 'POST') return ok(requests(reqs));
    return ok({}, 404);
  });

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('ProfileScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('saves name, phone and theme with a PATCH', async () => {
    const spy = route((url, init) =>
      url.endsWith('/api/profile') && init?.method === 'PATCH'
        ? ok({ user: { ...profile.member, name: 'Rafi K', phone: '0171', theme: 'dark' }, passwordChanged: false })
        : null,
    );
    await renderScreen();
    await fireEvent.changeText(await screen.findByLabelText(en.profile.name), 'Rafi K');
    await fireEvent.changeText(screen.getByLabelText(en.profile.phone), '0171');
    await fireEvent.press(screen.getByText(en.profile.themes.dark));
    await fireEvent.press(screen.getByText(en.profile.save));
    await waitFor(() => expect(screen.getByText(en.profile.saved)).toBeTruthy());
    const patch = spy.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ name: 'Rafi K', phone: '0171', theme: 'dark' });
  });

  it('asks for the supervisor role', async () => {
    const spy = route((url, init) =>
      url.endsWith('/api/role-requests') && init?.method === 'POST'
        ? ok({ requestId: 'r1', autoApproved: false, message: 'Request sent' }, 201)
        : null,
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.profile.askSupervisor));
    await waitFor(() => expect(screen.getByText('Request sent')).toBeTruthy());
    const post = spy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ requestedRole: 'SUPERVISOR' });
  });

  it('hides the request button while one is pending', async () => {
    route(() => null, [
      { id: 'r1', requestedRole: 'SUPERVISOR', status: 'PENDING', reason: null, decisionNote: null, createdAt: '2026-02-01T00:00:00Z' },
    ]);
    await renderScreen();
    expect(await screen.findByText(en.profile.requestPending)).toBeTruthy();
    expect(screen.queryByText(en.profile.askSupervisor)).toBeNull();
  });
});
