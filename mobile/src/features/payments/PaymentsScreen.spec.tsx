import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { PaymentsScreen } from './PaymentsScreen';
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

const member = (id: string, name: string, o = {}) => ({ id, name, meals: 10, carryIn: 0, cost: 500, collected: 300, due: 200, status: 'PARTIAL', isActive: true, ...o });
const row = (o = {}) => ({ id: 'p1', userId: 'u2', userName: 'Sajib', amount: 300, date: '2026-11-03', billId: null, billType: null, isReversal: false, isReversed: false, isLinked: false, ...o });
const month = (canManage: boolean) => ({
  canManage, currentUserId: 'u1', closing: null, categoryLabels: {},
  members: [member('u1', 'Rafi'), member('u2', 'Sajib', { due: -50 })],
  payments: [row()], totals: { cost: 1000, collected: 600, outstanding: 200, refunds: 50 },
});
const advances = (canManage: boolean) => ({ canManage, currentUserId: 'u1', members: [{ id: 'u1', name: 'Rafi', balance: 75 }], history: [] });

const route = (canManage: boolean, extra: (url: string, init?: RequestInit) => Promise<Response> | null = () => null) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const custom = extra(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/groups')) return ok({ groups: [{ id: 'g1', name: 'Mess' }] });
    if (url.includes('/payments?month=')) return ok(month(canManage));
    if (url.endsWith('/advances')) return ok(advances(canManage));
    return ok({}, 404);
  });

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <PaymentsScreen />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('PaymentsScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows my due and advance and hides supervisor actions from a member', async () => {
    route(false);
    await renderScreen();
    expect(await screen.findByText(en.payments.mine)).toBeTruthy();
    expect(screen.getAllByText('75').length).toBeGreaterThan(0);
    expect(screen.getByText('owed 50')).toBeTruthy();
    expect(screen.queryByText(en.payments.recordPayment)).toBeNull();
    expect(screen.queryByText(en.payments.reverse)).toBeNull();
  });

  it('lets a supervisor record a payment', async () => {
    const spy = route(true, (url, init) =>
      url.endsWith('/api/groups/g1/payments') && init?.method === 'POST'
        ? ok({ payment: { id: 'p2', userId: 'u1', userName: 'Rafi', amount: 120, date: '2026-11-04' } }, 201)
        : null,
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.payments.recordPayment));
    await fireEvent.changeText(screen.getByLabelText(en.payments.amountLabel), '120');
    await fireEvent.press(screen.getByText(en.payments.save));
    await waitFor(() => expect(screen.getByText(en.payments.paymentSaved)).toBeTruthy());
    const post = spy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ userId: 'u1', amount: 120 });
  });

  it('rejects a zero amount without calling the API', async () => {
    const spy = route(true);
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.payments.recordPayment));
    await fireEvent.press(screen.getByText(en.payments.save));
    expect(screen.getByText(en.payments.invalidForm)).toBeTruthy();
    expect(spy.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
  });

  it('lets a supervisor reverse a payment', async () => {
    route(true, (url, init) => (url.endsWith('/api/payments/p1') && init?.method === 'DELETE' ? ok({ reversed: true, amount: 300 }) : null));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Reverse payment of Sajib'));
    await waitFor(() => expect(screen.getByText(en.payments.reversedDone)).toBeTruthy());
  });
});
