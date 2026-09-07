import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Phone, Share2, Star, Truck } from "lucide-react";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { MapView, WarehouseArt } from "../components/MapView";
import { Chip, OutlineButton, PrimaryButton, Row, Divider } from "../components/ui";
import { RouteStops, Tracker } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { cargoFor, driver, fare, getTruck, IMAGES } from "../data/seed";
import { inr, kg } from "../lib/format";

export function ReviewBooking() {
  const navigate = useNavigate();
  const { selectedTruckId, setBookingPaid, bookingSource, quantity } = useApp();
  const truck = getTruck(selectedTruckId);
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen
      tab="track"
      footer={
        <PrimaryButton
          onClick={() => {
            setBookingPaid(true);
            navigate("/booking/finding");
          }}
        >
          Confirm & pay {inr(fare.total)}
        </PrimaryButton>
      }
    >
      <AppHeader title="Review booking" />
      <div className="px-4 pb-6">
        <div className="rounded-[16px] bg-white p-4 shadow-[var(--shadow-card)]">
          <RouteStops pickup={order.pickup} drop={order.destinationFull} />
          <p className="mt-3 text-right text-[12px] font-semibold text-muted">57 km</p>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
          <img src={order.image} alt="" className="h-12 w-12 rounded-[10px] object-cover" />
          <p className="text-[14px] font-semibold">
            {order.product}, {kg(order.qtyKg)}
          </p>
        </div>
        <div className="mt-3 flex gap-3 rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
          <img src={truck.photo} alt="" className="h-14 w-16 rounded-[10px] object-cover" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold">Mini Truck · 3.5T</p>
            <p className="text-[12px] text-muted">
              {driver.name} · {driver.rating} <span className="text-forest">Verified driver</span>
            </p>
            <p className="text-[12px] font-medium text-forest">ETA {truck.etaMin} min</p>
          </div>
        </div>
        <div className="mt-3 rounded-[16px] bg-white px-4 py-2 shadow-[var(--shadow-card)]">
          <Row label="Base fare" value={inr(fare.base)} />
          <Divider />
          <Row label="Loading assistance" value={inr(fare.loading)} />
          <Divider />
          <Row label="Goods protection" value={inr(fare.protection)} />
          <Divider />
          <Row label="Total" value={inr(fare.total)} green />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[16px] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <span className="text-[13px] text-muted">Payment method</span>
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="rounded bg-[#6C3BEF] px-1.5 py-0.5 text-[10px] font-bold text-white">UPI</span>
            UPI
          </span>
        </div>
      </div>
    </Screen>
  );
}

