import type { ReactNode } from "react";
import { BadgeCheck, Bookmark, MoreHorizontal, Play } from "lucide-react";
import type { Crop } from "../data/seed";
import { kg } from "../lib/format";
import { Chip } from "./ui";

export function FarmerLine({
  avatar,
  name,
  district,
}: {
  avatar: string;
  name: string;
  district: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
      <p className="text-[13px] font-medium text-ink">
        {name}
        <BadgeCheck className="ml-1 inline fill-[#2B7BFF] text-white" size={14} />
        <span className="font-normal text-muted"> · {district}</span>
      </p>
    </div>
  );
}

export function FeedCard({
  crop,
  saved,
  onOpen,
  onSave,
}: {
  crop: Crop;
  saved?: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article className="rounded-[16px] bg-white p-3.5 shadow-[var(--shadow-card)]">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <FarmerLine avatar={crop.avatar} name={crop.farmName} district={crop.district} />
        <div className="mt-2.5 flex gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold leading-snug text-ink">{crop.headline}</h2>
            <div className="mt-2">
              <Chip tone={crop.status === "ready" ? "mint" : "amber"}>
                {crop.status === "ready" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5 10 17.5 19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
                {crop.statusLabel}
              </Chip>
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              {kg(crop.expectedKg)} expected · {crop.grade}
            </p>
          </div>
          <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[14px]">
            <img src={crop.image} alt="" className="h-full w-full object-cover" />
            {crop.hasVideo ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95">
                  <Play size={14} className="ml-0.5 fill-ink text-ink" />
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </button>
      <div className="mt-2 flex items-center gap-3 text-muted">
        <button type="button" onClick={onSave} aria-label="Save">
          <Bookmark size={20} strokeWidth={1.7} className={saved ? "fill-forest text-forest" : ""} />
        </button>
        <button type="button" aria-label="More">
          <MoreHorizontal size={20} strokeWidth={1.7} />
        </button>
      </div>
    </article>
  );
}

export function CropSummary({ crop, extra }: { crop: Crop; extra?: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[16px] bg-white p-3 shadow-[var(--shadow-card)]">
      <img src={crop.image} alt="" className="h-16 w-16 rounded-[12px] object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold text-ink">{crop.title}</p>
        <p className="mt-0.5 text-[13px] text-ink">
          {crop.farmName}
          <BadgeCheck className="ml-1 inline fill-[#2B7BFF] text-white" size={13} />
        </p>
        <p className="text-[12px] text-muted">{crop.district}</p>
        {extra}
      </div>
    </div>
  );
}

export function Stepper({
  value,
  unit = "kg",
  onDec,
  onInc,
}: {
  value: number;
  unit?: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        onClick={onDec}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-2xl font-medium text-forest"
      >
        −
      </button>
      <p className="min-w-[130px] text-center text-[28px] font-bold text-ink">
        {new Intl.NumberFormat("en-IN").format(value)} {unit}
      </p>
      <button
        type="button"
        onClick={onInc}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-2xl font-medium text-white"
      >
        +
      </button>
    </div>
  );
}

export function Tracker({
  steps,
}: {
  steps: { title: string; meta: string; state: "done" | "current" | "pending" }[];
}) {
  return (
    <div className="px-1">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <div key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              {step.state === "done" ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5 10 17.5 19 7.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
                  </svg>
                </span>
              ) : step.state === "current" ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-bg">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-text" />
                </span>
              ) : (
                <span className="h-6 w-6 rounded-full border-2 border-[#d8d3cb] bg-white" />
              )}
              {last ? null : (
                <span
                  className={`my-1 w-px flex-1 ${step.state === "done" ? "bg-forest" : "bg-[#e4dfd6]"}`}
                  style={{ minHeight: 22 }}
                />
              )}
            </div>
            <div className={`pb-4 ${last ? "pb-0" : ""}`}>
              <p
                className={`text-[14px] font-semibold ${
                  step.state === "pending" ? "text-faint" : "text-ink"
                }`}
              >
                {step.title}
              </p>
              <p
                className={`text-[12px] ${
                  step.state === "current" ? "text-amber-text" : step.state === "done" ? "text-muted" : "text-faint"
                }`}
              >
                {step.meta}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RouteStops({
  pickup,
  drop,
  editable,
  onEdit,
}: {
  pickup: string;
  drop: string;
  editable?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="relative pl-5">
      <div className="absolute top-2 bottom-2 left-[7px] border-l-2 border-dashed border-forest/40" />
      <div className="relative pb-5">
        <span className="absolute -left-5 top-1.5 h-3.5 w-3.5 rounded-full bg-forest" />
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Pickup</p>
        <p className="text-[14px] font-semibold text-ink">{pickup}</p>
      </div>
      <div className="relative">
        <span className="absolute -left-5 top-1.5 h-3.5 w-3.5 rounded-full bg-amber-text" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Destination</p>
            <p className="text-[14px] font-semibold text-ink">{drop}</p>
          </div>
          {editable ? (
            <button type="button" onClick={onEdit} className="text-forest" aria-label="Edit destination">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
