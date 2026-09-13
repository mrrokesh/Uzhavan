import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken } from "./api";
import type { Permission, Session } from "./types";

type AuthState = {
  ready: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  /** Admins implicitly hold everything, so this mirrors the server's rule. */
  can: (permission: Permission) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<Session>("/admin/me")
      .then(setSession)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(res.token);
    try {
      setSession(await api<Session>("/admin/me"));
    } catch (err) {
      // A valid marketplace login that isn't staff must not leave a token behind.
      setToken(null);
      throw err;
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setSession(null);
  }, []);

  const can = useCallback(
    (permission: Permission) =>
      !!session && (session.isAdmin || session.permissions.includes(permission)),
    [session],
  );

  const value = useMemo(
    () => ({ ready, session, signIn, signOut, can }),
    [ready, session, signIn, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
