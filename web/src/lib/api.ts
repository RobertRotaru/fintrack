const TOKEN_KEY = 'ft.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session lasts until reload */
  }
}

export const OFFLINE = "Can't reach the server. Check your connection and try again.";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  if (res.status === 401 && token) onUnauthorized();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  // A gateway error without our JSON body means the API itself is unreachable.
  if (!data && [502, 503, 504].includes(res.status)) throw new ApiError(0, OFFLINE);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
