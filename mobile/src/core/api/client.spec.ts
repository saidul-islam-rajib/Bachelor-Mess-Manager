import { z } from 'zod';
import { request, setToken, setUnauthorizedHandler } from '@/core/api/client';
import { storage, STORAGE_KEYS } from '@/core/storage';

const schema = z.object({ value: z.number() });

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn();
const unauthorized = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  unauthorized.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setToken('old');
  setUnauthorizedHandler(unauthorized);
});

const auth = (call: number) => (fetchMock.mock.calls[call][1] as { headers: Record<string, string> }).headers.Authorization;

describe('refresh on 401', () => {
  it('refreshes once, stores the new token and retries', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { error: 'expired' }))
      .mockResolvedValueOnce(reply(200, { token: 'new', expiresAt: '2026-12-01T00:00:00.000Z' }))
      .mockResolvedValueOnce(reply(200, { value: 7 }));
    await expect(request('/api/data', schema)).resolves.toEqual({ value: 7 });
    expect(fetchMock.mock.calls[1][0]).toContain('/api/mobile/v1/auth/refresh');
    expect(auth(1)).toBe('Bearer old');
    expect(auth(2)).toBe('Bearer new');
    expect(await storage.get(STORAGE_KEYS.token)).toBe('new');
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('signs out when the refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { error: 'expired' }))
      .mockResolvedValueOnce(reply(401, { error: 'expired' }));
    await expect(request('/api/data', schema)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('signs out when the retry still returns 401', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { error: 'x' }))
      .mockResolvedValueOnce(reply(200, { token: 'new', expiresAt: 'x' }))
      .mockResolvedValueOnce(reply(401, { error: 'x' }));
    await expect(request('/api/data', schema)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('never refreshes the login call', async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { error: 'bad credentials' }));
    await expect(request('/api/mobile/v1/auth/login', schema, { method: 'POST', auth: false })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('never refreshes the refresh call', async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { error: 'expired' }));
    await expect(request('/api/mobile/v1/auth/refresh', schema, { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh between concurrent 401s', async () => {
    let refreshes = 0;
    fetchMock.mockImplementation(async (url: string, init: { headers: Record<string, string> }) => {
      if (url.includes('/auth/refresh')) {
        refreshes += 1;
        return reply(200, { token: 'new', expiresAt: 'x' });
      }
      return init.headers.Authorization === 'Bearer new' ? reply(200, { value: 1 }) : reply(401, { error: 'expired' });
    });
    const results = await Promise.all([request('/api/a', schema), request('/api/b', schema), request('/api/c', schema)]);
    expect(results).toHaveLength(3);
    expect(refreshes).toBe(1);
    expect(unauthorized).not.toHaveBeenCalled();
  });
});
