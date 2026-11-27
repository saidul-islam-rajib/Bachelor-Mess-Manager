import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { BazarScreen } from './BazarScreen';
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

const own = {
  id: 'e1', date: '2026-11-03', amount: 150, note: 'Weekly', payer: { id: 'u1', name: 'Rafi', email: 'r@x.com' },
  items: [{ id: 'i1', name: 'Rice', amount: 150 }], comments: [],
};
const other = { ...own, id: 'e2', amount: 80, payer: { id: 'u2', name: 'Sajib', email: 's@x.com' }, items: [{ id: 'i2', name: 'Fish', amount: 80 }] };

const month = { expenses: [own, other], members: [{ id: 'u1', name: 'Rafi' }], mentionNames: {}, isSupervisor: false, currentUserId: 'u1' };

const schedule = {
  monthKey: '2026-11', totalDays: 2, editable: true, lockedReason: null, canManage: true, isAdmin: false, currentUserId: 'u1',
  members: [{ id: 'u1', name: 'Rafi', dayCount: 1 }, { id: 'u2', name: 'Sajib', dayCount: 1 }],
  days: [{ day: 1, date: '2026-11-01', userId: 'u1', userName: 'Rafi' }, { day: 2, date: '2026-11-02', userId: 'u2', userName: 'Sajib' }],
};

const route = (extra: (url: string, init?: RequestInit) => Promise<Response> | null = () => null) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const custom = extra(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/groups')) return ok({ groups: [{ id: 'g1', name: 'Mess' }] });
    if (url.includes('/expenses?month=')) return ok(month);
    if (url.includes('/bazar-schedule')) return ok(schedule);
    return ok({}, 404);
  });

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <BazarScreen />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('BazarScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists purchases and offers edit only on your own', async () => {
    route();
    await renderScreen();
    expect(await screen.findByText('Rice')).toBeTruthy();
    expect(screen.getByText('Fish')).toBeTruthy();
    expect(screen.getAllByText(en.bazar.edit)).toHaveLength(1);
  });

  it('adds a purchase', async () => {
    const spy = route((url, init) =>
      url.endsWith('/groups/g1/expenses') && init?.method === 'POST'
        ? ok({ expense: { id: 'e3', date: '2026-11-04', amount: 40, note: '', items: [{ id: 'i3', name: 'Egg', amount: 40 }] } }, 201)
        : null,
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bazar.add));
    await fireEvent.changeText(screen.getByLabelText(en.bazar.dateLabel), '2026-11-04');
    await fireEvent.changeText(screen.getByLabelText(en.bazar.itemName), 'Egg');
    await fireEvent.changeText(screen.getByLabelText(en.bazar.itemAmount), '40');
    await fireEvent.press(screen.getByText(en.bazar.save));
    await waitFor(() => expect(screen.getByText(en.bazar.saved)).toBeTruthy());
    const post = spy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ date: '2026-11-04', note: '', items: [{ name: 'Egg', amount: 40 }] });
  });

  it('rejects an empty purchase without calling the server', async () => {
    const spy = route();
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bazar.add));
    await fireEvent.press(screen.getByText(en.bazar.save));
    expect(await screen.findByText(en.bazar.invalidForm)).toBeTruthy();
    expect(spy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('deletes after confirmation', async () => {
    const spy = route((url, init) => (url.endsWith('/api/expenses/e1') && init?.method === 'DELETE' ? ok({ deleted: true }) : null));
    await renderScreen();
    await screen.findByText('Rice');
    await fireEvent.press(screen.getByText(en.bazar.remove));
    await fireEvent.press(screen.getByText(en.bazar.yes));
    await waitFor(() => expect(screen.getByText(en.bazar.deleted)).toBeTruthy());
    expect(spy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });

  it('shows the server error when a comment is refused', async () => {
    route((url, init) => (url.endsWith('/expenses/e2/comments') && init?.method === 'POST' ? ok({ error: 'Not allowed.' }, 403) : null));
    await renderScreen();
    await screen.findByText('Fish');
    const inputs = screen.getAllByLabelText(en.bazar.commentLabel);
    await fireEvent.changeText(inputs[1], 'Nice');
    await fireEvent.press(screen.getAllByText(en.bazar.send)[1]);
    expect(await screen.findByText('Not allowed.')).toBeTruthy();
  });

  it('assigns a duty day as a supervisor', async () => {
    const spy = route((url, init) => (url.includes('/bazar-schedule') && init?.method === 'PUT' ? ok(schedule) : null));
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bazar.dutyTab));
    await screen.findByText(t2(1));
    await fireEvent.press(screen.getAllByText(en.bazar.edit)[1]);
    await fireEvent.press(screen.getAllByText('Rafi')[screen.getAllByText('Rafi').length - 1]);
    await waitFor(() => expect(spy.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));
    const put = spy.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ assignments: [{ day: 2, userId: 'u1' }] });
  });
});

const t2 = (day: number) => en.bazar.dutyDay.replace('{day}', String(day));
