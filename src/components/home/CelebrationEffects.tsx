'use client';

export function CelebrationEffects() {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden" aria-hidden="true">
      {/* 1. Fullscreen subtle crimson light flash */}
      <div className="absolute inset-0 bg-[#D71932]/25 animate-screen-flash" />

      {/* 2. Expanding radial glow ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-[#D71932]/50 animate-radial-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full border border-white/20 animate-radial-pulse [animation-delay:200ms]" />

      {/* 3. Controlled burst particles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-lg max-h-96">
        {[...Array(16)].map((_, i) => {
          const angle = (i * 360) / 16;
          const distance = 80 + (i % 4) * 30;
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * distance;
          const y = Math.sin(rad) * distance;
          const isCrimson = i % 2 === 0;

          return (
            <div
              key={i}
              className={`absolute top-1/2 left-1/2 w-2 h-2 rounded-full ${
                isCrimson ? 'bg-[#D71932] shadow-[0_0_8px_#D71932]' : 'bg-white shadow-[0_0_8px_#ffffff]'
              }`}
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                opacity: 0.9,
                transition: 'all 1s cubic-bezier(0.1, 0.9, 0.2, 1)',
                animation: `float-particle 1.2s ease-out forwards ${i * 40}ms`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
