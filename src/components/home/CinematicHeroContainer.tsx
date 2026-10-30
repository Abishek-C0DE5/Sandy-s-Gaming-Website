'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Sparkles,
  Trophy,
  ShieldCheck,
  Flame,
  ImageIcon,
} from 'lucide-react';

export function CinematicHeroContainer() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.defaultMuted = true;
      video.muted = true;
      video.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  }, []);

  return (
    <section className="relative min-h-[640px] lg:min-h-[720px] xl:min-h-[780px] w-full flex items-center overflow-hidden border-b border-white/[0.06]">
      {/* 1. Looping Background Video (Audio Removed / Muted, Hardware Accelerated) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover scale-[1.02] filter brightness-[0.75] contrast-[1.08] opacity-40 transition-opacity duration-700"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* 2. Color overlays blending with Sandy's Gaming theme */}
        {/* Deep dark gradient from left and bottom for crystal-clear text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/90 lg:via-[var(--background)]/75 to-transparent" />

        {/* Seamless bottom transition into the next section */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[var(--background)]" />
      </div>

      {/* 3. Hero Content Foreground Container */}
      <div className="relative z-10 w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-16 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Brand Copy & Actions */}
          <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
            {/* Live Status Badge */}
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3.5 py-1.5 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <span className="font-semibold tracking-wider uppercase text-[11px] text-slate-200">
                Official Esports &amp; Gaming Platform
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="animate-fade-up-delay-1 text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-black tracking-tight text-white leading-[1.05]">
              Dominate The <br className="hidden sm:inline" />
              <span className="text-[var(--brand-highlight)]">
                Gaming Arena
              </span>
            </h1>

            {/* Description */}
            <p className="animate-fade-up-delay-2 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed mx-auto lg:mx-0">
              Welcome to <span className="text-white font-semibold">Sandy&apos;s Gaming</span>. Unrivaled competitive tournament coverage, esports meta analysis, exclusive digital artwork, and direct 24/7 staff live support.
            </p>

            {/* Action Buttons */}
            <div className="animate-fade-up-delay-3 flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-1">
              <Link
                href="/blog"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span>Explore Articles</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/chat"
                className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
              >
                <MessageSquare className="h-4 w-4 text-[var(--brand-highlight)]" />
                <span>Live Support</span>
              </Link>

              <Link
                href="/posts"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all duration-200"
              >
                <ImageIcon className="h-3.5 w-3.5 text-[var(--brand-highlight)]" />
                <span>Artwork Gallery</span>
              </Link>
            </div>

            {/* Trust Highlights */}
            <div className="animate-fade-up-delay-3 pt-8 border-t border-white/[0.08] grid grid-cols-3 gap-3.5 sm:gap-4 text-center lg:text-left">
              {[
                { value: '24/7', label: 'Live Staff Desk', sub: 'Instant Response' },
                { value: '100%', label: 'Verified Meta', sub: 'Tier-1 Tourney Data' },
                { value: 'PRO', label: 'Curated Assets', sub: '4K Esports Visuals' },
              ].map(({ value, label, sub }) => (
                <div key={label} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                  <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {value}
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">
                    {label}
                  </div>
                  <div className="text-[10px] text-slate-400 hidden sm:block mt-0.5">
                    {sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Clean Hero Brand Logo (High quality, lossless, razor-sharp) */}
          <div className="lg:col-span-5 flex justify-center items-center animate-fade-up-delay-2">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 flex items-center justify-center select-none">
              <Image
                src="/brand/sandys-gaming-logo.png"
                alt="SANDY'S GAMING"
                fill
                priority
                unoptimized={true}
                sizes="(max-width: 768px) 256px, (max-width: 1024px) 320px, 384px"
                className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-transform duration-500 ease-out hover:scale-[1.03]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
