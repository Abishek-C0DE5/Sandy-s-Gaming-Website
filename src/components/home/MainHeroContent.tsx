'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, MessageSquare, Play, Sparkles, Trophy, ShieldCheck, Flame } from 'lucide-react';

interface MainHeroContentProps {
  onReplayIntro: () => void;
}

export function MainHeroContent({ onReplayIntro }: MainHeroContentProps) {
  return (
    <section className="relative z-10 w-full max-w-[1720px] mx-auto px-4 pt-12 pb-20 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column: Brand Copy & Actions */}
        <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 text-xs text-[var(--text-secondary)]">
            <Flame className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <span className="font-medium tracking-wide">
              Next-Gen Gaming &amp; Community Hub
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="animate-fade-up-delay-1 text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-black tracking-tight text-[var(--text-primary)] leading-[1.05]">
            Dominate the <br className="hidden sm:inline" />
            <span className="premium-text-gradient">
              Gaming Arena
            </span>
          </h1>

          {/* Description */}
          <p className="animate-fade-up-delay-2 max-w-2xl text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed mx-auto lg:mx-0">
            Welcome to <span className="text-[var(--text-primary)] font-semibold">Sandy&apos;s Gaming</span>. Unrivaled competitive tournaments, esports news, exclusive artwork, and direct 24/7 staff live chat support.
          </p>

          {/* Call to Actions */}
          <div className="animate-fade-up-delay-3 flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-1">
            <Link
              href="/blog"
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
            >
              <BookOpen className="h-4 w-4" />
              <span>Explore Articles</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/chat"
              className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[var(--text-primary)]"
            >
              <MessageSquare className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>Live Support</span>
            </Link>

            <button
              type="button"
              onClick={onReplayIntro}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-300"
              title="Watch the brand intro again"
            >
              <Play className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>Replay Intro</span>
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="animate-fade-up-delay-3 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-6 text-center lg:text-left">
            {[
              { value: '24/7', label: 'Live Support', icon: ShieldCheck },
              { value: '100%', label: 'Verified Tourneys', icon: Trophy },
              { value: 'PRO', label: 'Curated Content', icon: Sparkles },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label} className="group">
                <div className="text-xl sm:text-2xl font-black text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)] duration-300">
                  {value}
                </div>
                <div className="text-xs text-[var(--text-muted)] flex items-center justify-center lg:justify-start gap-1 mt-0.5">
                  <Icon className="h-3 w-3 text-[var(--brand-primary)]" />
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Clean Hero Brand Logo (No artificial border highlight box) */}
        <div className="lg:col-span-5 flex justify-center items-center animate-fade-up-delay-2">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 animate-float flex items-center justify-center select-none">
            <Image
              src="/brand/sandys-gaming-logo.png"
              alt="SANDY'S GAMING"
              fill
              priority
              sizes="(max-width: 768px) 256px, (max-width: 1024px) 320px, 384px"
              className="object-contain drop-shadow-2xl transition-transform duration-700 ease-out hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
