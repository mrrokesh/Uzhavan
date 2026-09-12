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
  token: string | null;
  user: ApiUser | null;
  role: Role | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);

  const apply = useCallback(
    async (session: AuthSession) => {
      await saveToken(session.token);
      setToken(session.token);
      setUser(session.user);
      qc.clear();
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadToken();
      if (!stored) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const data = await api<{ user: ApiUser }>("/auth/me");
        if (cancelled) return;
        setToken(stored);
        setUser(data.user);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          await clearToken();
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    () => ({ ready, token, user, role: user?.role ?? null, signIn, signUp, signOut }),
    [ready, token, user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
