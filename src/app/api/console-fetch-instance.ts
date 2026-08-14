import { FetchError } from './fetch-error';
import { type TimedRequestInit, withRequestTimeout } from './request-timeout';

const BASE_URL = import.meta.env.VITE_CONSOLE_URL || 'https://console.flecs.tech';

export const customInstance = async <T>(url: string, options?: TimedRequestInit): Promise<T> => {
  const { timeout, signal, ...requestOptions } = options ?? {};
  // Only force JSON Content-Type for string bodies. FormData/Blob need the
  // browser to set multipart/octet-stream with the correct boundary.
  const isJsonBody = typeof requestOptions.body === 'string';
  const response = await fetch(`${BASE_URL}${url}`, {
    ...requestOptions,
    headers: {
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(requestOptions.headers as Record<string, string>),
    },
    signal: withRequestTimeout(signal, timeout),
  });

  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new FetchError(response.status, data, response.headers);
  }

  return { data, status: response.status, headers: response.headers } as T;
};

// Orval reads these exports to wire up TError/TBody in generated hooks
export type ErrorType<E> = FetchError<E>;
export type BodyType<B> = B;

export default customInstance;
