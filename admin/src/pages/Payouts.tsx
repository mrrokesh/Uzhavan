import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { inr, when } from "../lib/format";
import { Badge, Card, Field, Modal, NoAccess, Spinner } from "../components/ui";
import type { AdminPayout, PayoutList, PayoutState } from "../lib/types";

const STATE_TONE: Record<PayoutState, "green" | "amber" | "red" | "blue" | "grey"> = {
  HELD: "amber",
  RELEASED: "blue",
  PAID: "green",
  FAILED: "red",
  CANCELLED: "grey",
};

const STATE_LABEL: Record<PayoutState, string> = {
  HELD: "Waiting",
  RELEASED: "Sent",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const FILTERS: { key: PayoutState | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "HELD", label: "Waiting" },
  { key: "RELEASED", label: "Sent" },
  { key: "PAID", label: "Paid" },
  { key: "FAILED", label: "Failed" },
];

/** Due, but the sweeper hasn't got to it yet. */
function isDue(p: AdminPayout): boolean {
  return p.state === "HELD" && !!p.releaseAfter && new Date(p.releaseAfter) <= new Date();
}

export function Payouts() {
  const { can, session } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<PayoutState | "ALL">("ALL");
  const [acting, setActing] = useState<{ payout: AdminPayout; action: "release" | "hold" } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!session?.isAdmin;

  const list = useQuery({
    queryKey: ["payouts", filter],
    queryFn: () =>
      api<PayoutList>(`/admin/payouts${filter === "ALL" ? "" : `?state=${filter}`}`),
    enabled: can("ORDERS_VIEW"),
    refetchInterval: 60_000,
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ["payouts"] });
    setActing(null);
    setNote("");
    setError(null);
  };

  const override = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "release" | "hold" }) =>
      api(`/admin/payouts/${id}/override`, {
        method: "POST",
        body: { action, ...(note.trim() ? { note: note.trim() } : {}) },
      }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const sweep = useMutation({
    mutationFn: () => api<{ released: number }>("/admin/payouts/sweep", { method: "POST" }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  if (!can("ORDERS_VIEW")) return <NoAccess what="see farmer payouts" />;

  const rows = list.data?.payouts ?? [];
  const waiting = rows.filter((p) => p.state === "HELD");
  const owed = waiting.reduce((sum, p) => sum + p.amount, 0);
  const failed = rows.filter((p) => p.state === "FAILED");
  const noAccount = waiting.filter((p) => !p.farmer.hasAccount);

  return (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h1>Farmer payouts</h1>
          <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
            Buyers pay the full amount up front and the gateway holds it. These rows decide when
            each farmer sees their share.
          </p>
        </div>
        {isAdmin ? (
          <button className="btn-ghost" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
            {sweep.isPending ? "Running…" : "Release everything due"}
          </button>
        ) : null}
      </div>

      {error ? <p className="err">{error}</p> : null}

      {list.data ? (
        <Card>
          <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="small muted">Policy</div>
              <b>
                {list.data.policy === "SPLIT_ON_LOAD"
                  ? `${list.data.advancePercent}% on loading, rest after delivery`
                  : "Nothing until delivered"}
              </b>
            </div>
            <div>
              <div className="small muted">Hold after delivery</div>
              <b>{list.data.holdHours}h</b>
            </div>
            <div>
              <div className="small muted">Waiting to go out</div>
              <b>{inr(owed)}</b>
            </div>
          </div>
        </Card>
      ) : null}

      {noAccount.length > 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            <Badge tone="amber">Check this</Badge> {noAccount.length} payout
            {noAccount.length === 1 ? "" : "s"} belong to farmers with no bank account set up. They
            will fail when they come due — ask them to add one in the app.
          </p>
        </Card>
      ) : null}

      {failed.length > 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            <Badge tone="red">Failed</Badge> {failed.length} payout
            {failed.length === 1 ? "" : "s"} could not be sent. The reason is on each row.
          </p>
        </Card>
      ) : null}

      <div className="row" style={{ gap: 6, margin: "16px 0 10px" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? "btn btn-sm" : "btn-ghost btn-sm"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Nothing here. Payouts appear once a buyer has paid for an order.
          </p>
        </Card>
      ) : (
        <Card padded={false}>
          <table>
            <thead>
              <tr>
                <th>Farmer</th>
                <th>Order</th>
                <th style={{ width: 190 }}>Stage</th>
                <th style={{ width: 110 }}>Amount</th>
                <th style={{ width: 190 }}>When</th>
                {isAdmin ? <th style={{ width: 170 }} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.farmer.name}</strong>
                    {p.farmer.verified ? null : (
                      <>
                        {" "}
                        <Badge tone="grey">Unverified</Badge>
                      </>
                    )}
                    {!p.farmer.hasAccount ? (
                      <div className="small" style={{ color: "var(--danger)", marginTop: 3 }}>
                        No bank account
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <code className="small">{p.order?.code ?? "—"}</code>
                    <div className="small muted" style={{ marginTop: 3 }}>
                      {p.order?.product ?? ""}
                    </div>
                  </td>
                  <td>
                    {p.stageLabel}
                    <div className="small muted" style={{ marginTop: 3 }}>
                      {p.note ?? ""}
                    </div>
                  </td>
                  <td>
                    <b>{inr(p.amount)}</b>
                  </td>
                  <td>
                    <Badge tone={STATE_TONE[p.state]}>{STATE_LABEL[p.state]}</Badge>
                    <div className="small muted" style={{ marginTop: 3 }}>
                      {p.state === "PAID"
                        ? when(p.paidAt)
                        : p.state === "RELEASED"
                          ? when(p.releasedAt)
                          : p.state === "HELD"
                            ? p.releaseAfter
                              ? isDue(p)
                                ? "Due now"
                                : `Due ${when(p.releaseAfter)}`
                              : "Waiting on the driver"
                            : ""}
                    </div>
                    {p.failureReason ? (
                      <div className="small" style={{ color: "var(--danger)", marginTop: 3 }}>
                        {p.failureReason}
                      </div>
                    ) : null}
                  </td>
                  {isAdmin ? (
                    <td>
                      {p.state === "HELD" ? (
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => {
                              setActing({ payout: p, action: "release" });
                              setNote("");
                            }}
                          >
                            Release
                          </button>
                          {p.releaseAfter ? (
                            <button
                              className="btn-danger btn-sm"
                              onClick={() => {
                                setActing({ payout: p, action: "hold" });
                                setNote("");
                              }}
                            >
                              Hold
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!isAdmin ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          You can see payouts but not move them. Releasing or holding money is administrator-only.
        </p>
      ) : null}

      {acting ? (
        <Modal
          title={acting.action === "release" ? "Release this payout early" : "Hold this payout"}
          onClose={() => setActing(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setActing(null)}>
                Cancel
              </button>
              <button
                className={acting.action === "release" ? "btn" : "btn-danger"}
                disabled={override.isPending}
                onClick={() => override.mutate({ id: acting.payout.id, action: acting.action })}
              >
                {override.isPending
                  ? "Working…"
                  : acting.action === "release"
                    ? `Send ${inr(acting.payout.amount)}`
                    : "Hold it back"}
              </button>
            </>
          }
        >
          <p className="small">
            {acting.action === "release" ? (
              <>
                {inr(acting.payout.amount)} goes to <b>{acting.payout.farmer.name}</b> now, before
                it was due. This can’t be undone — the money leaves the gateway.
              </>
            ) : (
              <>
                {inr(acting.payout.amount)} for <b>{acting.payout.farmer.name}</b> stops being due.
                It will sit here until an administrator releases it by hand.
              </>
            )}
          </p>
          <Field
            label="Reason"
            hint="Recorded in the audit log against your name. Write it for whoever reads this in six months."
          >
            <input
              value={note}
              autoFocus
              placeholder={
                acting.action === "release"
                  ? "Farmer confirmed delivery by phone, buyer unreachable"
                  : "Buyer reports the load was short — investigating"
              }
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {error ? <p className="err">{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
