import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '@/core/providers/auth';
import { SignInScreen } from './SignInScreen';
import { en } from '@/core/i18n/en';

const ok = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, headers: { get: () => null }, json: async () => body } as unknown as Response);

describe('SignInScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('asks for both fields', async () => {
    await render(<AuthProvider><SignInScreen /></AuthProvider>);
    await fireEvent.press(screen.getByText(en.auth.submit));
    expect(await screen.findByText(en.auth.required)).toBeTruthy();
  });

  it('posts credentials to the mobile login route', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      ok({ token: 't', expiresAt: '2030-01-01', user: { id: '1', name: 'A', email: 'a@b.c', role: 'MEMBER' } }),
    );
    await render(<AuthProvider><SignInScreen /></AuthProvider>);
    await fireEvent.changeText(screen.getByLabelText(en.auth.email), 'a@b.c');
    await fireEvent.changeText(screen.getByLabelText(en.auth.password), 'pw');
    await fireEvent.press(screen.getByText(en.auth.submit));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/mobile\/v1\/auth\/login$/);
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.c', password: 'pw' });
  });

  it('shows an error on 401', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => ok({ error: 'bad' }, 401));
    await render(<AuthProvider><SignInScreen /></AuthProvider>);
    await fireEvent.changeText(screen.getByLabelText(en.auth.email), 'a@b.c');
    await fireEvent.changeText(screen.getByLabelText(en.auth.password), 'pw');
    await fireEvent.press(screen.getByText(en.auth.submit));
    expect(await screen.findByText(en.auth.invalid)).toBeTruthy();
  });
});
