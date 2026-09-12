import Constants from "expo-constants";
import { getToken } from "./session";

/**
 * Resolve the API base URL:
 *  1. `EXPO_PUBLIC_API_URL` env var (set it for staging / production), else
 *  2. the Metro host the app was served from, on port 4000 (local dev on a
 *     phone or simulator talking to the server on your machine), else
 *  3. http://localhost:4000 (web / last resort).
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:4000`;

  return "http://localhost:4000";
}

export const API_BASE_URL = resolveBaseUrl();

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
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const issue = Array.isArray(data?.issues) ? data.issues[0]?.message : undefined;
    const message = issue || (data && (data.error as string)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}
