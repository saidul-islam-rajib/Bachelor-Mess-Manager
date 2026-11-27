import { z } from 'zod';
import { request, setBaseUrl, setToken } from '@/core/api/client';
import { flushLog, installGlobalHandler, resetLog } from '@/core/log';
jest.unmock('@/core/log');

const fetchMock = jest.fn();
const schema = z.object({ ok: z.boolean() });

const reply = (status: number, body: unknown) =>
  ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body }) as unknown as Response;

const logBodies = () =>
  fetchMock.mock.calls
    .filter((c) => String(c[0]).endsWith('/api/logs'))
    .map((c) => JSON.parse((c[1] as { body: string }).body) as { platform: string; entries: { event: string; rid?: string; data?: Record<string, unknown> }[] });

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset();
  resetLog();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setBaseUrl('http://api.test');
  setToken('secret-token');
});

afterEach(() => jest.useRealTimers());

describe('client logging', () => {
  it('sends x-request-id, logs api.call and flushes without the token', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }));
    await request('/api/data', schema, { method: 'POST', body: { password: 'hunter2' } });
    const headers = (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['x-request-id']).toMatch(/^[0-9a-f]{16}$/);
    fetchMock.mockResolvedValueOnce(reply(204, null));
    await flushLog();
    const [batch] = logBodies();
    expect(batch.platform).toMatch(/ios|android/);
    expect(batch.entries[0]).toMatchObject({ event: 'api.call', rid: headers['x-request-id'] });
    const raw = JSON.stringify(batch);
    expect(raw).not.toContain('secret-token');
    expect(raw).not.toContain('hunter2');
  });

  it('logs api.fail for 4xx and network errors', async () => {
    fetchMock.mockResolvedValueOnce(reply(404, { error: 'x' }));
    await expect(request('/api/a', schema)).rejects.toMatchObject({ status: 404 });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(request('/api/b', schema)).rejects.toThrow('offline');
    fetchMock.mockResolvedValueOnce(reply(204, null));
    await flushLog();
    const events = logBodies()[0].entries;
    expect(events.map((e) => e.event)).toEqual(['api.fail', 'api.fail']);
    expect(events[1].data).toMatchObject({ status: 0 });
  });

  it('drops a rejected flush without throwing or logging itself', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }));
    await request('/api/data', schema);
    fetchMock.mockRejectedValueOnce(new Error('down'));
    await expect(flushLog()).resolves.toBeUndefined();
    const before = fetchMock.mock.calls.length;
    await flushLog();
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('chains the previous global error handler', () => {
    const previous = jest.fn();
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = { getGlobalHandler: () => previous, setGlobalHandler: (h: unknown) => ((globalThis as { __h?: unknown }).__h = h) };
    installGlobalHandler();
    const handler = (globalThis as unknown as { __h: (e: unknown, f?: boolean) => void }).__h;
    handler(new Error('boom'), true);
    expect(previous).toHaveBeenCalled();
  });
});
