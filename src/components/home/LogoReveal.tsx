'use client';

import Image from 'next/image';

interface LogoRevealProps {
  onAnimationEnd?: () => void;
}

export function LogoReveal({ onAnimationEnd }: LogoRevealProps) {
  return (
    <div
      className="relative flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in-95 duration-1000"
      onAnimationEnd={onAnimationEnd}
    >
      {/* 1. Dramatic Crimson Backlight Halo */}
      <div
        className="absolute w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#D71932]/35 blur-[90px] animate-pulse pointer-events-none"
        aria-hidden="true"
      />

      {/* 2. Slash Light Sweep Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-[#D71932]/20 to-transparent animate-slash-sweep" />
      </div>

      {/* 3. Central Brand Logo */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-48 sm:w-64 md:w-80 h-48 sm:h-64 md:h-80 drop-shadow-[0_10px_35px_rgba(215,25,50,0.5)]">
          <Image
            src="/brand/sandys-gaming-logo.png"
            alt="SANDY'S GAMING"
            fill
            priority
            sizes="(max-width: 768px) 256px, 320px"
            className="object-contain"
          />
        </div>

        {/* Brand Tagline Banner */}
        <div className="mt-4 flex flex-col items-center text-center">
          <p className="text-xs sm:text-sm font-black tracking-[0.3em] uppercase text-[#D71932] drop-shadow-[0_0_12px_rgba(215,25,50,0.8)]">
            ELITE ESPORTS &bull; UNRIVALED GAMING
          </p>
          <div className="mt-2 h-0.5 w-24 bg-gradient-to-r from-transparent via-[#D71932] to-transparent" />
        </div>
      </div>
    </div>
  );
}
