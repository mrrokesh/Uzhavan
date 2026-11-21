import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { inr, when } from "../lib/format";
import { Card, Empty, Field, Modal, NoAccess, Spinner } from "../components/ui";

type PendingTruck = {
  id: string;
  code: string;
  total: number;
  pickup: string;
  destination: string;
  paidAt: string | null;
  driver: { name: string } | null;
  truck: { name: string; plate: string; price: number } | null;
  order: {
    code: string;
    product: string;
    quantityKg: number;
    buyer: { name: string; business: string | null };
  };
};

export function Trucks() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<PendingTruck | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: ["truck-approvals"],
    queryFn: () => api<PendingTruck[]>("/admin/trucks/pending"),
    enabled: can("ORDERS_VIEW"),
    refetchInterval: 20_000,
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; approve: boolean; reason?: string }) => {
      if (input.approve) return api(`/admin/trucks/${input.id}/approve`, { method: "POST" });
      return api(`/admin/trucks/${input.id}/reject`, { method: "POST", body: { reason: input.reason } });
    },
    onSuccess: () => {
      setRejecting(null);
      setReason("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["truck-approvals"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err) => setError(errorText(err)),
  });

  if (!can("ORDERS_VIEW")) return <NoAccess what="approve truck bookings" />;

  const rows = queue.data ?? [];

  return (
    <>
      <h1>Truck bookings</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        A paid booking stays here until you approve it. Drivers only see it after that.
      </p>
      <Card padded={false}>
        {queue.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No truck bookings are waiting.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Load</th>
                <th>Route</th>
                <th>Truck</th>
                <th>Fare</th>
                <th>Paid</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <b className="mono">{row.code}</b>
                    <span className="sub">{row.order.buyer.business ?? row.order.buyer.name}</span>
                  </td>
                  <td>
                    {row.order.product}
                    <span className="sub">{row.order.quantityKg.toLocaleString("en-IN")} kg</span>
                  </td>
                  <td>
                    {row.pickup}
                    <span className="sub">{row.destination}</span>
                  </td>
                  <td>
                    {row.truck ? `${row.truck.name} · ${row.truck.plate}` : "Open"}
                    <span className="sub">{row.driver?.name ?? "No driver yet"}</span>
                  </td>
                  <td>{inr(row.total)}</td>
                  <td className="muted">{when(row.paidAt)}</td>
                  <td>
                    <div className="row">
                      <button className="btn btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, approve: true })}>
                        Approve
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => { setRejecting(row); setError(null); }}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {rejecting ? (
        <Modal
          title={`Reject ${rejecting.code}`}
          onClose={() => setRejecting(null)}
          footer={
            <button
              className="btn-danger"
              disabled={decide.isPending}
              onClick={() => {
                if (reason.trim().length < 3) {
                  setError("Give a short reason.");
                  return;
                }
                decide.mutate({ id: rejecting.id, approve: false, reason: reason.trim() });
              }}
            >
              Reject booking
            </button>
          }
        >
          <Field label="Reason" hint="The buyer sees this on the cancelled booking.">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Truck papers are not in order." />
          </Field>
          {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
