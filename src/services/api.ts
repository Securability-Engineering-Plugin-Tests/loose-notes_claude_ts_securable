// Base API client — trust boundary between frontend and backend
// Applies: request sanitization, auth headers, structured error handling
// FIASSE: canonical response parsing, no secrets in error output

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Token stored in memory (not localStorage) to reduce XSS surface
// httpOnly cookie handles persistence; this is for Bearer header fallback
let _memoryToken: string | null = null;

export function setMemoryToken(token: string | null): void {
  _memoryToken = token;
}

export function getMemoryToken(): string | null {
  return _memoryToken;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

// Generic fetch wrapper — canonicalize request, parse response envelope
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } }> {
  const { method = 'GET', body, signal } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (_memoryToken) {
    headers['Authorization'] = `Bearer ${_memoryToken}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include', // send httpOnly cookie
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

    // Parse JSON safely — handle non-JSON responses
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { ok: false, error: { code: 'PARSE_ERROR', message: 'Server returned an invalid response' } };
    }

    // Validate response shape — never trust server shape blindly
    if (typeof json !== 'object' || json === null || !('ok' in json)) {
      return { ok: false, error: { code: 'INVALID_RESPONSE', message: 'Unexpected response format' } };
    }

    return json as { ok: true; data: T } | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: { code: 'ABORTED', message: 'Request was cancelled' } };
    }
    // Network error — safe message only, no internal details
    return { ok: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Check your connection.' } };
  }
}
