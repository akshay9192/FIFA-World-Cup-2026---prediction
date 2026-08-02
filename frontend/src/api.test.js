import { api, clearApiCache } from './api';

beforeEach(() => {
  clearApiCache();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('reports an understandable timeout when the replay service takes too long', async () => {
  jest.useFakeTimers();
  global.fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  }));

  const request = api('/slow-test', { timeoutMs: 25 });
  jest.advanceTimersByTime(25);

  await expect(request).rejects.toThrow(
    'The replay service took too long to respond. It may still be waking up—please retry.',
  );
});

test('deduplicates simultaneous read-only requests', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ title: 'Replay metadata' }),
  });

  const [first, second] = await Promise.all([api('/meta'), api('/meta')]);

  expect(first).toEqual(second);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
