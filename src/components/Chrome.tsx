import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ClipboardList, House, Signal, Truck, UserRound, Wifi } from "lucide-react";

export function StatusBar() {
  return (
    <div className="flex h-11 shrink-0 items-end px-6 pb-1.5 text-[15px] font-semibold text-ink">
      <span className="w-16">9:41</span>
      <div className="flex flex-1 justify-end gap-1.5 text-ink">
        <Signal size={15} strokeWidth={2.2} />
        <Wifi size={15} strokeWidth={2.2} />
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.6" y="0.6" width="21" height="10.8" rx="2.4" stroke="#1A1A1A" strokeWidth="1.2" />
          <rect x="2" y="2" width="14.5" height="8" rx="1.2" fill="#1A1A1A" />
          <path d="M23.2 4v4c.9-.4.9-3.6 0-4z" fill="#1A1A1A" />
        </svg>
      </div>
    </div>
  );
}

export function AppHeader({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="relative flex h-11 shrink-0 items-center px-2">
      <button
        type="button"
        onClick={onBack ?? (() => navigate(-1))}
        className="flex h-10 w-10 items-center justify-center text-ink"
        aria-label="Back"
      >
        <ChevronLeft size={26} strokeWidth={1.8} />
      </button>
      {title ? (
        <h1 className="pointer-events-none absolute inset-x-14 text-center text-[17px] font-semibold text-ink">
          {title}
        </h1>
      ) : null}
      <div className="ml-auto flex items-center">{right}</div>
    </div>
  );
}

const tabs = [
  { to: "/", label: "Home", icon: House, match: (p: string) => p === "/" || p.startsWith("/crop") },
  {
    to: "/book-track",
    label: "Book Track",
    icon: Truck,
    match: (p: string) => p.startsWith("/book-track") || p.startsWith("/booking") || p.startsWith("/order/"),
  },
  {
    to: "/orders",
    label: "My Orders",
    icon: ClipboardList,
    match: (p: string) => p.startsWith("/orders") || p.startsWith("/request"),
  },
  { to: "/profile", label: "Profile", icon: UserRound, match: (p: string) => p.startsWith("/profile") },
];

export function TabBar({ active }: { active?: "home" | "track" | "orders" | "profile" }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const forced =
    active === "home"
      ? "/"
      : active === "track"
        ? "/book-track"
        : active === "orders"
          ? "/orders"
          : active === "profile"
            ? "/profile"
            : null;

  return (
    <div className="shrink-0 border-t border-line bg-white/95 pb-[10px] pt-1.5 backdrop-blur">
      <div className="grid grid-cols-4">
        {tabs.map((tab) => {
          const isActive = forced ? tab.to === forced : tab.match(pathname);
          const Icon = tab.icon;
          return (
            <button
              key={tab.to}
              type="button"
              onClick={() => navigate(tab.to)}
              className={`flex flex-col items-center gap-0.5 py-1 text-[10px] ${
                isActive ? "font-semibold text-forest" : "text-faint"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.7} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Screen({
  children,
  footer,
  tab,
  hideTab = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  tab?: "home" | "track" | "orders" | "profile";
  hideTab?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-cream">
      <StatusBar />
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">{children}</div>
      {footer ? <div className="shrink-0 border-t border-line bg-cream/95 px-4 pb-3 pt-3">{footer}</div> : null}
      {hideTab ? null : <TabBar active={tab} />}
    </div>
  );
}

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#e4d8c8] p-4 sm:p-8">
      <div className="relative h-[844px] w-[390px] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-[40px] border-[10px] border-[#1a1a1a] bg-cream shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
        <div className="absolute left-1/2 top-2 z-30 h-[22px] w-[118px] -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
        <div className="h-full">{children}</div>
      </div>
    </div>
  );
}
