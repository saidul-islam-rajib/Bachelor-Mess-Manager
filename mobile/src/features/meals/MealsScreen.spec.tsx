import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { MealsScreen } from './MealsScreen';
import { todayKey } from './dates';
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

const closedWindow = {
  open: false, unlimited: false, openedAt: null, expiresAt: null, secondsRemaining: null,
  windowMinutes: 5, requiresApproval: true, approvalSetBySupervisor: false,
};

const monthBody = (extra: object = {}) => ({
  canManage: false,
  currentUserId: 'u1',
  groupStatus: 'ACTIVE',
  members: [{ id: 'u1', name: 'Rafi', email: 'r@x.com' }],
  weights: { breakfast: 1, lunch: 1, dinner: 1 },
  entries: [],
  editWindow: closedWindow,
  pendingChanges: [],
  ...extra,
});

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <MealsScreen />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

const route = (month: object, extra: (url: string, init?: RequestInit) => Promise<Response> | null = () => null) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const custom = extra(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/groups')) return ok({ groups: [{ id: 'g1', name: 'Mess' }] });
    if (url.includes('/meals?month=')) return ok(month);
    return ok({}, 404);
  });

describe('MealsScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('saves today at once', async () => {
    const spy = route(monthBody(), (url, init) =>
      init?.method === 'PUT'
        ? ok({ applied: true, entry: { userId: 'u1', date: todayKey(), breakfast: 0, lunch: 1, dinner: 0 } })
        : null,
    );
    await renderScreen();
    const more = await screen.findAllByLabelText(t('Lunch'));
    await fireEvent.press(more[Number(todayKey().slice(8)) - 1]);
    await fireEvent.press(await screen.findByText(en.meals.save));
    await waitFor(() => expect(screen.getByText(en.meals.saved)).toBeTruthy());
    const put = spy.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ date: todayKey(), breakfast: 0, lunch: 1, dinner: 0 });
  });

  it('offers the past-day window when it is closed', async () => {
    const spy = route(monthBody(), (url, init) =>
      url.endsWith('/meal-edit-window') && init?.method === 'POST'
        ? ok({ window: { ...closedWindow, open: true, expiresAt: new Date(Date.now() + 300000).toISOString(), secondsRemaining: 300 } })
        : null,
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.meals.openWindow));
    await waitFor(() => expect(spy.mock.calls.some(([u, i]) => String(u).endsWith('/meal-edit-window') && i?.method === 'POST')).toBe(true));
  });

  it('withdraws a pending request', async () => {
    const pending = {
      id: 'r1', userId: 'u1', userName: 'Rafi', groupId: 'g1', date: '2026-11-01',
      from: { breakfast: 0, lunch: 0, dinner: 0 }, to: { breakfast: 0, lunch: 1, dinner: 0 },
      summary: 'lunch 0 → 1', reason: null, status: 'PENDING', pending: true,
      decidedAt: null, decidedByName: null, decisionNote: null, createdAt: '2026-11-02T00:00:00.000Z',
    };
    const spy = route(monthBody({ pendingChanges: [pending] }), (url, init) =>
      url.endsWith('/api/meal-changes/r1') && init?.method === 'DELETE' ? ok({ status: 'CANCELLED' }) : null,
    );
    await renderScreen();
    expect(await screen.findByText('lunch 0 → 1')).toBeTruthy();
    await fireEvent.press(screen.getByText(en.meals.withdraw));
    await waitFor(() => expect(screen.getByText(en.meals.withdrawn)).toBeTruthy());
    expect(spy.mock.calls.some(([u, i]) => String(u).endsWith('/api/meal-changes/r1') && i?.method === 'DELETE')).toBe(true);
  });

  const request = {
    id: 'r2', userId: 'u2', userName: 'Sami', groupId: 'g1', date: '2026-11-01',
    from: { breakfast: 0, lunch: 0, dinner: 0 }, to: { breakfast: 0, lunch: 1, dinner: 0 },
    summary: 'lunch 0 → 1', reason: null, status: 'PENDING', pending: true,
    decidedAt: null, decidedByName: null, decisionNote: null, createdAt: '2026-11-02T00:00:00.000Z',
  };
  const manager = (extra: object = {}) =>
    monthBody({
      canManage: true,
      members: [
        { id: 'u1', name: 'Rafi', email: 'r@x.com' },
        { id: 'u2', name: 'Sami', email: 's@x.com' },
      ],
      ...extra,
    });

  it('lets a supervisor approve a pending request', async () => {
    const spy = route(manager({ pendingChanges: [request] }), (url, init) =>
      url.endsWith('/api/meal-changes/r2') && init?.method === 'PATCH' ? ok({ request: { ...request, status: 'APPROVED', pending: false } }) : null,
    );
    await renderScreen();
    expect(await screen.findByText(en.meals.requestLine.replace('{name}', 'Sami').replace('{date}', '2026-11-01'))).toBeTruthy();
    await fireEvent.press(screen.getByText(en.meals.approve));
    await waitFor(() => expect(screen.getByText(en.meals.approved)).toBeTruthy());
    const patch = spy.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ status: 'APPROVED' });
  });

  it('saves a day for the picked member', async () => {
    const spy = route(manager(), (url, init) =>
      init?.method === 'PUT'
        ? ok({ applied: true, entry: { userId: 'u2', date: todayKey(), breakfast: 0, lunch: 1, dinner: 0 } })
        : null,
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText('Sami'));
    const more = await screen.findAllByLabelText(t('Lunch'));
    await fireEvent.press(more[Number(todayKey().slice(8)) - 1]);
    await fireEvent.press(await screen.findByText(en.meals.save));
    await waitFor(() => expect(screen.getByText(en.meals.saved)).toBeTruthy());
    const put = spy.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ date: todayKey(), breakfast: 0, lunch: 1, dinner: 0, userId: 'u2' });
  });
});

function t(kind: string) {
  return en.meals.increase.replace('{kind}', kind);
}
