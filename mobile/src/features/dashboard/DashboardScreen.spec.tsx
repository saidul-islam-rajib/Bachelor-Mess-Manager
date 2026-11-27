import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { DashboardScreen } from './DashboardScreen';
import { en } from '@/core/i18n/en';

const ok = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, headers: { get: () => null }, json: async () => body } as unknown as Response);

const month = {
  meals: 12,
  mealCost: 900,
  billShare: 100,
  totalCost: 1000,
  bazarPaid: 0,
  collected: 400,
  due: 600,
  status: 'DUE',
  mealRate: 75,
  rateMode: 'DAILY',
  dailyRate: { date: '2026-11-27', rate: 80.5, isToday: true },
  todayMeals: { breakfast: 0, lunch: 1, dinner: 1, total: 2 },
  groupMeals: 100,
  groupExpense: 7500,
  groupBazar: 7000,
  groupBills: 500,
  byType: {},
  members: [],
};

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <DashboardScreen />
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('DashboardScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the daily rate first and the month figures', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      ok({
        role: 'MEMBER',
        month: '2026-11',
        member: { group: { id: 'g', name: 'Mess' }, pendingInvitations: 0, current: month, previous: null },
      }),
    );
    await renderScreen();
    expect(await screen.findByText('80.50')).toBeTruthy();
    expect(screen.getByText(en.dashboard.todayRate)).toBeTruthy();
    expect(screen.getByText('75.00')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('600.00')).toBeTruthy();
    expect(spy.mock.calls.some(([url]) => /\/api\/reports\/dashboard$/.test(String(url)))).toBe(true);
  });

  it('shows supervisor totals and members with dues', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      ok({
        role: 'SUPERVISOR',
        month: '2026-11',
        supervisor: {
          totals: { groups: 2, members: 9, meals: 120, mealRate: 70, expense: 8400, collected: 5000, outstanding: 3400 },
          unpaid: [{ groupId: 'g1', groupName: 'Mess A', id: 'u1', name: 'Rafi', due: 450.5 }],
          pendingMealChanges: [{}, {}],
        },
      }),
    );
    await renderScreen();
    expect(await screen.findByText('3400.00')).toBeTruthy();
    expect(screen.getByText('Rafi · Mess A')).toBeTruthy();
    expect(screen.getByText('450.50')).toBeTruthy();
  });

  it('shows admin counts', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      ok({
        role: 'ADMIN',
        month: '2026-11',
        admin: { pendingApprovals: 4, members: 30, supervisors: 5, activeGroups: 6, inactiveGroups: 1, activeMemberships: 33 },
      }),
    );
    await renderScreen();
    expect(await screen.findByText(en.dashboard.adminPending)).toBeTruthy();
    expect(screen.getByText('33')).toBeTruthy();
  });

  it('shows an error with retry when the request fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => ok({ error: 'boom' }, 500));
    await renderScreen();
    expect(await screen.findByText(en.dashboard.loadFailed)).toBeTruthy();
    expect(screen.getByText(en.common.retry)).toBeTruthy();
  });
});
