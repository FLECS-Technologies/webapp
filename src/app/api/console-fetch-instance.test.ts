import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customInstance } from './console-fetch-instance';

describe('console customInstance request lifecycle', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not add a request signal when Orval provides none', async () => {
    await customInstance('/foo');

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeUndefined();
  });

  it('forwards the request signal supplied through Orval options', async () => {
    const controller = new AbortController();

    await customInstance('/foo', { signal: controller.signal });

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
  });
});
