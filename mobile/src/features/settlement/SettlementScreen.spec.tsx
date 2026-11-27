import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { SettlementScreen } from './SettlementScreen';
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

const line = (userId: string, userName: string, carryOut: number) => ({ userId, userName, carryIn: 0, mealCount: 10, mealCost: 500, billShare: 0, bazarPaid: 0, cashPaid: 500, carryOut });
const closings = (canManage: boolean) => ({
  canManage,
  closings: [{ id: 'c1', monthKey: '2026-10', closedThrough: '2026-10-31', closedAt: '2026-11-01T00:00:00Z', closedBy: 'Boss', note: null, reopenedAt: null, settledAt: null, settledBy: null, scope: 'GROUP', lines: [line('u1', 'Rafi', 120), line('u2', 'Sajib', -120)] }],
});
const member = (id: string, name: string, liveDue: number) => ({ id, name, meals: 10, totalCost: 500, cashPaid: 380, dueAtClose: liveDue, liveDue, status: 'PARTIAL', isCurrentMember: true });
const final = (canManage: boolean, settlement: unknown = {
  groupId: 'g1', groupName: 'Mess', closingId: 'c1', monthKey: '2026-10', closedThrough: '2026-10-31', settledAt: null, mealRate: 50,
  members: [member('u1', 'Rafi', 120), member('u2', 'Sajib', -120)],
  settleUp: { transfers: [{ direction: 'out', counterpartyName: 'Sajib', amount: 120 }], unmatched: 0, surplus: 0 }, allClear: false,
}) => ({ canManage, settlement });

const route = (canManage: boolean, extra: (url: string, init?: RequestInit) => Promise<Response> | null = () => null, settlement?: unknown) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const custom = extra(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/groups')) return ok({ groups: [{ id: 'g1', name: 'Mess' }] });
    if (url.endsWith('/closings')) return ok(closings(canManage));
    if (url.endsWith('/final-settlement')) return ok(settlement === undefined ? final(canManage) : { canManage, settlement });
    return ok({}, 404);
  });

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <SettlementScreen />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('SettlementScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows a member their transfers and closing line without supervisor actions', async () => {
    route(false);
    await renderScreen();
    expect(await screen.findByText(t(en.settlement.transferOut, { name: 'Sajib', amount: '120' }))).toBeTruthy();
    expect(screen.getByText(en.settlement.myLine)).toBeTruthy();
    expect(screen.queryByText(en.settlement.settleAll)).toBeNull();
    expect(screen.queryByText(en.settlement.reopen)).toBeNull();
    expect(screen.queryByLabelText(en.settlement.monthLabel)).toBeNull();
  });

  it('shows a note when no final settlement exists', async () => {
    route(false, () => null, null);
    await renderScreen();
    expect(await screen.findByText(en.settlement.noFinal)).toBeTruthy();
  });

  it('asks for confirmation before a supervisor closes a month', async () => {
    const spy = route(true, (url, init) => (url.endsWith('/closings') && init?.method === 'POST' ? ok({ closingId: 'c2', members: 2, carriedForward: 0 }, 201) : null));
    await renderScreen();
    await fireEvent.changeText(await screen.findByLabelText(en.settlement.monthLabel), '2026-11');
    await fireEvent.press(screen.getAllByText(en.settlement.closeMonth)[1]);
    expect(spy.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
    expect(screen.getByText(t(en.settlement.confirmClose, { month: '2026-11' }))).toBeTruthy();
    await fireEvent.press(screen.getByText(en.settlement.confirm));
    await waitFor(() => expect(screen.getByText(en.settlement.closed)).toBeTruthy());
    const post = spy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ month: '2026-11' });
  });

  it('rejects a malformed month without calling the API', async () => {
    const spy = route(true);
    await renderScreen();
    await fireEvent.changeText(await screen.findByLabelText(en.settlement.monthLabel), 'nov');
    await fireEvent.press(screen.getAllByText(en.settlement.closeMonth)[1]);
    expect(screen.getByText(en.settlement.invalidMonth)).toBeTruthy();
    expect(spy.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
  });

  it('lets a supervisor settle everyone after confirming', async () => {
    const spy = route(true, (url, init) => (url.endsWith('/final-settlement') && init?.method === 'POST' ? ok(final(true)) : null));
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.settlement.settleAll));
    await fireEvent.press(screen.getByText(en.settlement.confirm));
    await waitFor(() => expect(screen.getByText(en.settlement.settled)).toBeTruthy());
    const post = spy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ action: 'settleAll' });
  });
});
