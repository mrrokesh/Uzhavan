import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { inr, when } from "../lib/format";
import { Card, PriorityBadge, Spinner, TicketBadge } from "../components/ui";
import type { Overview as OverviewData, TicketRow } from "../lib/types";

export function Overview() {
  const { session, can } = useAuth();

  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => api<OverviewData>("/admin/overview"),
    refetchInterval: 30_000,
  });

  const urgent = useQuery({
    queryKey: ["tickets", "urgent"],
    queryFn: () => api<TicketRow[]>("/tickets/desk/queue"),
    enabled: can("TICKETS_VIEW"),
    refetchInterval: 30_000,
  });

  if (overview.isLoading) return <Spinner />;
  const d = overview.data;

  const attention = (urgent.data ?? [])
    .filter((t) => t.escalatedAt || t.priority === "URGENT" || t.priority === "HIGH")
    .slice(0, 6);

  return (
    <>
      <h1>Good to see you, {session?.name.split(" ")[0]}</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 20 }}>
        Here’s what needs attention across the marketplace.
      </p>

      <div className="stats">
        <div className={`stat${(d?.pendingKyc ?? 0) > 0 ? " warn" : ""}`}>
          <div className="n">{d?.pendingKyc ?? 0}</div>
          <div className="l">Awaiting verification</div>
        </div>
        <div className={`stat${(d?.unassignedTickets ?? 0) > 0 ? " bad" : ""}`}>
          <div className="n">{d?.unassignedTickets ?? 0}</div>
          <div className="l">Unassigned tickets</div>
        </div>
        <div className="stat">
          <div className="n">{d?.openTickets ?? 0}</div>
          <div className="l">Open tickets</div>
        </div>
        <div className={`stat${(d?.blocked ?? 0) > 0 ? " bad" : ""}`}>
          <div className="n">{d?.blocked ?? 0}</div>
          <div className="l">Blocked accounts</div>
        </div>
      </div>

      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="n">{d?.users?.FARMER ?? 0}</div>
          <div className="l">Farmers</div>
        </div>
        <div className="stat">
          <div className="n">{d?.users?.BUYER ?? 0}</div>
          <div className="l">Buyers</div>
        </div>
        <div className="stat">
          <div className="n">{d?.users?.DRIVER ?? 0}</div>
          <div className="l">Drivers</div>
        </div>
        <div className="stat">
          <div className="n">{d?.orderCount ?? 0}</div>
          <div className="l">Orders placed</div>
        </div>
        <div className="stat">
          <div className="n">{inr(d?.gmv ?? 0)}</div>
          <div className="l">Order value</div>
        </div>
      </div>

      {can("TICKETS_VIEW") ? (
        <div style={{ marginTop: 20 }}>
          <Card
            title="Needs a look"
            padded={false}
            action={<Link to="/tickets" className="small">All tickets →</Link>}
          >
            {attention.length === 0 ? (
              <div className="empty">Nothing urgent. Queue is under control.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Raised by</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link to={`/tickets?open=${t.code}`} className="mono">
                          {t.code}
                        </Link>
                        <span className="sub">{t.subject}</span>
                      </td>
                      <td>
                        {t.raisedBy.business ?? t.raisedBy.name}
                        <span className="sub">{t.raisedBy.role.toLowerCase()}</span>
                      </td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                        {t.escalatedAt ? (
                          <span className="sub" style={{ color: "var(--danger)" }}>
                            escalated
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <TicketBadge status={t.status} />
                      </td>
                      <td>{t.assignedTo?.name ?? <span className="faint">Nobody</span>}</td>
                      <td className="muted">{when(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
