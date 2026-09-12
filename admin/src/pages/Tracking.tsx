import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fullDate, titleCase } from "../lib/format";
import { Badge, Card, KycBadge, NoAccess, Spinner, StatusBadge } from "../components/ui";
import type { TrackedVehicle } from "../lib/types";

/**
 * Someone rings up about a truck and all they have is the number on the side.
 * One box: type the plate, with or without spaces, and get the vehicle, who's
 * driving it, and where its load is.
 */
export function Tracking() {
  const { can } = useAuth();
  const [input, setInput] = useState("");
  const [plate, setPlate] = useState("");

  const search = useQuery({
    queryKey: ["track", plate],
    queryFn: () => api<TrackedVehicle[]>(`/admin/track?plate=${encodeURIComponent(plate)}`),
    enabled: plate.length >= 3,
    retry: false,
  });

  if (!can("ORDERS_VIEW")) return <NoAccess what="look up vehicles" />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setPlate(input.trim());
  };

  const rows = search.data ?? [];
  // A 404 here means "no such plate", which is an answer, not a failure.
  const notFound = search.isError && /no vehicle/i.test(errorText(search.error));

  return (
    <>
      <h1>Track a vehicle</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Search by number plate. Spaces don’t matter — <code>TN30AB4821</code> and{" "}
        <code>TN 30 AB 4821</code> both find the same truck.
      </p>

      <Card>
        <form className="row" style={{ gap: 8 }} onSubmit={submit}>
          <input
            className="grow"
            value={input}
            placeholder="TN 30 AB 4821"
            autoFocus
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn" type="submit" disabled={input.trim().length < 3}>
            Search
          </button>
        </form>
      </Card>

      {search.isFetching ? <Spinner /> : null}

      {notFound ? (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            No vehicle matching “{plate}”. Check the digits — partial plates work, so try just the
            last four.
          </p>
        </Card>
      ) : null}

      {search.isError && !notFound ? <p className="err">{errorText(search.error)}</p> : null}

      {rows.map(({ truck, driver, currentTrip }) => (
        <Card key={truck.id} title={`${truck.plate} · ${truck.name}`}>
          <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {truck.insuranceExpired ? <Badge tone="red">Insurance expired</Badge> : null}
            {truck.permitExpired ? <Badge tone="red">Permit expired</Badge> : null}
            {driver.online ? <Badge tone="green">Driver online</Badge> : <Badge>Offline</Badge>}
            <StatusBadge status={driver.accountStatus} />
            <KycBadge status={driver.verification} />
          </div>

          <div className="grid-2">
            <div>
              <h3 className="small muted">Vehicle</h3>
              <dl className="pairs">
                <dt>Body</dt>
                <dd>{truck.body}</dd>
                <dt>Capacity</dt>
                <dd>{(truck.capacityKg / 1000).toFixed(1)} t</dd>
                <dt>RC number</dt>
                <dd>{truck.rcNumber ?? "—"}</dd>
                <dt>Insurance</dt>
                <dd className={truck.insuranceExpired ? "danger-text" : undefined}>
                  {truck.insuranceExpiry ? fullDate(truck.insuranceExpiry) : "Not on file"}
                </dd>
                <dt>Permit</dt>
                <dd className={truck.permitExpired ? "danger-text" : undefined}>
                  {truck.permitExpiry ? fullDate(truck.permitExpiry) : "Not on file"}
                </dd>
              </dl>
            </div>

            <div>
              <h3 className="small muted">Driver</h3>
              <dl className="pairs">
                <dt>Name</dt>
                <dd>{driver.name}</dd>
                <dt>Phone</dt>
                <dd>{driver.phone ?? "—"}</dd>
                <dt>Rating</dt>
                <dd>★ {driver.rating.toFixed(1)}</dd>
                <dt>Trips</dt>
                <dd>{driver.trips}</dd>
              </dl>
            </div>
          </div>

          <h3 className="small muted" style={{ marginTop: 18 }}>
            Current load
          </h3>
          {currentTrip ? (
            <dl className="pairs">
              <dt>Trip</dt>
              <dd>
                <code>{currentTrip.code}</code> · <Badge tone="blue">{titleCase(currentTrip.status)}</Badge>
              </dd>
              <dt>Carrying</dt>
              <dd>
                {currentTrip.product} · {currentTrip.quantityKg.toLocaleString("en-IN")} kg
              </dd>
              <dt>From</dt>
              <dd>
                {currentTrip.pickup}
                {currentTrip.farm ? ` · ${currentTrip.farm}` : ""}
              </dd>
              <dt>To</dt>
              <dd>{currentTrip.destination}</dd>
              <dt>Order</dt>
              <dd>
                <code>{currentTrip.orderCode}</code>
              </dd>
              <dt>Buyer</dt>
              <dd>
                {currentTrip.buyer}
                {currentTrip.buyerPhone ? ` · ${currentTrip.buyerPhone}` : ""}
              </dd>
            </dl>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Nothing on board. This truck has no live booking right now.
            </p>
          )}
        </Card>
      ))}
    </>
  );
}