export function FindingTruck() {
  const navigate = useNavigate();
  const { selectedTruckId, setTruckAssigned, bookingSource, quantity } = useApp();
  const truck = getTruck(selectedTruckId);
  const order = cargoFor(bookingSource, quantity);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTruckAssigned(true);
      navigate("/booking/confirmed");
    }, 2200);
    return () => window.clearTimeout(t);
  }, [navigate, setTruckAssigned]);

  return (
    <Screen hideTab>
      <AppHeader title="Finding truck" />
      <div className="flex h-[calc(100%-44px)] flex-col">
        <div className="h-[280px] opacity-60">
          <MapView variant="finding" pickupLabel={order.pickupShort} dropLabel={order.destination} />
        </div>
        <div className="-mt-4 flex-1 rounded-t-[24px] bg-white px-5 pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e4ddd2]" />
          <div className="relative mx-auto mt-2 flex h-20 w-20 items-center justify-center">
            <span className="pulse-ring absolute inset-0 rounded-full bg-mint" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-mint text-forest">
              <Truck size={28} />
            </span>
          </div>
          <h1 className="mt-3 text-center text-[18px] font-semibold">Finding a nearby truck</h1>
          <p className="mt-1 text-center text-[13px] text-muted">Matching you with a verified local driver</p>
          <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-cream p-3">
            <img src={truck.photo} alt="" className="h-12 w-14 rounded-[10px] object-cover" />
            <div>
              <p className="text-[14px] font-semibold">Mini Truck · 3.5T</p>
              <p className="text-[12px] text-muted">
                {driver.name} · {driver.rating}
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i === 0 ? "bg-forest" : "bg-line"}`} />
            ))}
          </div>
          <button type="button" onClick={() => navigate(-1)} className="mt-6 w-full text-center text-[14px] font-semibold text-muted">
            Cancel search
          </button>
        </div>
      </div>
    </Screen>
  );
}

export function TruckConfirmed() {
  const navigate = useNavigate();
  const truck = getTruck("mini");

  return (
    <Screen
      tab="track"
      footer={
        <div className="space-y-2">
          <PrimaryButton onClick={() => navigate("/booking/track")}>Track truck</PrimaryButton>
          <OutlineButton>Call driver</OutlineButton>
        </div>
      }
    >
      <div className="px-4 pb-6 pt-6 text-center">
        <SuccessMark />
        <h1 className="mt-3 text-[22px] font-semibold">Truck confirmed!</h1>
        <p className="text-[13.5px] text-muted">Your driver is on the way.</p>
        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-white p-3.5 text-left shadow-[var(--shadow-card)]">
          <img src={driver.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
          <div className="flex-1">
            <p className="text-[15px] font-semibold">{driver.name}</p>
            <p className="text-[12px] text-muted">
              ★ {driver.rating} ({driver.trips} trips)
            </p>
          </div>
          <Chip tone="mint">
            <BadgeCheck size={12} /> Verified driver
          </Chip>
        </div>
        <div className="mt-3 overflow-hidden rounded-[16px] bg-white text-left shadow-[var(--shadow-card)]">
          <img src={truck.photo} alt="" className="h-28 w-full object-cover" />
          <div className="p-3.5">
            <p className="text-[15px] font-semibold">Mini Truck · 3.5T</p>
            <p className="text-[13px] text-muted">{truck.plate}</p>
            <p className="mt-1 text-[13px] font-semibold text-forest">Arrives in 12 min</p>
          </div>
        </div>
        <div className="mt-3 rounded-[16px] bg-white p-4 text-left shadow-[var(--shadow-card)]">
          <ConfirmedRoute />
        </div>
      </div>
    </Screen>
  );
}

function ConfirmedRoute() {
  const { bookingSource, quantity } = useApp();
  const order = cargoFor(bookingSource, quantity);
  return <RouteStops pickup={order.pickup} drop={order.destinationFull} />;
}

export function TrackTruck() {
  const navigate = useNavigate();
  const { bookingSource, quantity } = useApp();
  const truck = getTruck("mini");
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen tab="track">
      <div className="flex h-full flex-col">
        <div className="relative h-[340px]">
          <MapView variant="tracking" chip="Heading to the farm" pickupLabel={order.pickupShort} dropLabel={order.destination} />
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow"
          >
            ‹
          </button>
        </div>
        <div className="-mt-5 flex-1 rounded-t-[24px] bg-cream px-4 pt-4">
          <div className="flex items-center gap-3">
            <img src={driver.photo} alt="" className="h-11 w-11 rounded-full object-cover" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold">{driver.name}</p>
              <p className="text-[12px] text-muted">{truck.plate}</p>
            </div>
            <p className="text-[20px] font-bold text-forest">ETA 8 min</p>
          </div>
          <div className="mt-4">
            <Tracker
              steps={[
                { title: "Truck assigned", meta: "4:10 PM", state: "done" },
                { title: "Reaching farmer", meta: "4:27 PM · On the way to pickup location", state: "current" },
                { title: "Crop loaded", meta: "Pending", state: "pending" },
                { title: "On the way", meta: "Pending", state: "pending" },
                { title: "Delivered", meta: "Pending", state: "pending" },
              ]}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 pb-4">
            <OutlineButton>
              <Phone size={15} /> Call driver
            </OutlineButton>
            <OutlineButton>
              <Share2 size={15} /> Share tracking
            </OutlineButton>
          </div>
          <button
            type="button"
            onClick={() => navigate("/booking/delivered")}
            className="mb-4 w-full text-center text-[12px] font-medium text-muted underline"
          >
            Skip to delivery completed
          </button>
        </div>
      </div>
    </Screen>
  );
}

export function DeliveryCompleted() {
  const navigate = useNavigate();
  const { setDelivered, bookingSource, quantity } = useApp();
  const order = cargoFor(bookingSource, quantity);

  useEffect(() => {
    setDelivered(true);
  }, [setDelivered]);

  return (
    <Screen
      tab="orders"
      footer={
        <div className="space-y-2">
          <PrimaryButton onClick={() => navigate("/orders")}>View order</PrimaryButton>
          <OutlineButton>
            <Star size={15} /> Rate driver
          </OutlineButton>
        </div>
      }
    >
      <div className="px-4 pb-6 pt-4 text-center">
        <WarehouseArt />
        <div className="mt-1 flex justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-forest">
            ✓
          </span>
        </div>
        <h1 className="mt-2 text-[22px] font-semibold">Delivery completed</h1>
        <p className="mx-auto mt-1 max-w-[300px] text-[13.5px] text-muted">
          {kg(order.qtyKg)} {order.product.toLowerCase()} reached {order.destination} safely.
        </p>
        <div className="mt-4 rounded-[16px] bg-white px-4 py-2 text-left shadow-[var(--shadow-card)]">
          <Row label="Booking ID" value={order.bookingId} strong />
          <Divider />
          <Row label="Delivered on" value="04 Sep 2024, 4:35 PM" />
          <Divider />
          <Row label="Total paid" value={inr(3450)} />
        </div>
        <div className="mt-3 rounded-[16px] bg-white p-3.5 text-left shadow-[var(--shadow-card)]">
          <p className="text-[12px] font-medium text-muted">Proof of delivery</p>
          <div className="mt-2 flex items-center gap-3">
            <img src={IMAGES.ramesh} alt="" className="h-12 w-12 rounded-[10px] object-cover" />
            <div>
              <p className="text-[13.5px] font-semibold">Received by Ramesh Kumar</p>
              <p className="text-[12px] text-muted">Warehouse Manager</p>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
