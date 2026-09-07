import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Check, Clock, Info, Shield } from "lucide-react";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { Chip, InfoNote, OutlineButton, PrimaryButton, RadioCard, Row, Divider } from "../components/ui";
import { CropSummary, RouteStops, Tracker } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { getCrop, IMAGES, pomegranateOrder } from "../data/seed";
import { inr, kg } from "../lib/format";

export function RequestUpdate() {
  const navigate = useNavigate();
  const { quantity, requestId } = useApp();
  const crop = getCrop("bhagwa");
  const value = quantity * crop.pricePerKg;

  return (
    <Screen
      tab="orders"
      footer={<PrimaryButton onClick={() => navigate(`/request/${requestId}/confirm`)}>Review & confirm</PrimaryButton>}
    >
      <AppHeader title="Request update" />
      <div className="px-4 pb-6">
        <div className="flex items-start gap-3 rounded-[16px] bg-mint p-3.5">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-forest">
            <Check size={16} strokeWidth={2.6} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-forest">Farmer accepted your request</p>
            <p className="mt-0.5 text-[12.5px] text-forest/80">
              {crop.farmName} accepted your request for {kg(quantity)}.
            </p>
          </div>
        </div>

        <div className="mt-3">
          <CropSummary
            crop={crop}
            extra={
              <p className="text-[12px] text-muted">
                {crop.farmName} <BadgeCheck className="inline fill-[#2B7BFF] text-white" size={12} /> · {crop.district}
              </p>
            }
          />
        </div>

        <div className="mt-3 rounded-[16px] bg-white px-4 py-2 shadow-[var(--shadow-card)]">
          <Row label="Accepted quantity" value={kg(quantity)} strong />
          <Divider />
          <Row label="Final price" value={`${inr(crop.pricePerKg)}/kg`} strong />
          <Divider />
          <Row label="Order value" value={inr(value)} green />
          <Divider />
          <Row label="Pickup from" value={crop.harvestDate} />
        </div>

        <div className="mt-3">
          <InfoNote tone="amber">
            <Clock size={16} className="mt-0.5 shrink-0" />
            Confirm by 6:00 PM today to reserve this quantity.
          </InfoNote>
        </div>

        <div className="mt-5">
          <Tracker
            steps={[
              { title: "Request sent", meta: "10:42 AM", state: "done" },
              { title: "Farmer accepted", meta: "02:18 PM", state: "done" },
              { title: "Buyer confirmation — Current", meta: "Current", state: "current" },
              { title: "Transport selection", meta: "Pending", state: "pending" },
            ]}
          />
        </div>
      </div>
    </Screen>
  );
}

