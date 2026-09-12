import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiUser, AuthSession, Role } from "../api/types";
import { ApiError, api } from "../lib/api";
import { clearToken, loadToken, saveToken } from "../lib/session";

export type BuyerRegistration = {
  role: "BUYER";
  email: string;
  password: string;
  name: string;
  phone: string;
  business: string;
  district: string;
  warehouse?: string;
};

export type FarmerRegistration = {
  role: "FARMER";
  email: string;
  password: string;
  name: string;
  phone: string;
  farmName: string;
  district: string;
  location: string;
};

export type DriverRegistration = {
  role: "DRIVER";
  email: string;
  password: string;
  name: string;
  phone: string;
  truckName: string;
  plate: string;
  capacityTons: number;
  body: "Open body" | "Closed body";
  price: number;
};

export type RegisterInput = BuyerRegistration | FarmerRegistration | DriverRegistration;

type AuthState = {
  ready: boolean;
  /** Held a token but couldn't reach the server to confirm who it belongs to. */
  offline: boolean;
  token: string | null;
  user: ApiUser | null;
  role: Role | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
};

/** Tries before giving up on the startup /auth/me, and how long to wait between. */
const BOOT_TRIES = 3;
const BOOT_BACKOFF_MS = [400, 1200];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);

  const apply = useCallback(
    async (session: AuthSession) => {
      await saveToken(session.token);
      setToken(session.token);
      setUser(session.user);
      setOffline(false);
      qc.clear();
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    setOffline(false);
    qc.clear();
  }, [qc]);

  /** Ask again after a failed startup check — the Reconnect screen's button. */
  const retry = useCallback(() => {
    setReady(false);
    setOffline(false);
    setAttempt((n) => n + 1);
  }, []);

  /**
   * Restore the stored session on launch.
   *
   * The distinction that matters: 401/404 means the token is genuinely dead, so
   * bin it and show the login screen. Anything else — no signal, DNS, a 5xx,
   * a timeout — means we simply don't know yet, and logging someone out over a
   * blip is wrong. loadToken() has already armed the api layer with the token
   * by this point, so a silent give-up would leave the UI signed out while
   * every request still went out authenticated.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadToken();
      if (!stored) {
        if (!cancelled) setReady(true);
        return;
      }

      for (let i = 0; i < BOOT_TRIES; i++) {
        try {
          const data = await api<{ user: ApiUser }>("/auth/me");
          if (cancelled) return;
          setToken(stored);
          setUser(data.user);
          setOffline(false);
          setReady(true);
          return;
        } catch (err) {
          if (cancelled) return;
          if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
            await clearToken();
            if (!cancelled) setReady(true);
            return;
          }
          if (i < BOOT_TRIES - 1) await sleep(BOOT_BACKOFF_MS[i] ?? 1200);
        }
      }

      // Still can't tell. Keep the session and say so, rather than pretending
      // they're logged out.
      if (!cancelled) {
        setOffline(true);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await apply(
        await api<AuthSession>("/auth/login", { method: "POST", body: { email, password } }),
      );
    },
    [apply],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      await apply(await api<AuthSession>("/auth/register", { method: "POST", body: input }));
    },
    [apply],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      offline,
      token,
      user,
      role: user?.role ?? null,
      signIn,
      signUp,
      signOut,
      retry,
    }),
    [ready, offline, token, user, signIn, signUp, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
