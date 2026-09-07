export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={compact ? 22 : 26} height={compact ? 22 : 26} viewBox="0 0 32 32" fill="none">
        <path d="M16 28c0-8 6-12.5 12-14-1.2 7-5.2 11.4-12 14z" fill="#1B5E3B" />
        <path d="M16 28c0-9-6.5-14.5-12-16 2.4 8 6.4 13 12 16z" fill="#2E8A55" />
        <path d="M16 8v20" stroke="#1B5E3B" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2" fill="#1B5E3B" />
      </svg>
      <span className="font-serif text-[20px] font-semibold tracking-tight text-forest">Uzhavan</span>
    </div>
  );
}

export function SuccessMark({ size = 88 }: { size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size + 36, height: size + 20 }}>
      <svg className="absolute left-0 top-3" width="34" height="40" viewBox="0 0 34 40" fill="none">
        <path d="M18 36c1-12-7-18-14-20 3 9 8 16 14 20z" fill="#1B5E3B" opacity="0.35" />
        <path d="M20 34c3-10 10-14 14-15-2 8-7 12-14 15z" fill="#2E8A55" opacity="0.45" />
      </svg>
      <svg className="absolute right-0 top-2 -scale-x-100" width="34" height="40" viewBox="0 0 34 40" fill="none">
        <path d="M18 36c1-12-7-18-14-20 3 9 8 16 14 20z" fill="#1B5E3B" opacity="0.35" />
        <path d="M20 34c3-10 10-14 14-15-2 8-7 12-14 15z" fill="#2E8A55" opacity="0.45" />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-mint"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5 10 17.5 19 7.5"
            stroke="#1B5E3B"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
