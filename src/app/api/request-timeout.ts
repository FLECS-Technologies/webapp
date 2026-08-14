export const STANDARD_REQUEST_TIMEOUT_MS = 15_000;
export const LONG_REQUEST_TIMEOUT_MS = 10 * 60_000;
export const REQUEST_TIMEOUT_MESSAGE = 'Request timed out. Check the connection and try again.';

export type TimedRequestInit = RequestInit & { timeout?: number };

/** Preserve Orval/TanStack cancellation while enforcing the global request deadline. */
export function withRequestTimeout(
  signal?: AbortSignal,
  timeout = STANDARD_REQUEST_TIMEOUT_MS,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeout);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}
