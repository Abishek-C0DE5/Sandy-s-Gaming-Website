'use client';

export function CelebrationEffects() {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden" aria-hidden="true">
      {/* 1. Subtle screen pulse glow */}
      <div className="absolute inset-0 bg-[#D71932]/15 animate-pulse transition-opacity duration-500" />

      {/* 2. Expanding radial laser rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-[#D71932]/60 animate-ping [animation-duration:1.5s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-[#D71932]/30 animate-pulse" />
    </div>
  );
}
