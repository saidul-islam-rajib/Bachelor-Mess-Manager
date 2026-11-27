import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/core/providers/auth';
import { en } from '@/core/i18n/en';
import { QuickReplyCard } from './QuickReplyCard';

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

const card = {
  groupId: 'g1', groupName: 'Mess', date: '2026-11-28',
  counts: { breakfast: 1, lunch: 1, dinner: 1 }, planned: { breakfast: 1, lunch: 1, dinner: 1 },
  answer: null, respondedAt: null,
};

const renderCard = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <QuickReplyCard />
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('QuickReplyCard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends a yes answer', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/meal-prompts') && init?.method === 'POST') {
        return ok({ saved: true, counts: card.counts, summary: 'Meals saved for tomorrow.' });
      }
      if (url.includes('/api/meal-prompts')) return ok({ date: card.date, prompts: [card] });
      return ok({}, 404);
    });
    await renderCard();
    await fireEvent.press(await screen.findByText(en.prompts.yes));
    await waitFor(() => expect(screen.getByText('Meals saved for tomorrow.')).toBeTruthy());
    const post = spy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ groupId: 'g1', date: '2026-11-28', answer: 'YES' });
  });

  it('sends custom counts', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/meal-prompts') && init?.method === 'POST') {
        return ok({ saved: true, counts: { breakfast: 1, lunch: 2, dinner: 1 }, summary: 'Saved.' });
      }
      if (url.includes('/api/meal-prompts')) return ok({ date: card.date, prompts: [card] });
      return ok({}, 404);
    });
    await renderCard();
    await fireEvent.press(await screen.findByText(en.prompts.custom));
    await fireEvent.press(screen.getByLabelText(en.meals.increase.replace('{kind}', 'Lunch')));
    await fireEvent.press(screen.getByText(en.prompts.saveCustom));
    await waitFor(() => expect(screen.getByText('Saved.')).toBeTruthy());
    const post = spy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      groupId: 'g1', date: '2026-11-28', answer: 'CUSTOM', counts: { breakfast: 1, lunch: 2, dinner: 1 },
    });
  });

  it('renders nothing without prompts', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => ok({ date: card.date, prompts: [] }));
    await renderCard();
    await waitFor(() => expect(screen.queryByText(en.prompts.yes)).toBeNull());
  });
});
