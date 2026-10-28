'use client';

import { useState, useEffect, useCallback } from 'react';
import { SlotMachineIntro } from './SlotMachineIntro';
import { LogoReveal } from './LogoReveal';
import { MainHeroContent } from './MainHeroContent';
import { FastForward } from 'lucide-react';

export type IntroPhase =
  | 'idle'
  | 'entering'
  | 'spinning'
  | 'stopping'
  | 'winning'
  | 'logo-reveal'
  | 'transitioning'
  | 'complete';

export function CinematicHeroContainer() {
  const [phase, setPhase] = useState<IntroPhase>('idle');
  const [mounted, setMounted] = useState(false);

  const completeIntro = useCallback(() => {
    setPhase('complete');
    try {
      sessionStorage.setItem('sandys_intro_seen', 'true');
    } catch {
      // Ignore storage limitations
    }
  }, []);

  const startIntroSequence = useCallback(() => {
    setPhase('entering');
  }, []);

  // Handle escape key to skip intro
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'complete') {
        completeIntro();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, completeIntro]);

  // Initial mount check: respect reduced motion or session preference
  useEffect(() => {
    setMounted(true);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasSeenIntro = sessionStorage.getItem('sandys_intro_seen') === 'true';

    if (prefersReducedMotion || hasSeenIntro) {
      setPhase('complete');
      return;
    }

    // Begin sequence on first visit
    const startTimer = setTimeout(() => {
      startIntroSequence();
    }, 200);

    return () => clearTimeout(startTimer);
  }, [startIntroSequence]);

  // State machine timer progression
  useEffect(() => {
    if (phase === 'entering') {
      const timer = setTimeout(() => setPhase('spinning'), 600);
      return () => clearTimeout(timer);
    }
    if (phase === 'spinning') {
      const timer = setTimeout(() => setPhase('stopping'), 1400);
      return () => clearTimeout(timer);
    }
    if (phase === 'stopping') {
      const timer = setTimeout(() => setPhase('winning'), 1200);
      return () => clearTimeout(timer);
    }
    if (phase === 'winning') {
      const timer = setTimeout(() => setPhase('logo-reveal'), 1600);
      return () => clearTimeout(timer);
    }
    if (phase === 'logo-reveal') {
      const timer = setTimeout(() => setPhase('transitioning'), 2200);
      return () => clearTimeout(timer);
    }
    if (phase === 'transitioning') {
      const timer = setTimeout(() => completeIntro(), 800);
      return () => clearTimeout(timer);
    }
  }, [phase, completeIntro]);

  // Replay intro function
  const handleReplay = () => {
    try {
      sessionStorage.removeItem('sandys_intro_seen');
    } catch {
      // Ignore
    }
    setPhase('entering');
  };

  // SSR skeleton placeholder until mounted
  if (!mounted) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#D71932] border-t-transparent animate-spin" />
      </div>
    );
  }

  // If complete, render the full homepage hero
  if (phase === 'complete') {
    return <MainHeroContent onReplayIntro={handleReplay} />;
  }

  // Active Cinematic Animation Sequence
  return (
    <section className="relative min-h-[580px] sm:min-h-[640px] flex flex-col items-center justify-center px-4 overflow-hidden bg-[#080809]">
      {/* Top Floating Controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={completeIntro}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#101012]/80 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-[#A5A5AD] hover:text-white hover:border-[#D71932]/60 hover:bg-[#171719] transition-all"
        >
          <FastForward className="h-3.5 w-3.5 text-[#D71932]" />
          <span>Skip Intro</span>
          <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 rounded text-[10px] bg-white/[0.08] text-white">Esc</kbd>
        </button>
      </div>

      {/* Atmospheric Background Streaks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#D71932]/10 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#171719_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      {/* Phase A/B/C: Slot Machine Sequence */}
      {(phase === 'entering' || phase === 'spinning' || phase === 'stopping' || phase === 'winning') && (
        <div className="relative z-20 w-full flex justify-center animate-in fade-in zoom-in-95 duration-500">
          <SlotMachineIntro phase={phase} />
        </div>
      )}

      {/* Phase D: Dark Cinematic Logo Reveal */}
      {phase === 'logo-reveal' && (
        <div className="relative z-20 w-full flex justify-center">
          <LogoReveal />
        </div>
      )}

      {/* Phase E: Transitioning into Hero */}
      {phase === 'transitioning' && (
        <div className="relative z-20 w-full flex justify-center animate-out fade-out duration-700">
          <LogoReveal />
        </div>
      )}
    </section>
  );
}
