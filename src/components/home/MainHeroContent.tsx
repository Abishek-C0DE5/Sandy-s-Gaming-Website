'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, MessageSquare, Play, Sparkles, Trophy, ShieldCheck, Flame } from 'lucide-react';

interface MainHeroContentProps {
  onReplayIntro: () => void;
}

export function MainHeroContent({ onReplayIntro }: MainHeroContentProps) {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#D71932]/15 blur-[120px] rounded-full pointer-events-none"
        aria-hidden="true"
      />

      <div className="grid lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Brand Copy & Actions */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D71932]/40 bg-[#171719] px-3 py-1 text-xs text-[#F7F7F8]">
            <Flame className="h-3.5 w-3.5 text-[#D71932] animate-pulse" />
            <span className="font-semibold tracking-wide uppercase text-[11px]">
              Next-Gen Gaming &amp; Community Hub
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#F7F7F8] uppercase leading-[1.08]">
            DOMINATE THE <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-white via-[#F7F7F8] to-[#D71932] bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(215,25,50,0.4)]">
              GAMING ARENA
            </span>
          </h1>

          {/* Description */}
          <p className="max-w-2xl text-base sm:text-lg text-[#A5A5AD] leading-relaxed mx-auto lg:mx-0">
            Welcome to <span className="text-[#F7F7F8] font-bold">SANDY&apos;S GAMING</span>. Unrivaled competitive tournaments, esports news, exclusive artwork, and direct 24/7 staff live chat support. Built for true warriors.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-xl bg-[#D71932] px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(215,25,50,0.4)] hover:bg-[#b01328] hover:shadow-[0_0_30px_rgba(215,25,50,0.6)] hover:scale-102 transition-all"
            >
              <BookOpen className="h-4 w-4" />
              <span>Explore Gaming Articles</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#171719] px-6 py-3.5 text-sm font-bold text-[#F7F7F8] hover:border-[#D71932]/50 hover:bg-[#101012] transition-all"
            >
              <MessageSquare className="h-4 w-4 text-[#D71932]" />
              <span>Live Support Chat</span>
            </Link>

            <button
              type="button"
              onClick={onReplayIntro}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-4 py-3.5 text-xs font-semibold text-[#A5A5AD] hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Watch the 777 Slot Machine Brand Intro Again"
            >
              <Play className="h-3.5 w-3.5 text-[#D71932]" />
              <span>Replay Intro</span>
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="pt-6 border-t border-white/[0.08] grid grid-cols-3 gap-4 text-center lg:text-left">
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#F7F7F8]">24 / 7</div>
              <div className="text-xs text-[#A5A5AD] flex items-center justify-center lg:justify-start gap-1">
                <ShieldCheck className="h-3 w-3 text-[#D71932]" />
                <span>Active Live Support</span>
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#F7F7F8]">100%</div>
              <div className="text-xs text-[#A5A5AD] flex items-center justify-center lg:justify-start gap-1">
                <Trophy className="h-3 w-3 text-[#D71932]" />
                <span>Verified Tournaments</span>
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-[#F7F7F8]">PRO</div>
              <div className="text-xs text-[#A5A5AD] flex items-center justify-center lg:justify-start gap-1">
                <Sparkles className="h-3 w-3 text-[#D71932]" />
                <span>Curated Content</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual Artwork */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
            {/* Ambient Red Halo */}
            <div className="absolute inset-4 rounded-full bg-[#D71932]/25 blur-3xl pointer-events-none" />

            {/* Glowing Polygon Ring */}
            <div className="absolute inset-0 rounded-3xl border border-[#D71932]/30 bg-gradient-to-b from-[#171719]/80 to-[#101012]/90 backdrop-blur-md shadow-2xl p-6 flex flex-col items-center justify-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 drop-shadow-[0_15px_30px_rgba(215,25,50,0.4)]">
                <Image
                  src="/brand/sandys-gaming-logo.png"
                  alt="SANDY'S GAMING"
                  fill
                  priority
                  sizes="(max-width: 768px) 256px, 288px"
                  className="object-contain hover:scale-105 transition-transform duration-500"
                />
              </div>

              <div className="mt-4 px-4 py-1.5 rounded-full bg-[#080809]/80 border border-white/[0.08] text-[11px] font-mono tracking-wider text-[#A5A5AD]">
                AUTHENTIC ESPORTS IDENTITY
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
