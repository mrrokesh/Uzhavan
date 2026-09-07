import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, Clock, Info, Pencil, Sprout, Trash2, Truck } from "lucide-react";
import { AppHeader, Screen } from "../components/Chrome";
import { SuccessMark } from "../components/Logo";
import { Chip, InfoNote, PrimaryButton, OutlineButton, Row, Divider } from "../components/ui";
import { CropSummary, Stepper, Tracker } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { getCrop } from "../data/seed";
import { inr, kg, pct } from "../lib/format";

export function SelectQuantity() {
  const { id } = useParams();
  const crop = getCrop(id ?? "bhagwa");
  const navigate = useNavigate();
  const { quantity, setQuantity } = useApp();
  const picks = [500, 1000, 2000];
  const share = pct(quantity, crop.expectedKg);
  const value = quantity * crop.pricePerKg;

  return (
    <Screen
      tab="home"
      footer={
        <PrimaryButton onClick={() => navigate(`/crop/${crop.id}/review`)}>Review request</PrimaryButton>
      }
    >
      <AppHeader title="Select quantity" />
      <div className="px-4 pb-6">
        <CropSummary crop={crop} />
        <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
          <span>📦 {kg(crop.expectedKg)} expected</span>
          <span>Minimum order {kg(crop.minOrderKg)}</span>
        </div>

        <div className="mt-6">
          <Stepper
            value={quantity}
            onDec={() => setQuantity(Math.max(crop.minOrderKg, quantity - 100))}
            onInc={() => setQuantity(Math.min(crop.expectedKg, quantity + 100))}
          />
          <div className="mt-4 flex justify-center gap-2">
            {picks.map((p) => (
              <Chip key={p} active={quantity === p} onClick={() => setQuantity(p)}>
                {kg(p)}
              </Chip>
            ))}
          </div>
          <div className="mt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-forest" style={{ width: `${share}%` }} />
            </div>
            <p className="mt-1.5 text-center text-[12px] text-muted">{share}% of available quantity</p>
          </div>
        </div>

        <div className="relative mt-5 rounded-[16px] bg-white p-4 shadow-[var(--shadow-card)]">
          <Info size={14} className="absolute right-3 top-3 text-faint" />
          <p className="text-[12px] text-muted">Estimated value</p>
          <p className="mt-1 text-[28px] font-bold text-forest">{inr(value)}</p>
          <p className="text-[13px] text-muted">{inr(crop.pricePerKg)}/kg</p>
          <p className="mt-1 text-[12px] text-muted">Final price confirmed by farmer.</p>
        </div>
      </div>
    </Screen>
  );
}

