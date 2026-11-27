import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { en } from '@/core/i18n/en';
import { NotificationsScreen } from './NotificationsScreen';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

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

const item = (id: string, read: boolean, title: string) => ({
  id, type: 'NOTICE', actorId: null, actorName: 'Sup', groupId: 'g1', groupName: 'Mess',
  title, excerpt: `Body ${id}`, link: '/x', read, createdAt: '2026-11-27T10:00:00.000Z',
});
const meta = { page: 1, pageSize: 20, total: 2, totalPages: 1, hasPrevious: false, hasNext: false, from: 1, to: 2 };

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <NotificationsScreen />
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('NotificationsScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('marks one notification read', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/notifications/n1') && init?.method === 'PATCH') return ok({ id: 'n1' });
      if (url.endsWith('/api/notifications')) {
        return ok({ notifications: [item('n1', false, 'First'), item('n2', true, 'Second')], unreadCount: 1, meta });
      }
      return ok({}, 404);
    });
    await renderScreen();
    expect(await screen.findByText('1 unread')).toBeTruthy();
    await fireEvent.press(screen.getByText('First'));
    await waitFor(() => expect(screen.getByText('0 unread')).toBeTruthy());
    expect(spy.mock.calls.some(([u, i]) => String(u).endsWith('/api/notifications/n1') && i?.method === 'PATCH')).toBe(true);
  });

  it('marks all read', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/notifications') && init?.method === 'PATCH') {
        return ok({ notifications: [item('n1', true, 'First')], unreadCount: 0, meta });
      }
      if (url.endsWith('/api/notifications')) {
        return ok({ notifications: [item('n1', false, 'First')], unreadCount: 1, meta });
      }
      return ok({}, 404);
    });
    await renderScreen();
    await fireEvent.press(await screen.findByText(en.notifications.markAll));
    await waitFor(() => expect(screen.getByText('0 unread')).toBeTruthy());
    expect(screen.queryByText(en.notifications.markAll)).toBeNull();
  });

  it('shows the empty state', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => ok({ notifications: [], unreadCount: 0, meta }));
    await renderScreen();
    expect(await screen.findByText(en.notifications.empty)).toBeTruthy();
  });
});
