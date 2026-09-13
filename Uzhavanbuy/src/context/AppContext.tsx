import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type FilterChip = "for-you" | "ready" | "upcoming" | "following";

/**
 * Buyer browsing state only. Everything transactional — requests, orders,
 * bookings, trip status — lives on the server and is read through
 * `src/api/hooks.ts`, so nothing here can drift out of sync with the database.
 */
type AppState = {
  filter: FilterChip;
  setFilter: (f: FilterChip) => void;
  search: string;
  setSearch: (s: string) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<FilterChip>("for-you");
  const [search, setSearch] = useState("");

  const value = useMemo<AppState>(
    () => ({ filter, setFilter, search, setSearch }),
    [filter, search],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
