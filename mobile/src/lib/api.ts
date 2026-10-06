import { apiBaseUrl } from './config';
import { storage } from './storage';

const TOKEN_KEY = 'ft.token';
let token: string | null = null;

/** Loads the saved session once at startup. */
export async function loadToken(): Promise<string | null> {
  token = await storage.get(TOKEN_KEY);
  return token;
}

export function getToken(): string | null {
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  await storage.set(TOKEN_KEY, next);
}

export const OFFLINE = 'Can’t reach Fintrack. Check your connection and try again.';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

/** The same JSON API the web app uses, with the session as a bearer token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const sent = token;
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: {
        accept: 'application/json',
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(sent ? { authorization: `Bearer ${sent}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  if (res.status === 401 && sent) onUnauthorized();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!data && [502, 503, 504].includes(res.status)) throw new ApiError(0, OFFLINE);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
