import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { BillsScreen } from './BillsScreen';
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

const col = (o = {}) => ({ id: 'c1', amount: 100, date: '2026-11-03', recordedAt: 'x', recordedByName: null, isReversal: false, isReversed: false, isLinked: false, toUserName: null, fromUserName: null, fromAdvance: false, fromPayer: false, ...o });
const share = (userId: string, userName: string, o = {}) => ({ userId, userName, amount: 100, paid: 0, outstanding: 100, advance: 0, status: 'UNPAID', isShare: true, collections: [], ...o });
const bill = { id: 'b1', type: 'RENT', amount: 200, date: '2026-11-03', note: 'Nov rent', isReceived: true, splitMethod: 'EQUAL', payer: null, shares: [share('u1', 'Rafi'), share('u2', 'Sajib', { paid: 100, outstanding: 0, collections: [col()] })], collected: 100, uncollected: 100, advance: 0, isFullyCollected: false, unpaidMemberCount: 1 };
const month = (canManage: boolean) => ({
  canManage, canRecordOwn: true, currentUserId: 'u1', categories: ['RENT', 'WIFI'], categoryLabels: { RENT: 'Rent', WIFI: 'Wi-Fi' },
  bills: [bill], members: [], totals: { total: 200, settled: 0, outstanding: 0, collected: 100, uncollected: 100 },
});

const route = (canManage: boolean, extra: (url: string, init?: RequestInit) => Promise<Response> | null = () => null) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const custom = extra(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/groups')) return ok({ groups: [{ id: 'g1', name: 'Mess' }] });
    if (url.includes('/bills?month=')) return ok(month(canManage));
    return ok({}, 404);
  });

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <BillsScreen />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('BillsScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the bill with my own share and hides manager actions from a member', async () => {
    route(false);
    await renderScreen();
    expect(await screen.findByText('Rent')).toBeTruthy();
    expect(screen.getByText('Your share 100 · paid 0 · due 100')).toBeTruthy();
    expect(screen.queryByText(en.bills.add)).toBeNull();
    expect(screen.queryByText(en.bills.remove)).toBeNull();
  });

  it('lets a member pay only their own share', async () => {
    const spy = route(false, (url, init) =>
      url.endsWith('/api/bills/b1/collections') && init?.method === 'POST'
        ? ok({ collection: { id: 'c2', userId: 'u1', userName: 'Rafi', amount: 100, date: '2026-11-04' }, totals: { collected: 200, outstanding: 0, unpaidMemberCount: 0, isFullyCollected: true } }, 201)
        : null,
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bills.showShares));
    expect(screen.getAllByText(en.bills.markMinePaid)).toHaveLength(1);
    await fireEvent.press(screen.getByText(en.bills.markMinePaid));
    await waitFor(() => expect(screen.getByText(en.bills.paymentSaved)).toBeTruthy());
    const post = spy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ userId: 'u1', settle: true });
  });

  it('adds a bill as a supervisor', async () => {
    const spy = route(true, (url, init) =>
      url.endsWith('/groups/g1/bills') && init?.method === 'POST' ? ok({ bill: { id: 'b2', type: 'WIFI', amount: 50, date: '2026-11-04', note: '' } }, 201) : null,
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bills.add));
    await fireEvent.press(screen.getByText('Wi-Fi'));
    await fireEvent.changeText(screen.getByLabelText(en.bills.amountLabel), '50');
    await fireEvent.changeText(screen.getByLabelText(en.bills.dateLabel), '2026-11-04');
    await fireEvent.press(screen.getByText(en.bills.save));
    await waitFor(() => expect(screen.getByText(en.bills.saved)).toBeTruthy());
    const post = spy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ type: 'WIFI', amount: 50, date: '2026-11-04', note: '', splitMethod: 'EQUAL' });
  });

  it('rejects an empty bill without calling the server', async () => {
    const spy = route(true);
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bills.add));
    await fireEvent.press(screen.getByText(en.bills.save));
    expect(await screen.findByText(en.bills.invalidForm)).toBeTruthy();
    expect(spy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('deletes after confirmation and reverses a collection', async () => {
    const spy = route(true, (url, init) => {
      if (url.endsWith('/api/bills/b1') && init?.method === 'DELETE') return ok({ deleted: true });
      if (url.includes('/collections?collectionId=c1') && init?.method === 'DELETE') return ok({ reversed: true, amount: 100 });
      return null;
    });
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bills.showShares));
    await fireEvent.press(screen.getByLabelText('Reverse payment of Sajib'));
    await waitFor(() => expect(screen.getByText(en.bills.reversedDone)).toBeTruthy());
    await fireEvent.press(screen.getByText(en.bills.remove));
    await fireEvent.press(screen.getByText(en.bills.yes));
    await waitFor(() => expect(screen.getByText(en.bills.deleted)).toBeTruthy());
    expect(spy.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(2);
  });

  it('shows the server error when a payment is refused', async () => {
    route(false, (url, init) => (url.endsWith('/collections') && init?.method === 'POST' ? ok({ error: 'Group is closed.' }, 400) : null));
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.bills.showShares));
    await fireEvent.press(screen.getByText(en.bills.markMinePaid));
    expect(await screen.findByText('Group is closed.')).toBeTruthy();
  });
});
