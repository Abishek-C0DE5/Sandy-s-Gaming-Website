'use client';

import { SlotReel } from './SlotReel';
import { CelebrationEffects } from './CelebrationEffects';
import { Sparkles } from 'lucide-react';

interface SlotMachineIntroProps {
  phase: 'idle' | 'entering' | 'spinning' | 'stopping' | 'winning' | 'logo-reveal' | 'transitioning' | 'complete';
}

export function SlotMachineIntro({ phase }: SlotMachineIntroProps) {
  const isSpinning = phase === 'spinning';
  const isStopping = phase === 'stopping';
  const isWinner = phase === 'winning';

  return (
    <div className="relative flex flex-col items-center justify-center transition-all duration-700">
      {/* 1. Ambient red backlight glow */}
      <div
        className={`absolute -inset-10 rounded-3xl transition-opacity duration-1000 pointer-events-none blur-3xl ${
          isWinner ? 'bg-[#D71932]/40 opacity-100' : 'bg-[#D71932]/15 opacity-70'
        }`}
        aria-hidden="true"
      />

      {/* 2. Celebration Particle/Flash Layer */}
      {isWinner && <CelebrationEffects />}

      {/* 3. Slot Machine Housing */}
      <div
        className={`relative z-10 w-full max-w-[420px] sm:max-w-[480px] rounded-3xl border transition-all duration-500 p-4 sm:p-6 shadow-2xl ${
          isWinner
            ? 'border-[#D71932] bg-[#101012] shadow-[0_0_60px_rgba(215,25,50,0.5)] scale-103'
            : 'border-white/[0.12] bg-[#101012]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)]'
        }`}
      >
        {/* Machine Marquee Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D71932] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D71932]" />
            </span>
            <span className="text-[11px] font-black tracking-[0.2em] text-[#F7F7F8] uppercase">
              SANDY&apos;S REEL ENGINE
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#171719] border border-white/[0.06] text-[10px] font-mono text-[#D71932]">
            <Sparkles className="h-3 w-3" />
            <span>JACKPOT 777</span>
          </div>
        </div>

        {/* Reels Frame & Payline Guideline */}
        <div className="relative p-2.5 sm:p-3.5 rounded-2xl bg-[#080809] border border-white/[0.08] shadow-inner">
          {/* Laser Payline Indicators (Left & Right Arrows) */}
          <div
            className={`absolute -left-2.5 top-1/2 -translate-y-1/2 z-30 transition-transform duration-300 ${
              isWinner ? 'scale-125' : ''
            }`}
          >
            <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-[#D71932] drop-shadow-[0_0_8px_#D71932]" />
          </div>
          <div
            className={`absolute -right-2.5 top-1/2 -translate-y-1/2 z-30 transition-transform duration-300 ${
              isWinner ? 'scale-125' : ''
            }`}
          >
            <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[10px] border-r-[#D71932] drop-shadow-[0_0_8px_#D71932]" />
          </div>

          {/* 3 Physical Reels */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 justify-items-center">
            <SlotReel
              reelIndex={0}
              isSpinning={isSpinning}
              isStopped={isStopping || isWinner}
              isWinner={isWinner}
            />
            <SlotReel
              reelIndex={1}
              isSpinning={isSpinning}
              isStopped={isStopping || isWinner}
              isWinner={isWinner}
            />
            <SlotReel
              reelIndex={2}
              isSpinning={isSpinning}
              isStopped={isStopping || isWinner}
              isWinner={isWinner}
            />
          </div>
        </div>

        {/* Status Display Footer */}
        <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
          <div className="font-mono text-[11px] text-[#A5A5AD]">
            STATUS: <span className="font-bold text-[#F7F7F8] uppercase">{phase}</span>
          </div>
          {isWinner ? (
            <div className="font-black text-[#D71932] tracking-wider animate-bounce flex items-center gap-1">
              <span>UNLOCKED: 777 MATCH</span>
            </div>
          ) : (
            <div className="font-mono text-[10px] text-[#A5A5AD]/80">
              SYNCHRONIZING SYMBOLS...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
