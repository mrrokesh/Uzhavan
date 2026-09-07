import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  Heart,
  Info,
  MapPin,
  Play,
  Share2,
  ShoppingCart,
} from "lucide-react";
import { Screen } from "../components/Chrome";
import { Chip, PrimaryButton } from "../components/ui";
import { useApp } from "../context/AppContext";
import { getCrop } from "../data/seed";
import { inr, kg } from "../lib/format";

export function CropDetail() {
  const { id } = useParams();
  const crop = getCrop(id ?? "bhagwa");
  const navigate = useNavigate();
  const { setCropId, saved, toggleSaved } = useApp();
  const [slide, setSlide] = useState(0);
  const [more, setMore] = useState(false);
  const hero = crop.gallery[slide] ?? crop.image;

  return (
    <Screen
      tab="home"
      footer={
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] text-muted">Estimated</p>
              <p className="text-[24px] font-bold leading-none text-ink">{inr(crop.pricePerKg)}/kg</p>
            </div>
            <p className="flex items-center gap-1 text-right text-[11px] leading-snug text-muted">
              Final price confirmed by farmer <Info size={12} />
            </p>
          </div>
          <PrimaryButton
            onClick={() => {
              setCropId(crop.id);
              navigate(`/crop/${crop.id}/quantity`);
            }}
          >
            Select quantity
          </PrimaryButton>
        </div>
      }
    >
      <div className="relative h-[320px]">
        <img src={hero} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/25" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="absolute right-4 top-4 flex gap-2">
          {[
            {
              icon: <Heart size={18} className={saved.includes(crop.id) ? "fill-danger text-danger" : ""} />,
              onClick: () => toggleSaved(crop.id),
            },
            { icon: <Share2 size={18} />, onClick: () => {} },
            { icon: <ShoppingCart size={18} />, onClick: () => navigate("/orders") },
          ].map((btn, i) => (
            <button
              key={i}
              type="button"
              onClick={btn.onClick}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white"
            >
              {btn.icon}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95"
        >
          <Play size={22} className="ml-0.5 fill-ink" />
        </button>
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
          {crop.gallery.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full ${i === slide ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white">
          🖼 Gallery · {crop.gallery.length + 4}
        </span>
      </div>

      <div className="px-4 pb-6 pt-4">
        <Chip tone="amber">🕒 {crop.statusLabel}</Chip>
        <h1 className="mt-2 text-[22px] font-semibold text-ink">{crop.title}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {kg(crop.expectedKg)} expected · {crop.grade}
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
          <img src={crop.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">{crop.farmName}</p>
            <p className="text-[12px] text-muted">
              {crop.ownerName} · ★ {crop.rating}
            </p>
            <p className="text-[12px] text-muted">{crop.district}</p>
          </div>
          <button type="button" className="text-[12px] font-semibold text-forest">
            View farmer ›
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {crop.gallery.slice(0, 3).map((src) => (
            <img key={src} src={src} alt="" className="h-20 w-full rounded-[12px] object-cover" />
          ))}
        </div>

        <div className="mt-4 space-y-3 rounded-[16px] bg-white p-3.5 shadow-[var(--shadow-card)]">
          <Spec icon={<MapPin size={16} />} label="Farm location" value={crop.location} />
          <Spec icon={<LeafIcon />} label="Category" value={crop.category} />
          <Spec icon={<CalIcon />} label="Expected harvest" value={crop.harvestDate} />
          <Spec icon={<BagIcon />} label="Minimum order" value={kg(crop.minOrderKg)} />
        </div>

        <h2 className="mt-5 text-[15px] font-semibold">About this crop</h2>
        <p className={`mt-1.5 text-[13.5px] leading-relaxed text-muted ${more ? "" : "line-clamp-3"}`}>
          {crop.about}
        </p>
        <button type="button" onClick={() => setMore((v) => !v)} className="mt-1 text-[13px] font-semibold text-forest">
          {more ? "See less" : "See more"}
        </button>
      </div>
    </Screen>
  );
}

function Spec({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-forest">{icon}</span>
      <div>
        <p className="text-[11px] text-muted">{label}</p>
        <p className="text-[13px] font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 19c8-1 12-8 13-15-8 2-14 8-13 15z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4v4M16 4v4M4 10h16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M7 8h10l1 12H6L7 8z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

