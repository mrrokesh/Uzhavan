import { Bell, ChevronDown, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Chrome";
import { Chip } from "../components/ui";
import { FeedCard } from "../components/Widgets";
import { useApp } from "../context/AppContext";
import { crops } from "../data/seed";

const filters = [
  { id: "for-you", label: "For you" },
  { id: "ready", label: "Ready now" },
  { id: "upcoming", label: "Upcoming" },
  { id: "following", label: "Following" },
] as const;

export function HomeFeed() {
  const navigate = useNavigate();
  const { filter, setFilter, saved, toggleSaved, following, farmerAccepted } = useApp();
  const visible = crops.filter((c) => {
    if (filter === "ready") return c.status === "ready";
    if (filter === "upcoming") return c.status === "upcoming";
    if (filter === "following") return following.includes(c.id);
    return true;
  });

  return (
    <Screen tab="home">
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between pt-1">
          <Logo />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink shadow-[var(--shadow-card)]"
            >
              <span>📍</span> Tamil Nadu <ChevronDown size={14} />
            </button>
            <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <Bell size={18} strokeWidth={1.7} />
              {farmerAccepted ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" /> : null}
            </button>
          </div>
        </div>

        <label className="mt-4 flex h-12 items-center gap-2 rounded-[14px] bg-white px-3.5 shadow-[var(--shadow-card)]">
          <Search size={18} className="text-faint" />
          <input
            placeholder="Search crops or districts"
            className="h-full w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {visible.map((crop) => (
            <FeedCard
              key={crop.id}
              crop={crop}
              saved={saved.includes(crop.id)}
              onOpen={() => navigate(`/crop/${crop.id}`)}
              onSave={() => toggleSaved(crop.id)}
            />
          ))}
        </div>
      </div>
    </Screen>
  );
}
