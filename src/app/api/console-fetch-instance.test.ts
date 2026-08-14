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

  it('applies the standard request deadline when Orval provides no signal', async () => {
    await customInstance('/foo');

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('composes the Orval/TanStack signal with the standard request deadline', async () => {
    const controller = new AbortController();

    await customInstance('/foo', { signal: controller.signal });

    const requestSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal;
    expect(requestSignal).not.toBe(controller.signal);
    controller.abort();
    expect(requestSignal?.aborted).toBe(true);
  });
});
