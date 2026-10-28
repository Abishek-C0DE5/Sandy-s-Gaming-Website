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

  // Constant symbol item height across ALL viewports: 100px
  // Target winning index in repeated list: index 14 is the '7' symbol
  // 14 * 100 = 1400px lands perfectly on 7-7-7 on desktop, laptop and mobile!
  const ITEM_HEIGHT = 100;
  const targetOffset = 14 * ITEM_HEIGHT;

  return (
    <div className="relative h-[100px] w-24 sm:w-28 md:w-32 overflow-hidden rounded-xl bg-[#080809] border border-white/[0.12] shadow-inner">
      {/* Subtle glass reflection overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/60" />
      <div className="absolute inset-x-0 top-0 h-4 z-20 pointer-events-none bg-gradient-to-b from-white/[0.08] to-transparent" />

      {/* Payline central winning indicator guideline */}
      <div
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-[100px] z-10 pointer-events-none border-y transition-colors duration-500 ${
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
            ? `translateY(-${targetOffset + 1200 + (reelIndex + 1) * 300}px)`
            : isStopped || isWinner
            ? `translateY(-${targetOffset}px)`
            : `translateY(-${2 * ITEM_HEIGHT}px)`, // Initial resting state
          transitionDuration: isSpinning
            ? `${1.0 + reelIndex * 0.25}s`
            : isStopped || isWinner
            ? `${0.6 + reelIndex * 0.2}s`
            : '0.4s',
          transitionTimingFunction: isSpinning
            ? 'linear'
            : 'cubic-bezier(0.16, 1, 0.3, 1)', // Smooth ease-out stop directly onto 7
        }}
      >
        {symbolList.map((sym, idx) => {
          const isTargetSeven = sym.isSeven;
          return (
            <div
              key={`${sym.id}-${idx}`}
              className="flex h-[100px] shrink-0 items-center justify-center select-none"
            >
              {isTargetSeven ? (
                <div
                  className={`flex items-center justify-center font-black transition-all duration-300 ${
                    isWinner
                      ? 'scale-115 text-[#D71932] drop-shadow-[0_0_20px_rgba(215,25,50,0.9)]'
                      : 'text-white'
                  }`}
                >
                  <span className="text-6xl tracking-tighter font-black italic bg-gradient-to-b from-white via-[#F7F7F8] to-[#D71932] bg-clip-text text-transparent">
                    7
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center text-white/50">
                  <sym.icon className="h-10 w-10" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
