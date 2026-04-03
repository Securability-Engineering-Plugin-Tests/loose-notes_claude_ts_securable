/**
 * Base API client.
 *
 * SSEM: Authenticity — includes CSRF token on all mutating requests.
 * SSEM: Resilience — handles network errors and API error responses uniformly.
 *
 * The CSRF token is read from the in-memory store (set at login) rather than
 * from localStorage to reduce XSS-accessible token exposure.
 */

let csrfToken: string | null = null;

/** Set the CSRF token after login. */
export function setCsrfToken(token: string): void {
  csrfToken = token;
}

/** Clear the CSRF token on logout. */
export function clearCsrfToken(): void {
  csrfToken = null;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Include CSRF token on all state-changing requests
  const mutating = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (mutating.includes(method) && csrfToken) {
    requestHeaders['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers: requestHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: 'same-origin', // Include httpOnly cookies
  });

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const data = await response.json().catch(() => ({ message: 'Network error', code: 'NETWORK_ERROR' }));

  if (!response.ok) {
    throw new ApiError(response.status, data.code ?? 'UNKNOWN', data.message ?? 'An error occurred');
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', headers }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
