'use client';

import { useMemo } from 'react';
import { Swords, Shield, Crosshair, Flame, Award } from 'lucide-react';

export interface SlotSymbol {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  isSeven?: boolean;
}

export const GAMING_SYMBOLS: SlotSymbol[] = [
  { id: 'katana', name: 'Katana', icon: Swords },
  { id: 'dragon', name: 'Aegis Shield', icon: Shield },
  { id: 'seven', name: 'Lucky Seven', icon: Swords, isSeven: true },
  { id: 'skull', name: 'Crosshair', icon: Crosshair },
  { id: 'flame', name: 'Crimson Flame', icon: Flame },
  { id: 'crown', name: 'Champion Crown', icon: Award },
];

interface SlotReelProps {
  reelIndex: number;
  isSpinning: boolean;
  isStopped: boolean;
  isWinner: boolean;
  blur?: boolean;
}

export function SlotReel({
  reelIndex,
  isSpinning,
  isStopped,
  isWinner,
}: SlotReelProps) {
  // Target index for the winning '7' symbol is index 2
  // We repeat the symbols array multiple times so the continuous loop looks infinite
  const symbolList = useMemo(() => {
    return [
      ...GAMING_SYMBOLS,
      ...GAMING_SYMBOLS,
      ...GAMING_SYMBOLS,
      ...GAMING_SYMBOLS,
      ...GAMING_SYMBOLS,
    ];
  }, []);

  // Symbol item height: 96px on desktop, 72px on mobile
  // Target winning index in repeated list: index 14 is the '7' symbol
  const targetOffset = 14 * 96;

  return (
    <div className="relative h-[96px] sm:h-[110px] w-24 sm:w-28 md:w-32 overflow-hidden rounded-xl bg-[#080809] border border-white/[0.12] shadow-inner">
      {/* Subtle glass reflection overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/60" />
      <div className="absolute inset-x-0 top-0 h-4 z-20 pointer-events-none bg-gradient-to-b from-white/[0.08] to-transparent" />

      {/* Payline central winning indicator guideline */}
      <div
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-[96px] sm:h-[110px] z-10 pointer-events-none border-y transition-colors duration-500 ${
          isWinner
            ? 'border-[#D71932] bg-[#D71932]/10 shadow-[0_0_15px_rgba(215,25,50,0.4)]'
            : 'border-white/[0.08]'
        }`}
      />

      {/* Reel strip */}
      <div
        className="flex flex-col transition-transform"
        style={{
          transform: isSpinning
            ? `translateY(-${(reelIndex + 1) * 600}px)`
            : isStopped || isWinner
            ? `translateY(-${targetOffset}px)`
            : 'translateY(-192px)', // Initial resting state (showing random symbol)
          transitionDuration: isSpinning
            ? `${1.2 + reelIndex * 0.25}s`
            : isStopped || isWinner
            ? `${0.7 + reelIndex * 0.3}s`
            : '0.4s',
          transitionTimingFunction: isSpinning
            ? 'cubic-bezier(0.4, 0, 0.2, 1)'
            : 'cubic-bezier(0.16, 1.2, 0.3, 1)', // Slight elastic bounce on stop
        }}
      >
        {symbolList.map((sym, idx) => {
          const isTargetSeven = sym.isSeven;
          return (
            <div
              key={`${sym.id}-${idx}`}
              className="flex h-[96px] sm:h-[110px] shrink-0 items-center justify-center select-none"
            >
              {isTargetSeven ? (
                <div
                  className={`flex items-center justify-center font-black transition-all duration-300 ${
                    isWinner
                      ? 'scale-115 text-[#D71932] drop-shadow-[0_0_18px_rgba(215,25,50,0.9)] animate-pulse'
                      : 'text-white'
                  }`}
                >
                  <span className="text-5xl sm:text-6xl tracking-tighter font-extrabold italic bg-gradient-to-b from-white via-[#F7F7F8] to-[#D71932] bg-clip-text text-transparent">
                    7
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center text-white/50">
                  <sym.icon className="h-9 w-9 sm:h-11 sm:w-11" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