export function ReviewRequest() {
  const { id } = useParams();
  const crop = getCrop(id ?? "bhagwa");
  const navigate = useNavigate();
  const { quantity, setRequestSent, requestId } = useApp();
  const value = quantity * crop.pricePerKg;

  return (
    <Screen
      tab="home"
      footer={
        <PrimaryButton
          onClick={() => {
            setRequestSent(true);
            navigate(`/request/${requestId}/sent`);
          }}
        >
          Send request to farmer
        </PrimaryButton>
      }
    >
      <AppHeader title="Review request" />
      <div className="px-4 pb-6">
        <CropSummary crop={crop} />
        <div className="mt-3 rounded-[16px] bg-white px-4 py-2 shadow-[var(--shadow-card)]">
          <Row label="Requested quantity" value={kg(quantity)} strong />
          <Divider />
          <Row label="Estimated value" value={inr(value)} strong />
          <Divider />
          <Row label="Expected harvest" value={crop.harvestDate} />
          <Divider />
          <Row label="Pickup" value={crop.location} />
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-forest">
              <Truck size={16} />
            </span>
            <div>
              <p className="text-[13px] font-semibold">Book a truck after the farmer accepts</p>
              <p className="text-[12px] text-muted">Transport is optional and chosen later.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-forest">
              <Info size={16} />
            </span>
            <div>
              <p className="text-[13px] font-semibold">No payment will be collected now</p>
              <p className="text-[12px] text-muted">Price stays estimated until the farmer confirms.</p>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

export function RequestSent() {
  const navigate = useNavigate();
  const { quantity, requestId } = useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen
      tab="orders"
      footer={
        <div className="space-y-2">
          <PrimaryButton onClick={() => navigate(`/request/${requestId}`)}>Track request</PrimaryButton>
          <button type="button" onClick={() => navigate("/")} className="w-full py-2 text-[14px] font-semibold text-forest">
            Back to Home
          </button>
        </div>
      }
    >
      <div className="px-4 pb-6 pt-8 text-center">
        <SuccessMark />
        <h1 className="mt-4 text-[22px] font-semibold">Request sent!</h1>
        <p className="mx-auto mt-1 max-w-[280px] text-[13.5px] text-muted">
          Your request for {kg(quantity)} has been sent to {crop.farmName}.
        </p>
        <div className="mt-4 flex justify-center">
          <Chip tone="amber">
            <Clock size={12} /> Awaiting farmer confirmation
          </Chip>
        </div>
        <div className="mt-5 rounded-[16px] bg-white px-4 py-2 text-left shadow-[var(--shadow-card)]">
          <Row label="Request ID" value={requestId} strong />
          <Divider />
          <Row label="Product" value={crop.title} />
          <Divider />
          <Row label="Requested quantity" value={kg(quantity)} />
          <Divider />
          <Row label="Estimated value" value={inr(quantity * crop.pricePerKg)} />
          <Divider />
          <Row label="Expected harvest" value={crop.harvestDate} />
        </div>
        <div className="mt-4 text-left">
          <InfoNote>
            <Clock size={16} className="mt-0.5 shrink-0" />
            {crop.farmName} usually responds within 6 hours.
          </InfoNote>
        </div>
      </div>
    </Screen>
  );
}

export function RequestDetails() {
  const navigate = useNavigate();
  const { quantity, requestId, setFarmerAccepted, farmerAccepted } = useApp();
  const crop = getCrop("bhagwa");
  const [cancel, setCancel] = useState(false);

  return (
    <Screen tab="orders">
      <AppHeader title="Request details" />
      <div className="px-4 pb-8">
        <InfoNote tone="amber">
          <Clock size={16} className="mt-0.5 shrink-0" />
          Awaiting farmer confirmation — the farmer is reviewing your requested quantity and final price.
        </InfoNote>

        <div className="mt-5">
          <Tracker
            steps={[
              { title: "Request sent", meta: "10:42 AM", state: "done" },
              { title: "Farmer reviewing", meta: "In progress", state: "current" },
              { title: "Quantity reserved", meta: "Pending", state: "pending" },
              { title: "Payment pending", meta: "Pending", state: "pending" },
            ]}
          />
        </div>

        <div className="mt-2 flex items-center justify-between rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
          <div className="flex gap-3">
            <img src={crop.image} alt="" className="h-14 w-14 rounded-[12px] object-cover" />
            <div>
              <p className="text-[14px] font-semibold">{crop.title}</p>
              <p className="text-[12px] text-muted">{kg(quantity)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted">Estimated</p>
            <p className="text-[14px] font-bold text-forest">{inr(quantity * crop.pricePerKg)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
          <img src={crop.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold">
              {crop.farmName} <BadgeCheck className="inline fill-[#2B7BFF] text-white" size={13} />
            </p>
            <p className="text-[12px] text-muted">{crop.district}</p>
          </div>
          <button type="button" className="text-[12px] font-semibold text-forest">
            View farmer ›
          </button>
        </div>

        <div className="mt-3">
          <InfoNote>
            <Sprout size={16} className="mt-0.5 shrink-0" />
            We’ll notify you when the farmer confirms the quantity and final price.
          </InfoNote>
        </div>

        {farmerAccepted ? null : (
          <button
            type="button"
            onClick={() => {
              setFarmerAccepted(true);
              navigate(`/request/${requestId}/update`);
            }}
            className="mt-3 w-full text-center text-[12px] font-medium text-muted underline"
          >
            Farmer responded — view update
          </button>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <OutlineButton onClick={() => navigate(`/crop/${crop.id}/quantity`)}>
            <Pencil size={15} /> Edit request
          </OutlineButton>
          <OutlineButton tone="danger" onClick={() => setCancel(true)}>
            <Trash2 size={15} /> Cancel request
          </OutlineButton>
        </div>
        {cancel ? (
          <p className="mt-2 text-center text-[12px] text-danger">Request cancelled. The farmer will be notified.</p>
        ) : null}
      </div>
    </Screen>
  );
}
