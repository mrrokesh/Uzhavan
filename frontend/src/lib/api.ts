const KEY = "uzhavan.admin.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode — the session just won't survive a reload */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

/**
 * Where the API lives.
 *
 * Empty by default, which makes every call same-origin: Vite proxies /api in
 * dev, and behind a reverse proxy in production the console and the API share
 * a host. Same-origin is the better shape — no CORS to configure and no bearer
 * token crossing origins.
 *
 * Set VITE_API_URL at build time when the console is hosted somewhere that
 * can't proxy, such as a static host on a different domain. Then the API needs
 * CORS_ORIGIN set to this console's origin.
 */
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const fromBody =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null;
    const message = fromBody || `Request failed (${res.status})`;
    // An expired or revoked session should drop straight back to sign-in.
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/**
 * KYC documents need the Authorization header, so an <img src> can't fetch
 * them directly — pull the bytes and hand back an object URL instead.
 */
export async function fetchDocument(id: string): Promise<{ url: string; type: string }> {
  const res = await fetch(`${BASE}/api/verification/documents/${id}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok) throw new ApiError(res.status, "Couldn't load that document");
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
