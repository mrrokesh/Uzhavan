import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { titleCase, when } from "../lib/format";
import { Card, Empty, Field, KycBadge, Modal, NoAccess, Spinner, StatusBadge } from "../components/ui";
import type { AccountRow, AccountStatus } from "../lib/types";

export function Accounts() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [verification, setVerification] = useState("");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<AccountRow | null>(null);
  const [nextStatus, setNextStatus] = useState<AccountStatus>("BLOCKED");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["accounts", role, status, verification, q],
    queryFn: () => {
      const p = new URLSearchParams();
      if (role) p.set("role", role);
      if (status) p.set("status", status);
      if (verification) p.set("verification", verification);
      if (q.trim()) p.set("q", q.trim());
      return api<AccountRow[]>(`/admin/users${p.toString() ? `?${p}` : ""}`);
    },
    enabled: can("USERS_VIEW"),
  });

  const change = useMutation({
    mutationFn: ({ id, status: s, reason: r }: { id: string; status: AccountStatus; reason?: string }) =>
      api(`/admin/users/${id}/status`, { method: "POST", body: { status: s, reason: r } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setTarget(null);
      setReason("");
      setError(null);
    },
    onError: (err) => setError(errorText(err)),
  });

  if (!can("USERS_VIEW")) return <NoAccess what="view accounts" />;

  const rows = accounts.data ?? [];
  const moderating = can("USERS_MODERATE");

  const open = (row: AccountRow, to: AccountStatus) => {
    setTarget(row);
    setNextStatus(to);
    setReason("");
    setError(null);
  };

  return (
    <>
      <h1>Accounts</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Block a seller who takes an order and never delivers, or a driver who abandons a trip. They
        see the reason you give, so write it for them.
      </p>

      <div className="row" style={{ marginBottom: 14 }}>
        <input
          className="grow"
          style={{ maxWidth: 300 }}
          placeholder="Search name, email, phone, business…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select style={{ width: 150 }} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="BUYER">Buyers</option>
          <option value="FARMER">Farmers</option>
          <option value="DRIVER">Drivers</option>
        </select>
        <select style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BLOCKED">Blocked</option>
        </select>
        <select style={{ width: 170 }} value={verification} onChange={(e) => setVerification(e.target.value)}>
          <option value="">Any verification</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <Card padded={false}>
        {accounts.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No accounts match those filters.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verification</th>
                <th>Activity</th>
                <th>Joined</th>
                {moderating ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.business ?? u.farmName ?? u.name}</b>
                    <span className="sub">
                      {u.name} · {u.email}
                    </span>
                  </td>
                  <td>
                    {titleCase(u.role)}
                    <span className="sub">{u.district ?? "—"}</span>
                  </td>
                  <td>
                    <StatusBadge status={u.status} />
                    {u.statusReason ? <span className="sub">{u.statusReason}</span> : null}
                  </td>
                  <td>
                    <KycBadge status={u.verification} />
                  </td>
                  <td className="muted small">
                    {u.role === "DRIVER"
                      ? `${u.driver?.trips ?? 0} trips${u.driver?.online ? " · online" : ""}`
                      : `${u.orderCount} orders · ${u.requestCount} requests`}
                  </td>
                  <td className="muted">{when(u.createdAt)}</td>
                  {moderating ? (
                    <td>
                      <div className="row">
                        {u.status === "ACTIVE" ? (
                          <>
                            <button className="btn-ghost btn-sm" onClick={() => open(u, "SUSPENDED")}>
                              Suspend
                            </button>
                            <button className="btn-danger btn-sm" onClick={() => open(u, "BLOCKED")}>
                              Block
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-sm" onClick={() => open(u, "ACTIVE")}>
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {target ? (
        <Modal
          title={
            nextStatus === "ACTIVE"
              ? `Restore ${target.name}`
              : `${nextStatus === "BLOCKED" ? "Block" : "Suspend"} ${target.name}`
          }
          onClose={() => setTarget(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setTarget(null)}>
                Cancel
              </button>
              <button
                className={nextStatus === "ACTIVE" ? "btn" : "btn-danger"}
                disabled={change.isPending}
                onClick={() =>
                  change.mutate({
                    id: target.id,
                    status: nextStatus,
                    reason: nextStatus === "ACTIVE" ? undefined : reason.trim(),
                  })
                }
              >
                {change.isPending
                  ? "Saving…"
                  : nextStatus === "ACTIVE"
                    ? "Restore access"
                    : `${nextStatus === "BLOCKED" ? "Block" : "Suspend"} account`}
              </button>
            </>
          }
        >
          {nextStatus === "ACTIVE" ? (
            <p className="muted">
              {target.name} will be able to sign in again immediately.
              {target.role === "DRIVER"
                ? " They'll need to switch themselves back online before receiving trips."
                : ""}
            </p>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 14 }}>
                They’ll be signed out at once — any session already open stops working on the next
                request.
                {target.role === "DRIVER" ? " Their truck is taken offline." : ""}
                {target.role === "FARMER" ? " Their listings are hidden from buyers." : ""}
              </p>
              <Field label="Reason" hint="Shown to them when they try to sign in.">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Accepted an order and never delivered the crop"
                  autoFocus
                />
              </Field>
            </>
          )}
          {error ? (
            <p className="err" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
