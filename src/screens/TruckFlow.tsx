import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Bell, Check, ChevronRight, Clock, Info, MapPin, Warehouse } from "lucide-react";
import { AppHeader, Screen } from "../components/Chrome";
import { Logo } from "../components/Logo";
import { MapView, TruckHeroArt } from "../components/MapView";
import { Chip, InfoNote, PrimaryButton } from "../components/ui";
import { Stepper } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { cargoFor, driver, getTruck, IMAGES, trucks, turmericOrder } from "../data/seed";
import { inr, kg } from "../lib/format";

export function BookTrackHome() {
  const navigate = useNavigate();
  const { setBookingSource } = useApp();
  const order = turmericOrder;

  return (
    <Screen
      tab="track"
      footer={
        <PrimaryButton
          onClick={() => {
            setBookingSource("turmeric");
            navigate("/book-track/choose-order");
          }}
        >
          Book truck
        </PrimaryButton>
      }
    >
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between pt-1">
          <Logo />
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
            <Bell size={18} strokeWidth={1.7} />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold">Book a truck</h1>
            <p className="mt-1 max-w-[200px] text-[13px] text-muted">Move your purchased crops safely.</p>
          </div>
          <TruckHeroArt />
        </div>

        <div className="mt-4 rounded-[16px] bg-white p-3.5 shadow-[var(--shadow-card)]">
          <Chip tone="mint">🌱 Ready for pickup</Chip>
          <div className="mt-3 flex gap-3">
            <img src={IMAGES.turmericHeap} alt="" className="h-16 w-16 rounded-[12px] object-cover" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-semibold">Turmeric</p>
                <span className="flex items-center gap-1 text-[12px] text-muted">
                  <Clock size={12} /> {kg(order.qtyKg)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink">{order.farmer}</p>
              <p className="text-[12px] text-muted">{order.pickup}</p>
              <p className="text-[12px] text-muted">{order.harvestDate}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Benefit icon="👨‍🌾" title="Direct from farmers" text="Crops move from farm to your warehouse — no middlemen." />
          <Benefit icon="🚚" title="Local truck network" text="Verified drivers near Attur, Salem, Dindigul and Ooty." />
          <Benefit icon="✅" title="Safe & reliable" text="Insured trucks, live tracking, and proof of delivery." />
        </div>
      </div>
    </Screen>
  );
}

function Benefit({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-[20px]">{icon}</span>
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[12.5px] text-muted">{text}</p>
      </div>
    </div>
  );
}

export function ChooseOrder() {
  const navigate = useNavigate();
  const { turmericReady } = useApp();
  const order = turmericReady;

  return (
    <Screen
      tab="track"
      footer={<PrimaryButton onClick={() => navigate("/book-track/pickup")}>Find nearby trucks</PrimaryButton>}
    >
      <AppHeader title="Choose an order" />
      <div className="px-4 pb-6">
        <div className="rounded-[16px] border-2 border-forest bg-white p-3.5 shadow-[var(--shadow-card)]">
          <div className="flex gap-3">
            <img src={IMAGES.turmericHeap} alt="" className="h-16 w-16 rounded-[12px] object-cover" />
            <div>
              <p className="text-[16px] font-semibold">Turmeric</p>
              <p className="text-[13px] text-muted">{kg(order.qtyKg)}</p>
              <p className="text-[12px] text-muted">{order.pickup}</p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-[13px] font-medium text-muted">Quantity to transport</p>
        <div className="mt-3">
          <Stepper value={order.qtyKg} onDec={() => {}} onInc={() => {}} />
          <p className="mt-2 text-center text-[12px] text-forest">Full order selected</p>
        </div>

        <button
          type="button"
          className="mt-5 flex w-full items-center gap-3 rounded-[16px] bg-white p-3.5 text-left shadow-[var(--shadow-card)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-bg text-amber-text">
            <Warehouse size={18} />
          </span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold">{order.destination}</p>
            <p className="text-[12px] text-muted">{order.destinationFull}</p>
          </div>
          <ChevronRight size={18} className="text-faint" />
        </button>

        <div className="mt-3">
          <InfoNote>
            <Info size={16} className="mt-0.5 shrink-0" />
            You can change destination before confirming the truck.
          </InfoNote>
        </div>
      </div>
    </Screen>
  );
}

export function PickupDelivery() {
  const navigate = useNavigate();
  const { bookingSource, quantity } = useApp();
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen tab="track" footer={<PrimaryButton onClick={() => navigate("/book-track/trucks")}>Choose truck</PrimaryButton>}>
      <AppHeader title="Pickup & delivery" />
      <div className="flex h-[calc(100%-8px)] flex-col">
        <div className="h-[340px] shrink-0">
          <MapView
            variant="route"
            pickupLabel={order.pickupShort}
            dropLabel={order.destination}
          />
        </div>
        <div className="space-y-3 px-4 py-3">
          <Line icon={<MapPin size={16} className="text-forest" />} title={order.pickup} label="Pickup" />
          <Line icon={<Warehouse size={16} className="text-amber-text" />} title={order.destinationFull} label="Delivery" />
          <div className="flex justify-between text-[13px]">
            <span className="text-muted">Distance</span>
            <span className="font-semibold">57 km</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted">Available trucks</span>
            <span className="font-semibold text-forest">12 local trucks available</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function Line({ icon, title, label }: { icon: ReactNode; title: string; label: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-[11px] text-muted">{label}</p>
        <p className="text-[13.5px] font-semibold">{title}</p>
      </div>
    </div>
  );
}

export function NearbyTrucks() {
  const navigate = useNavigate();
  const { selectedTruckId, setSelectedTruckId, bookingSource, quantity } = useApp();
  const load = cargoFor(bookingSource, quantity).qtyKg;

  return (
    <Screen tab="track" footer={<PrimaryButton onClick={() => navigate(`/book-track/truck/${selectedTruckId}`)}>Continue</PrimaryButton>}>
      <AppHeader title="Nearby trucks" />
      <div className="flex flex-col">
        <div className="h-[220px]">
          <MapView variant="nearby" pickupLabel={cargoFor(bookingSource, quantity).pickupShort} dropLabel={cargoFor(bookingSource, quantity).destination} />
        </div>
        <div className="-mt-3 rounded-t-[22px] bg-cream px-4 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#d7d0c4]" />
          <h2 className="text-[16px] font-semibold">Trucks near the farmer</h2>
          <div className="mt-3 space-y-2">
            {trucks.map((t) => {
              const selected = selectedTruckId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.capacityKg < load}
                  onClick={() => setSelectedTruckId(t.id)}
                  className={`flex w-full gap-3 rounded-[16px] bg-white p-3 text-left shadow-[var(--shadow-card)] ${
                    t.capacityKg < load ? "opacity-50" : selected ? "border-2 border-forest" : "border-2 border-transparent"
                  }`}
                >
                  <img src={t.photo} alt="" className="h-14 w-14 rounded-[10px] object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold">{t.name}</p>
                      {t.recommended ? <Chip tone="mint" className="!px-2 !py-0.5">Recommended</Chip> : null}
                      {t.capacityKg < load ? <Chip className="!bg-[#f3eee6] !px-2 !py-0.5 !text-muted">Too small</Chip> : null}
                    </div>
                    <p className="text-[11px] text-muted">{t.meta}</p>
                    <p className="text-[12px] text-muted">
                      {t.capacityTons} ton capacity
                      {t.capacityKg < load
                        ? ` · Not enough for ${kg(load)}`
                        : ` · ${t.etaMin} min away`}
                    </p>
                  </div>
                  <div className="text-right">
                    {t.capacityKg < load ? null : <p className="text-[14px] font-bold">{inr(t.price)}</p>}
                    {selected && t.capacityKg >= load ? (
                      <span className="ml-auto mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-forest text-white">
                        <Check size={11} />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex items-center justify-center gap-1 text-[12px] text-forest">
            <Check size={13} /> All trucks are verified and insured.
          </p>
          <p className="sr-only">Load {kg(load)}</p>
        </div>
      </div>
    </Screen>
  );
}

export function TruckDetails() {
  const navigate = useNavigate();
  const { selectedTruckId, bookingSource, quantity } = useApp();
  const truck = getTruck(selectedTruckId);
  const order = cargoFor(bookingSource, quantity);

  return (
    <Screen tab="track" footer={<PrimaryButton onClick={() => navigate("/booking/review")}>Review booking</PrimaryButton>}>
      <AppHeader title="Truck details" />
      <div className="px-4 pb-6">
        <div className="flex items-center gap-3 rounded-[16px] bg-white p-3.5 shadow-[var(--shadow-card)]">
          <img src={driver.photo} alt="" className="h-14 w-14 rounded-full object-cover" />
          <div className="flex-1">
            <p className="text-[17px] font-semibold">{driver.name}</p>
            <p className="text-[12.5px] text-muted">
              ★ {driver.rating} ({driver.trips} trips)
            </p>
          </div>
          <Chip tone="mint">
            <BadgeCheck size={12} /> Verified driver
          </Chip>
        </div>

        <div className="mt-3 overflow-hidden rounded-[16px] bg-white shadow-[var(--shadow-card)]">
          <img src={truck.photo} alt="" className="h-36 w-full object-cover" />
          <div className="p-3.5">
            <p className="text-[16px] font-semibold">
              {truck.name.replace(" 3.5T", "")} · 3.5T
            </p>
            <p className="text-[13px] text-muted">
              {truck.body} · {truck.plate} · {truck.etaMin} min away
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-3 rounded-[16px] bg-mint p-3.5">
          <span className="text-[28px]">👜</span>
          <p className="text-[13.5px] font-medium text-forest">
            Perfect for {kg(order.qtyKg)} — you can load up to {kg(truck.capacityKg)}.
          </p>
        </div>

        <h2 className="mt-5 text-[15px] font-semibold">What’s included</h2>
        <div className="mt-2 space-y-3">
          <Inc title="Loading assistance" text="Driver will help with loading." />
          <Inc title="Phone support" text="Support during pickup & delivery." />
          <Inc title="Goods protection" text="Safe transport for your crops." />
        </div>
      </div>
    </Screen>
  );
}

function Inc({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-mint text-forest">
        <Check size={13} />
      </span>
      <div>
        <p className="text-[13.5px] font-semibold">{title}</p>
        <p className="text-[12px] text-muted">{text}</p>
      </div>
    </div>
  );
}
