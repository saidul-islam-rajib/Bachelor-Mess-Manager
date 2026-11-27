import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { GroupProvider } from '@/core/providers/group';
import { storage } from '@/core/storage';
import { GroupPicker } from './GroupPicker';
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

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => body } as unknown as Response);

const renderPicker = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <GroupProvider>
          <GroupPicker />
        </GroupProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

const mockGroups = (groups: { id: string; name: string }[]) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation(() => ok({ groups }));

describe('GroupPicker', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows nothing for a single group', async () => {
    const spy = mockGroups([{ id: 'g1', name: 'Alpha' }]);
    const view = await renderPicker();
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(view.queryByLabelText(en.group.pick)).toBeNull();
  });

  it('lets the user switch between two groups and remembers the choice', async () => {
    mockGroups([{ id: 'g1', name: 'Alpha' }, { id: 'g2', name: 'Beta' }]);
    const view = await renderPicker();
    expect(await view.findByText('Alpha')).toBeTruthy();
    await fireEvent.press(view.getByLabelText(en.group.pick));
    await fireEvent.press(await view.findByText('Beta'));
    await waitFor(async () => expect(await storage.get('group.active')).toBe('g2'));
  });
});
