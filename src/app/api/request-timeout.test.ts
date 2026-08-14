import { describe, expect, it, vi } from 'vitest';
import {
  LONG_REQUEST_TIMEOUT_MS,
  STANDARD_REQUEST_TIMEOUT_MS,
  withRequestTimeout,
} from './request-timeout';

describe('withRequestTimeout', () => {
  it('uses the standard request deadline by default', () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal);

    const signal = withRequestTimeout();

    expect(signal).toBe(timeoutSignal);
    expect(timeout).toHaveBeenCalledWith(STANDARD_REQUEST_TIMEOUT_MS);
    expect(STANDARD_REQUEST_TIMEOUT_MS).toBe(15_000);
    timeout.mockRestore();
  });

  it('supports the long-operation deadline and preserves upstream cancellation', () => {
    const controller = new AbortController();
    const timeoutSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal);
    const signal = withRequestTimeout(controller.signal, LONG_REQUEST_TIMEOUT_MS);

    controller.abort();

    expect(timeout).toHaveBeenCalledWith(LONG_REQUEST_TIMEOUT_MS);
    expect(LONG_REQUEST_TIMEOUT_MS).toBe(600_000);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(controller.signal.reason);
    timeout.mockRestore();
  });
});
