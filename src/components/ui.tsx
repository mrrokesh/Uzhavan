import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";

export function Card({
  children,
  className = "",
  selected = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-[16px] bg-white text-left shadow-[var(--shadow-card)] ${
        selected ? "border-2 border-forest" : "border border-transparent"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-[52px] w-full items-center justify-center rounded-[12px] bg-forest text-[15px] font-semibold text-white disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  tone = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" }) {
  return (
    <button
      {...props}
      className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] border bg-white text-[15px] font-semibold ${
        tone === "danger" ? "border-danger text-danger" : "border-forest/20 text-forest"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  active,
  tone = "neutral",
  onClick,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  tone?: "neutral" | "amber" | "mint" | "forest";
  onClick?: () => void;
  className?: string;
}) {
  const tones = {
    neutral: active
      ? "bg-forest text-white"
      : "bg-white text-ink border border-line",
    amber: "bg-amber-bg text-amber-text",
    mint: "bg-mint text-forest",
    forest: "bg-forest text-white",
  };
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Row({
  label,
  value,
  strong,
  green,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  green?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span
        className={`text-right text-[13px] ${
          green ? "text-lg font-bold text-forest" : strong ? "font-semibold text-ink" : "font-medium text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-line" />;
}

export function InfoNote({ children, tone = "mint" }: { children: ReactNode; tone?: "mint" | "amber" }) {
  return (
    <div
      className={`flex gap-2.5 rounded-[14px] px-3.5 py-3 text-[12.5px] leading-relaxed ${
        tone === "amber" ? "bg-amber-bg text-amber-text" : "bg-mint text-forest"
      }`}
    >
      {children}
    </div>
  );
}

export function RadioCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[16px] border-2 bg-white p-3.5 text-left shadow-[var(--shadow-card)] ${
        selected ? "border-forest" : "border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

export function CheckDot({ done, current }: { done?: boolean; current?: boolean }) {
  if (done) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-white">
        <Check size={13} strokeWidth={2.6} />
      </span>
    );
  }
  if (current) {
    return <span className="h-6 w-6 rounded-full border-[3px] border-amber-text bg-amber-bg" />;
  }
  return <span className="h-6 w-6 rounded-full border-2 border-line bg-white" />;
}