export function ConfirmPurchase() {
  const navigate = useNavigate();
  const { quantity, setQuantityConfirmed, orderId } = useApp();
  const crop = getCrop("bhagwa");
  const [ok, setOk] = useState(true);
  const [declined, setDeclined] = useState(false);
  const value = quantity * crop.pricePerKg;

  return (
    <Screen
      tab="orders"
      footer={
        <div className="space-y-2">
          <PrimaryButton
            disabled={!ok}
            onClick={() => {
              setQuantityConfirmed(true);
              navigate(`/order/${orderId}/confirmed`);
            }}
          >
            Confirm quantity
          </PrimaryButton>
          <OutlineButton tone="danger" onClick={() => setDeclined(true)}>
            Decline offer
          </OutlineButton>
        </div>
      }
    >
      <AppHeader title="Confirm purchase" />
      <div className="px-4 pb-6">
        <CropSummary crop={crop} extra={<p className="text-[12px] text-muted">{crop.location}</p>} />
        <div className="mt-3 rounded-[16px] bg-white px-4 py-2 shadow-[var(--shadow-card)]">
          <Row label="Accepted quantity" value={kg(quantity)} strong />
          <Divider />
          <Row label="Final price" value={`${inr(crop.pricePerKg)}/kg`} strong />
          <Divider />
          <Row label="Order value" value={inr(value)} green />
          <Divider />
          <Row label="Expected harvest / pickup" value={crop.harvestDate} />
          <Divider />
          <Row label="Farm location" value={crop.location} />
        </div>

        <label className="mt-4 flex items-start gap-3">
          <button
            type="button"
            onClick={() => setOk((v) => !v)}
            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-[5px] border ${
              ok ? "border-forest bg-forest text-white" : "border-[#cfc8bc] bg-white"
            }`}
          >
            {ok ? <Check size={13} strokeWidth={3} /> : null}
          </button>
          <span className="text-[13.5px] font-medium">I confirm the quantity and final price.</span>
        </label>

        <div className="mt-4">
          <InfoNote>
            <Shield size={16} className="mt-0.5 shrink-0" />
            Transport will be selected next. Payment instructions will appear in My Orders.
          </InfoNote>
        </div>
        {declined ? (
          <p className="mt-3 text-center text-[12px] text-danger">Offer declined. The reserved quantity is released.</p>
        ) : null}
      </div>
    </Screen>
  );
}

export function QuantityConfirmed() {
  const navigate = useNavigate();
  const { quantity, transport, setTransport, orderId } = useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen
      tab="orders"
      footer={<PrimaryButton onClick={() => navigate(transport === "book" ? `/order/${orderId}/book-truck` : "/orders")}>Continue</PrimaryButton>}
    >
      <div className="px-4 pb-6 pt-6 text-center">
        <SuccessMark />
        <h1 className="mt-3 text-[22px] font-semibold">Quantity confirmed!</h1>
        <p className="mx-auto mt-1 max-w-[280px] text-[13.5px] text-muted">
          {kg(quantity)} of {crop.title} is reserved for you.
        </p>
        <div className="mt-4 rounded-[16px] bg-white px-4 py-2 text-left shadow-[var(--shadow-card)]">
          <Row label="Order ID" value={pomegranateOrder.id} strong />
          <Divider />
          <Row label="Order value" value={inr(quantity * crop.pricePerKg)} />
          <Divider />
          <Row label="Pickup from" value={crop.harvestDate} />
          <Divider />
          <Row label="Farm" value={`${crop.farmName}, ${crop.location}`} />
        </div>
        <h2 className="mt-5 text-left text-[15px] font-semibold">How will you transport the crop?</h2>
        <div className="mt-2 space-y-2 text-left">
          <RadioCard selected={transport === "book"} onSelect={() => setTransport("book")}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-mint text-forest">🚚</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold">Book a truck</p>
                  <Chip tone="amber" className="!px-2 !py-0.5">
                    Recommended
                  </Chip>
                </div>
                <p className="mt-0.5 text-[12px] text-muted">Find verified local trucks near the farm.</p>
              </div>
              <span className={`mt-1 h-4 w-4 rounded-full border-2 ${transport === "book" ? "border-forest bg-forest" : "border-[#cfc8bc]"}`} />
            </div>
          </RadioCard>
          <RadioCard selected={transport === "private"} onSelect={() => setTransport("private")}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-line text-muted">🚛</span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold">Use a private truck</p>
                <p className="mt-0.5 text-[12px] text-muted">Add your own vehicle and driver details.</p>
              </div>
              <span className={`mt-1 h-4 w-4 rounded-full border-2 ${transport === "private" ? "border-forest bg-forest" : "border-[#cfc8bc]"}`} />
            </div>
          </RadioCard>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1 text-[12px] text-muted">
          <Info size={12} /> You can change this later from My Orders.
        </p>
      </div>
    </Screen>
  );
}

export function BookTruckOrder() {
  const navigate = useNavigate();
  const { quantity, setTransport, setBookingSource } = useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen
      tab="track"
      footer={
        <div>
          <PrimaryButton
            onClick={() => {
              setBookingSource("pomegranate");
              navigate("/book-track/pickup");
            }}
          >
            Find nearby trucks
          </PrimaryButton>
          <button
            type="button"
            onClick={() => {
              setTransport("private");
              navigate("/orders");
            }}
            className="mt-2 w-full py-2 text-[14px] font-semibold text-forest"
          >
            I'll use a private truck
          </button>
        </div>
      }
    >
      <AppHeader title="Book a truck" />
      <div className="px-4 pb-6">
        <div className="flex items-center gap-2 rounded-full bg-mint px-3 py-2 text-[12px] font-semibold text-forest">
          🚚 For order {pomegranateOrder.id} · {crop.title}
        </div>
        <div className="mt-3 rounded-[16px] bg-white p-4 shadow-[var(--shadow-card)]">
          <RouteStops pickup={crop.location} drop="Koyambedu Market, Chennai" editable />
        </div>
        <div className="mt-3 rounded-[16px] bg-white px-4 py-2 shadow-[var(--shadow-card)]">
          <Row label="Crop load" value={kg(quantity)} strong />
          <Divider />
          <Row label="Pickup date" value={crop.harvestDate} />
        </div>
        <div className="relative mt-3 overflow-hidden rounded-[16px] border-2 border-forest bg-white shadow-[var(--shadow-card)]">
          <img src={IMAGES.truck} alt="" className="h-32 w-full object-cover" />
          <div className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Suggested vehicle</p>
            <p className="text-[15px] font-semibold">Mini truck · Up to 2.5 tons</p>
          </div>
          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-forest text-white">
            <Check size={13} />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
            <p className="text-[11px] text-muted">📍 Distance</p>
            <p className="mt-1 text-[18px] font-bold">57 km</p>
          </div>
          <div className="rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
            <p className="text-[11px] text-muted">🕒 Est. time</p>
            <p className="mt-1 text-[18px] font-bold">1 hr 35 min</p>
          </div>
        </div>
      </div>
    </Screen>
  );
}
