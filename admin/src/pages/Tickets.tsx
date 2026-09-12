import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fullDate, hoursSince, titleCase, when } from "../lib/format";
import {
  Card,
  Empty,
  Modal,
  NoAccess,
  PriorityBadge,
  Spinner,
  TicketBadge,
} from "../components/ui";
import type { StaffRow, TicketDetail, TicketRow, TicketStatus } from "../lib/types";

const STATUSES: TicketStatus[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_ON_USER",
  "RESOLVED",
  "CLOSED",
];

export function Tickets() {
  const { can, session } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const openCode = params.get("open");
  const [filter, setFilter] = useState<"all" | "mine" | "unassigned">("all");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: ["tickets", filter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filter === "mine") p.set("mine", "true");
      if (filter === "unassigned") p.set("unassigned", "true");
      return api<TicketRow[]>(`/tickets/desk/queue${p.toString() ? `?${p}` : ""}`);
    },
    enabled: can("TICKETS_VIEW"),
    refetchInterval: 20_000,
  });

  const detail = useQuery({
    queryKey: ["ticket", openCode],
    queryFn: () => api<TicketDetail>(`/tickets/${openCode}`),
    enabled: !!openCode && can("TICKETS_VIEW"),
    refetchInterval: 15_000,
  });

  const staff = useQuery({
    queryKey: ["staff-lite"],
    queryFn: () => api<StaffRow[]>("/admin/staff"),
    enabled: can("ADMIN_STAFF_MANAGE"),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["ticket"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };

  const send = useMutation({
    mutationFn: () =>
      api(`/tickets/${openCode}/reply`, { method: "POST", body: { body: reply.trim(), internal } }),
    onSuccess: () => {
      setReply("");
      setInternal(false);
      setError(null);
      refresh();
    },
    onError: (err) => setError(errorText(err)),
  });

  const setStatus = useMutation({
    mutationFn: (status: TicketStatus) =>
      api(`/tickets/desk/${openCode}/status`, { method: "POST", body: { status } }),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err)),
  });

  const assign = useMutation({
    mutationFn: (staffId: string | null) =>
      api(`/tickets/desk/${openCode}/assign`, { method: "POST", body: { staffId } }),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err)),
  });

  if (!can("TICKETS_VIEW")) return <NoAccess what="view support tickets" />;

  const rows = queue.data ?? [];
  const t = detail.data;

  return (
    <>
      <h1>Support</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        New tickets are assigned automatically by workload. Anything left unanswered is force-assigned
        within 24 hours.
      </p>

      <div className="row" style={{ marginBottom: 14 }}>
        {(
          [
            ["all", "All open"],
            ["mine", "Mine"],
            ["unassigned", "Unassigned"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? "btn btn-sm" : "btn-ghost btn-sm"}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {queue.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>Nothing here. Good sign.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Raised by</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const stale = !row.assignedTo && hoursSince(row.createdAt) > 12;
                return (
                  <tr
                    key={row.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setParams({ open: row.code })}
                  >
                    <td>
                      <span className="mono">{row.code}</span>
                      <span className="sub">{row.subject}</span>
                    </td>
                    <td>
                      {row.raisedBy.business ?? row.raisedBy.name}
                      <span className="sub">
                        {titleCase(row.raisedBy.role)} · {row.raisedBy.phone}
                      </span>
                    </td>
                    <td className="muted">{titleCase(row.category)}</td>
                    <td>
                      <PriorityBadge priority={row.priority} />
                      {row.escalatedAt ? (
                        <span className="sub" style={{ color: "var(--danger)" }}>
                          escalated
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <TicketBadge status={row.status} />
                    </td>
                    <td>
                      {row.assignedTo?.name ?? (
                        <span style={{ color: stale ? "var(--danger)" : "var(--faint)" }}>
                          Nobody
                        </span>
                      )}
                    </td>
                    <td className="muted">{when(row.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {openCode ? (
        <Modal
          wide
          title={t ? `${t.code} · ${t.subject}` : openCode}
          onClose={() => {
            setParams({});
            setError(null);
          }}
        >
          {detail.isLoading || !t ? (
            <Spinner />
          ) : (
            <>
              <div className="row" style={{ marginBottom: 14 }}>
                <PriorityBadge priority={t.priority} />
                <TicketBadge status={t.status} />
                <span className="small muted">
                  {titleCase(t.category)} · raised {fullDate(t.createdAt)}
                </span>
                {t.escalatedAt ? (
                  <span className="badge red">Escalated {when(t.escalatedAt)}</span>
                ) : null}
              </div>

              <div className="stats" style={{ marginBottom: 16 }}>
                <div className="stat">
                  <div className="l">Raised by</div>
                  <div style={{ fontWeight: 600, marginTop: 3 }}>
                    {t.raisedBy.business ?? t.raisedBy.name}
                  </div>
                  <div className="small muted">
                    {titleCase(t.raisedBy.role)} · {t.raisedBy.phone}
                  </div>
                  <div className="small muted">{t.raisedBy.email}</div>
                </div>
                <div className="stat">
                  <div className="l">Assigned to</div>
                  <div style={{ fontWeight: 600, marginTop: 3 }}>
                    {t.assignedTo?.name ?? "Nobody"}
                  </div>
                  {t.orderCode ? (
                    <div className="small muted mono">Order {t.orderCode}</div>
                  ) : null}
                </div>
              </div>

              <h3 style={{ marginBottom: 9 }}>Conversation</h3>
              <div className="thread">
                {t.messages.map((m) => {
                  const isStaff = m.author.role === "STAFF" || m.author.role === "ADMIN";
                  return (
                    <div
                      key={m.id}
                      className={`msg${m.internal ? " internal" : isStaff ? " staff" : ""}`}
                    >
                      <div className="who">
                        {m.author.name}
                        {m.internal ? " · internal note" : ""} · {when(m.createdAt)}
                      </div>
                      <div className="body">{m.body}</div>
                    </div>
                  );
                })}
              </div>

              {can("TICKETS_RESPOND") && t.status !== "CLOSED" ? (
                <div style={{ marginTop: 16 }}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={
                      internal
                        ? "A note for the team — the customer never sees this."
                        : "Write your reply…"
                    }
                  />
                  <div className="row" style={{ marginTop: 9 }}>
                    <label
                      className="row small"
                      style={{ gap: 6, margin: 0, cursor: "pointer", fontWeight: 500 }}
                    >
                      <input
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={internal}
                        onChange={(e) => setInternal(e.target.checked)}
                      />
                      Internal note
                    </label>
                    <div className="grow" />
                    <button
                      className="btn"
                      disabled={send.isPending || reply.trim().length === 0}
                      onClick={() => send.mutate()}
                    >
                      {send.isPending ? "Sending…" : internal ? "Save note" : "Send reply"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div
                className="row"
                style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}
              >
                <div>
                  <label>Status</label>
                  <select
                    style={{ width: 175 }}
                    value={t.status}
                    onChange={(e) => setStatus.mutate(e.target.value as TicketStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {titleCase(s)}
                      </option>
                    ))}
                  </select>
                </div>

                {can("TICKETS_ASSIGN") ? (
                  <div>
                    <label>Assigned to</label>
                    <select
                      style={{ width: 200 }}
                      value={t.assignedTo?.id ?? ""}
                      onChange={(e) => assign.mutate(e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {(staff.data ?? [])
                        .filter((s) => s.status === "ACTIVE")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.openTickets})
                          </option>
                        ))}
                      {!can("ADMIN_STAFF_MANAGE") && session ? (
                        <option value={session.id}>{session.name} (me)</option>
                      ) : null}
                    </select>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="err" style={{ marginTop: 12 }}>
                  {error}
                </p>
              ) : null}
            </>
          )}
        </Modal>
      ) : null}
    </>
  );
}
