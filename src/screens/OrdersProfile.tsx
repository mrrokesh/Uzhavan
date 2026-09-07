import { useNavigate } from "react-router-dom";
import { Bell, ChevronRight, Languages, MapPin, Phone, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { Screen } from "../components/Chrome";
import { Logo } from "../components/Logo";
import { Chip } from "../components/ui";
import { useApp } from "../context/AppContext";
import { buyer, getCrop, IMAGES, turmericOrder } from "../data/seed";
import { inr, kg } from "../lib/format";

export function MyOrders() {
  const navigate = useNavigate();
  const { requestSent, farmerAccepted, quantityConfirmed, delivered, quantity, requestId, orderId } =
    useApp();
  const crop = getCrop("bhagwa");

  return (
    <Screen tab="orders">
      <div className="px-4 pb-8">
        <div className="flex h-11 items-center justify-between">
          <h1 className="text-[17px] font-semibold">My Orders</h1>
          <Bell size={18} strokeWidth={1.7} />
        </div>

        {requestSent && !quantityConfirmed ? (
          <OrderCard
            image={crop.image}
            title={crop.title}
            meta={`${kg(quantity)} · ${crop.farmName}`}
            id={requestId}
            chip={
              farmerAccepted ? (
                <Chip tone="mint">Farmer accepted</Chip>
              ) : (
                <Chip tone="amber">Awaiting farmer</Chip>
              )
            }
            value={`Est. ${inr(quantity * crop.pricePerKg)}`}
            onClick={() => navigate(farmerAccepted ? `/request/${requestId}/update` : `/request/${requestId}`)}
          />
        ) : null}

        {quantityConfirmed ? (
          <OrderCard
            image={crop.image}
            title={crop.title}
            meta={`${kg(quantity)} · ${crop.farmName}`}
            id={orderId}
            chip={<Chip tone="mint">Quantity reserved</Chip>}
            value={inr(quantity * crop.pricePerKg)}
            onClick={() => navigate(`/order/${orderId}/book-truck`)}
          />
        ) : null}

        <OrderCard
          image={IMAGES.turmericHeap}
          title="Turmeric"
          meta={`${kg(turmericOrder.qtyKg)} · ${turmericOrder.farmName}`}
          id={turmericOrder.id}
          chip={delivered ? <Chip tone="mint">Delivered</Chip> : <Chip tone="mint">Ready for pickup</Chip>}
          value={inr(turmericOrder.value)}
          onClick={() => navigate(delivered ? "/booking/delivered" : "/book-track")}
        />

        {!requestSent ? (
          <p className="mt-6 text-center text-[13px] text-muted">
            Request a crop from Home. Price stays estimated until the farmer confirms.
          </p>
        ) : null}
      </div>
    </Screen>
  );
}

function OrderCard({
  image,
  title,
  meta,
  id,
  chip,
  value,
  onClick,
}: {
  image: string;
  title: string;
  meta: string;
  id: string;
  chip: ReactNode;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 w-full rounded-[16px] bg-white p-3.5 text-left shadow-[var(--shadow-card)]"
    >
      <div className="flex gap-3">
        <img src={image} alt="" className="h-14 w-14 rounded-[12px] object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold">{title}</p>
            {chip}
          </div>
          <p className="mt-0.5 text-[12px] text-muted">{meta}</p>
          <p className="text-[11px] text-faint">{id}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-forest">{value}</span>
        <ChevronRight size={16} className="text-faint" />
      </div>
    </button>
  );
}

export function Profile() {
  const { following, saved } = useApp();

  return (
    <Screen tab="profile">
      <div className="px-4 pb-8">
        <div className="flex h-11 items-center">
          <Logo compact />
        </div>
        <div className="mt-2 flex items-center gap-3 rounded-[16px] bg-white p-3.5 shadow-[var(--shadow-card)]">
          <img src={buyer.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
          <div>
            <p className="text-[16px] font-semibold">{buyer.name}</p>
            <p className="text-[12.5px] text-muted">
              {buyer.business} · {buyer.role}
            </p>
            <p className="text-[12px] text-muted">{buyer.district}, Tamil Nadu</p>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-[16px] bg-white shadow-[var(--shadow-card)]">
          <Row icon={<Warehouse size={16} />} title={buyer.warehouse} sub={buyer.warehouseAddress} />
          <Row icon={<MapPin size={16} />} title="Also buys for" sub={buyer.market} />
          <Row icon={<Phone size={16} />} title={buyer.phone} sub="WhatsApp available" />
          <Row icon={<Languages size={16} />} title="Language" sub="English · தமிழ் ready" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat n={String(following.length)} l="Following" />
          <Stat n={String(saved.length)} l="Saved crops" />
        </div>
        <p className="mt-6 text-center text-[12px] text-faint">Uzhavan · Direct from Tamil Nadu farms</p>
      </div>
    </Screen>
  );
}

function Row({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-0">
      <span className="text-forest">{icon}</span>
      <div>
        <p className="text-[13.5px] font-medium">{title}</p>
        <p className="text-[12px] text-muted">{sub}</p>
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-[16px] bg-white p-3 text-center shadow-[var(--shadow-card)]">
      <p className="text-[20px] font-bold text-forest">{n}</p>
      <p className="text-[12px] text-muted">{l}</p>
    </div>
  );
}

