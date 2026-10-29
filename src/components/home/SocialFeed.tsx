'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Flame,
  Globe,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  ImageIcon,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { PostType } from '@/types/database';
import { FeedPostSkeleton } from '@/components/ui/Skeleton';

export interface FeedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body?: string | null;
  cover_image: string | null;
  post_type: PostType;
  published_at: string | null;
  created_at?: string;
  initialLikes?: number;
  commentsCount?: number;
}

const DEFAULT_POSTS: FeedPost[] = [
  {
    id: 'feed-1',
    title: 'VALORANT Champions 2026: Championship Roster Breakdown & Meta Analysis',
    slug: 'valorant-champions-2026-breakdown',
    excerpt:
      'With patch 9.0 shifts, the Duelist dynamic has fundamentally evolved. Here is how Tier 1 organizations are structuring agent compositions for maximum site control and retake efficiency.',
    cover_image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    post_type: 'blog',
    published_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    initialLikes: 284,
    commentsCount: 39,
  },
  {
    id: 'feed-2',
    title: 'Cyber Ninja: Oni Blade 4K Ultra-Wide Artwork Wallpaper',
    slug: 'cyber-ninja-oni-blade-wallpaper',
    excerpt:
      'Official Sandy\'s Gaming high-res digital release. Optimized for dual-monitor battlestations with HDR color grading and neon contrast calibration.',
    cover_image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    post_type: 'poster',
    published_at: new Date(Date.now() - 3600000 * 9).toISOString(),
    initialLikes: 412,
    commentsCount: 56,
  },
  {
    id: 'feed-3',
    title: 'CS2 Counter-Strat Playbook: Mirage Mid & A-Site Retake Protocols',
    slug: 'cs2-mirage-retake-playbook',
    excerpt:
      'Smokes, flashes, and dual-peeking angles analyzed from the latest Major semi-finals. Master these utility timings to elevate your competitive team play.',
    cover_image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    post_type: 'blog',
    published_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    initialLikes: 195,
    commentsCount: 22,
  },
  {
    id: 'feed-4',
    title: 'Apex Legends Global Series: Winter Split Weapon Tier List & Pick Rates',
    slug: 'apex-legends-winter-tier-list',
    excerpt:
      'Comprehensive breakdown of SMG recoil changes, assault rifle attachment nerfs, and the evolving Care Package drop meta for competitive squads.',
    cover_image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80',
    post_type: 'blog',
    published_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    initialLikes: 341,
    commentsCount: 45,
  },
  {
    id: 'feed-5',
    title: 'Neon Ronin: Mecha Vanguard Concept Poster Release',
    slug: 'neon-ronin-mecha-vanguard-poster',
    excerpt:
      'Exclusive digital artwork inspired by neo-Tokyo cyberpunk tournaments. Rendered in full cinematic 8K resolution for Sandy\'s Gaming community members.',
    cover_image: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
    post_type: 'poster',
    published_at: new Date(Date.now() - 3600000 * 42).toISOString(),
    initialLikes: 512,
    commentsCount: 78,
  },
  {
    id: 'feed-6',
    title: 'Optimal Ergonomics & Refresh Rates for Competitive FPS Players',
    slug: 'optimal-ergonomics-refresh-rates',
    excerpt:
      'From 240Hz vs 360Hz response timings to desk height and wrist alignment, learn how pro esports athletes prevent fatigue during 12-hour tournament grinds.',
    cover_image: 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1200&q=80',
    post_type: 'blog',
    published_at: new Date(Date.now() - 3600000 * 55).toISOString(),
    initialLikes: 260,
    commentsCount: 31,
  },
];

const BATCH_SIZE = 6;

export function SocialFeed({ initialPosts = [] }: { initialPosts?: FeedPost[] }) {
  const [filter, setFilter] = useState<'all' | 'blog' | 'gallery'>('all');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Combine real database posts with fallbacks
  const allPosts = initialPosts.length > 0 ? initialPosts : DEFAULT_POSTS;

  const filteredPosts = allPosts.filter((p) => {
    if (filter === 'blog') return p.post_type === 'blog';
    if (filter === 'gallery') return p.post_type === 'poster' || p.post_type === 'photo';
    return true;
  });

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    // Smooth step-by-step progressive chunk loading with skeleton feedback
    setTimeout(() => {
      setVisibleCount((prev) => prev + BATCH_SIZE);
      setIsLoadingMore(false);
    }, 600);
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const diffHours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filters = [
    { key: 'all' as const, label: 'All Updates', icon: null },
    { key: 'blog' as const, label: 'Articles', icon: BookOpen },
    { key: 'gallery' as const, label: 'Art & Posters', icon: ImageIcon },
  ];

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
      {/* Feed Controls Header */}
      <div className="mb-8 border-b border-white/[0.06] pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
            <Flame className="h-4 w-4" />
            <span>Community &amp; Esports Feed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-white mt-1">
            Sandy&apos;s Live Stream
          </h2>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl glass text-xs font-semibold">
          {filters.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                setVisibleCount(BATCH_SIZE);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all duration-300 ${
                filter === key
                  ? 'btn-primary text-white'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Full-Width Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedPosts.map((post, index) => {
          const detailUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;

          return (
            <article
              key={post.id}
              className="rounded-2xl glass-elevated overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-2xl"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div>
                {/* Post Header: Avatar, Author, Timestamp (No highlight border around image) */}
                <div className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
                      <Image
                        src="/brand/sandys-gaming-logo.png"
                        alt="Sandy's Gaming"
                        width={40}
                        height={40}
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-white">
                          Sandy&apos;s Esports HQ
                        </span>
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                        <span>{formatTimestamp(post.published_at)}</span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1 font-sans">
                          <Globe className="h-3 w-3" />
                          <span>Public</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass text-[10px] font-semibold tracking-wide text-[var(--text-secondary)]">
                    {post.post_type === 'blog' ? 'Article' : 'Artwork'}
                  </span>
                </div>

                {/* Post Copy / Content */}
                <div className="px-4 sm:px-5 pb-3 space-y-1.5">
                  <Link href={detailUrl} className="group block">
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[var(--brand-primary)] transition-colors duration-300 leading-snug line-clamp-2">
                      {post.title}
                    </h3>
                  </Link>
                  {post.excerpt && (
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                </div>

                {/* Post Media (Clean image presentation without border highlight) */}
                {post.cover_image && (
                  <Link href={detailUrl} className="block relative aspect-[16/9] w-full bg-[var(--background)] overflow-hidden group">
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  </Link>
                )}
              </div>

              {/* Action Footer */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-t border-white/[0.04]">
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {post.post_type === 'blog' ? 'Editorial' : 'Media'}
                </span>

                <Link
                  href={detailUrl}
                  className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white group"
                >
                  <span>{post.post_type === 'blog' ? 'Read Article' : 'View Artwork'}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </article>
          );
        })}

        {/* Shimmer Skeletons while step-by-step loading next batch */}
        {isLoadingMore && (
          <>
            <FeedPostSkeleton />
            <FeedPostSkeleton />
            <FeedPostSkeleton />
          </>
        )}
      </div>

      {/* Step-by-Step Progressive Load More Button */}
      {hasMore && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={handleLoadMore}
            className="btn-ghost inline-flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-sm font-semibold text-white hover:border-white/[0.15] disabled:opacity-50 transition-all duration-300"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-primary)]" />
                <span>Loading Next Batch...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>Load More Updates ({filteredPosts.length - visibleCount} remaining)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
