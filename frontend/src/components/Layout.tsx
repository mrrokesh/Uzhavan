import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Overview } from "../lib/types";

function Leaf() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
      <path d="M16 26c0-8 5-12 11-13-1 7-5 11-11 13z" fill="#1B5E3B" />
      <path d="M16 26c0-9-6-14-12-15 3 8 6 13 12 15z" fill="#4B8B63" />
    </svg>
  );
}

export function Layout() {
  const { session, signOut, can } = useAuth();

  // Drives the counters in the sidebar. Kept light and polled so a queue
  // building up is visible without anyone refreshing.
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => api<Overview>("/admin/overview"),
    refetchInterval: 30_000,
  });

  const pendingKyc = overview.data?.pendingKyc ?? 0;
  const openTickets = overview.data?.openTickets ?? 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Leaf />
          <div>
            Uzhavan
            <small>Console</small>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/" end>
            Overview
          </NavLink>

          <div className="nav-section">Operations</div>
          {can("KYC_REVIEW") && (
            <NavLink to="/verification">
              Verification
              {pendingKyc > 0 && <span className="count">{pendingKyc}</span>}
            </NavLink>
          )}
          {can("TICKETS_VIEW") && (
            <NavLink to="/tickets">
              Support
              {openTickets > 0 && <span className="count">{openTickets}</span>}
            </NavLink>
          )}
          {can("USERS_VIEW") && <NavLink to="/accounts">Accounts</NavLink>}
          {can("ORDERS_VIEW") && <NavLink to="/tracking">Track a vehicle</NavLink>}
          {can("ORDERS_VIEW") && <NavLink to="/payouts">Farmer payouts</NavLink>}

          <div className="nav-section">Platform</div>
          <NavLink to="/settings">Settings</NavLink>
          {can("CONFIG_WRITE") && <NavLink to="/announcements">Announcements</NavLink>}
          <NavLink to="/releases">App updates</NavLink>
          {session?.isAdmin && <NavLink to="/payments">Payments</NavLink>}
          {can("ADMIN_STAFF_MANAGE") && <NavLink to="/staff">Staff</NavLink>}
          {can("ADMIN_AUDIT_VIEW") && <NavLink to="/audit">Audit log</NavLink>}
        </nav>

        <div className="sidebar-foot">
          <div className="row">
            <div className="grow who">
              {session?.name}
              <span>{session?.isAdmin ? "Administrator" : "Support staff"}</span>
            </div>
            <button className="btn-ghost btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
