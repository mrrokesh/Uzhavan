import { Truck } from "lucide-react";

type Variant = "route" | "nearby" | "finding" | "tracking";

export function MapView({
  variant = "route",
  badge = "57 km",
  chip,
  pickupLabel = "Muthu Farms",
  dropLabel = "Salem Agro Warehouse",
}: {
  variant?: Variant;
  badge?: string;
  chip?: string;
  pickupLabel?: string;
  dropLabel?: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#dce8d8]">
      <svg viewBox="0 0 390 420" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width="390" height="420" fill="#d9e6d4" />
        <path d="M0 80c40 20 80-10 130 10s90 8 140-20 80 10 120 0v80H0z" fill="#cfe0c6" />
        <path d="M-10 210c50-30 110 10 170-10s90 30 140 4 90-20 110 10v70H-10z" fill="#c5d9bb" />
        <rect x="0" y="248" width="390" height="14" fill="#cfc4a8" />
        <rect x="0" y="253" width="390" height="4" fill="#f3ead2" />
        <rect x="168" y="0" width="14" height="420" fill="#cfc4a8" />
        <rect x="173" y="0" width="4" height="420" fill="#f3ead2" />
        <path d="M40 360 Q 120 300 175 255" stroke="#b7c6a8" strokeWidth="10" fill="none" />
        <path d="M188 248 Q 250 200 340 170" stroke="#b7c6a8" strokeWidth="8" fill="none" />
        <circle cx="70" cy="90" r="28" fill="#b9d0ae" />
        <circle cx="310" cy="70" r="36" fill="#b3cbA6" />
        <circle cx="300" cy="340" r="40" fill="#bfd4b4" />
        <path
          d="M72 318 C 110 270, 150 250, 176 252 C 210 230, 250 188, 292 128"
          stroke="#1B5E3B"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        {variant !== "finding" ? (
          <g>
            <rect x="168" y="188" width="36" height="20" rx="4" fill="#1B5E3B" />
            <text x="186" y="202" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
              {badge}
            </text>
          </g>
        ) : null}
        <g>
          <rect x="62" y="78" width="22" height="14" rx="2" fill="#2f5d9f" />
          <text x="73" y="88" textAnchor="middle" fontSize="7" fill="white" fontWeight="700">
            79
          </text>
        </g>
        <g>
          <rect x="292" y="248" width="26" height="14" rx="2" fill="#2f5d9f" />
          <text x="305" y="258" textAnchor="middle" fontSize="7" fill="white" fontWeight="700">
            544
          </text>
        </g>
      </svg>

      <Pin left="16%" top="72%" label={pickupLabel} color="#1B5E3B" />
      <Pin left="72%" top="22%" label={dropLabel} color="#F5A623" />

      {variant === "nearby" || variant === "finding" ? (
        <>
          <TruckDot left="38%" top="58%" dim={variant === "finding"} />
          <TruckDot left="54%" top="46%" dim={variant === "finding"} />
          <TruckDot left="46%" top="34%" dim={variant === "finding"} />
          <span className="absolute left-[48%] top-[62%] h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2B7BFF] shadow" />
        </>
      ) : null}

      {variant === "tracking" ? (
        <span className="truck-bob absolute left-[40%] top-[48%] flex h-9 w-9 items-center justify-center rounded-full bg-forest text-white shadow-md">
          <Truck size={16} />
        </span>
      ) : null}

      {chip ? (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-mint px-3 py-1 text-[12px] font-semibold text-forest shadow-sm">
          {chip}
        </div>
      ) : null}
    </div>
  );
}

function Pin({ left, top, label, color }: { left: string; top: string; label: string; color: string }) {
  return (
    <div className="absolute z-10 -translate-x-1/2" style={{ left, top }}>
      <div className="flex flex-col items-center">
        <span className="mb-1 max-w-[110px] rounded-md bg-white px-1.5 py-0.5 text-center text-[9px] font-semibold text-ink shadow-sm">
          {label}
        </span>
        <svg width="22" height="28" viewBox="0 0 22 28">
          <path d="M11 27s9-9.2 9-16A9 9 0 1 0 2 11c0 6.8 9 16 9 16z" fill={color} />
          <circle cx="11" cy="11" r="3.4" fill="white" />
        </svg>
      </div>
    </div>
  );
}

function TruckDot({ left, top, dim }: { left: string; top: string; dim?: boolean }) {
  return (
    <span
      className={`absolute flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-forest text-white shadow ${
        dim ? "opacity-40" : ""
      }`}
      style={{ left, top }}
    >
      <Truck size={13} />
    </span>
  );
}

export function WarehouseArt() {
  return (
    <div className="relative mx-auto h-40 w-full max-w-[280px]">
      <svg viewBox="0 0 280 160" className="h-full w-full">
        <ellipse cx="140" cy="148" rx="110" ry="8" fill="#eadfce" />
        <path d="M40 92h200v48H40z" fill="#f3ebe0" stroke="#d8cbb8" />
        <path d="M36 92l104-40 104 40H36z" fill="#e8d4b5" stroke="#c9b496" />
        <rect x="118" y="104" width="44" height="36" fill="#c9a36a" />
        <rect x="56" y="104" width="28" height="20" fill="#d7e7ef" />
        <rect x="196" y="104" width="28" height="20" fill="#d7e7ef" />
        <rect x="168" y="118" width="70" height="28" rx="4" fill="#eef2f4" stroke="#b9c0c6" />
        <circle cx="178" cy="140" r="7" fill="#3a3a3a" />
        <circle cx="226" cy="140" r="7" fill="#3a3a3a" />
        <rect x="70" y="126" width="22" height="16" rx="2" fill="#1B5E3B" />
        <rect x="96" y="130" width="16" height="12" rx="2" fill="#F5A623" />
        <circle cx="82" cy="118" r="7" fill="#c68642" />
        <circle cx="108" cy="122" r="7" fill="#8d5a2b" />
        <path d="M78 112 h8 v6 h-8z" fill="#1B5E3B" />
        <path d="M104 116 h8 v6 h-8z" fill="#1B5E3B" />
      </svg>
    </div>
  );
}

export function TruckHeroArt() {
  return (
    <svg width="92" height="64" viewBox="0 0 92 64" fill="none">
      <rect x="4" y="28" width="48" height="22" rx="3" fill="#1B5E3B" />
      <rect x="52" y="34" width="28" height="16" rx="3" fill="#2a7a4c" />
      <rect x="58" y="38" width="14" height="8" rx="1" fill="#d7e7ef" />
      <circle cx="20" cy="52" r="7" fill="#2b2b2b" />
      <circle cx="64" cy="52" r="7" fill="#2b2b2b" />
      <rect x="10" y="20" width="12" height="8" rx="1" fill="#E8F3EC" />
      <rect x="24" y="16" width="12" height="12" rx="1" fill="#F5A623" />
      <rect x="38" y="22" width="10" height="6" rx="1" fill="#E8F3EC" />
    </svg>
  );
}
