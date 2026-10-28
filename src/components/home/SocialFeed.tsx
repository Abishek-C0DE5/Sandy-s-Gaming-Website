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
} from 'lucide-react';
import type { PostType } from '@/types/database';

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
];

export function SocialFeed({ initialPosts = [] }: { initialPosts?: FeedPost[] }) {
  const [filter, setFilter] = useState<'all' | 'blog' | 'gallery'>('all');

  // Combine real database posts with fallbacks if empty
  const posts = initialPosts.length > 0 ? initialPosts : DEFAULT_POSTS;

  const filteredPosts = posts.filter((p) => {
    if (filter === 'blog') return p.post_type === 'blog';
    if (filter === 'gallery') return p.post_type === 'poster' || p.post_type === 'photo';
    return true;
  });

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const diffHours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      {/* Feed Controls Header */}
      <div className="mb-8 border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D71932]">
            <Flame className="h-4 w-4" />
            <span>Community &amp; Esports Feed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mt-1">
            Sandy&apos;s Live Stream
          </h2>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#101012] border border-white/[0.08] text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'all'
                ? 'bg-[#D71932] text-white shadow-[0_0_12px_rgba(215,25,50,0.35)]'
                : 'text-[#A5A5AD] hover:text-white'
            }`}
          >
            All Updates
          </button>
          <button
            type="button"
            onClick={() => setFilter('blog')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              filter === 'blog'
                ? 'bg-[#D71932] text-white shadow-[0_0_12px_rgba(215,25,50,0.35)]'
                : 'text-[#A5A5AD] hover:text-white'
            }`}
          >
            <BookOpen className="h-3 w-3" />
            <span>Articles</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('gallery')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              filter === 'gallery'
                ? 'bg-[#D71932] text-white shadow-[0_0_12px_rgba(215,25,50,0.35)]'
                : 'text-[#A5A5AD] hover:text-white'
            }`}
          >
            <ImageIcon className="h-3 w-3" />
            <span>Art &amp; Posters</span>
          </button>
        </div>
      </div>

      {/* Social Feed Items */}
      <div className="space-y-6">
        {filteredPosts.map((post) => {
          const detailUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;

          return (
            <article
              key={post.id}
              className="rounded-2xl border border-white/[0.08] bg-[#101012] overflow-hidden shadow-2xl transition-all duration-200 hover:border-white/[0.16]"
            >
              {/* Post Header: Avatar, Author, Timestamp */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 rounded-full overflow-hidden border border-[#D71932]/40 bg-[#171719] flex items-center justify-center shrink-0">
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
                      <span className="font-bold text-sm text-white tracking-wide">
                        Sandy&apos;s Esports HQ
                      </span>
                      <ShieldCheck className="h-3.5 w-3.5 text-[#D71932] fill-[#D71932]/20" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#A5A5AD]">
                      <span>{formatTimestamp(post.published_at)}</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        <span>Public</span>
                      </span>
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#171719] border border-white/[0.08] text-[10px] font-bold uppercase tracking-wider text-[#D71932]">
                  {post.post_type === 'blog' ? 'Tactical Guide' : 'Exclusive Poster'}
                </span>
              </div>

              {/* Post Copy / Content */}
              <div className="px-4 sm:px-5 pt-3 pb-2 space-y-2">
                <Link href={detailUrl} className="group block">
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#D71932] transition-colors leading-snug">
                    {post.title}
                  </h3>
                </Link>
                {post.excerpt && (
                  <p className="text-xs sm:text-sm text-[#A5A5AD] leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                )}
              </div>

              {/* Post Media (Image) */}
              {post.cover_image && (
                <Link href={detailUrl} className="block relative aspect-[16/9] w-full bg-[#080809] overflow-hidden group">
                  <Image
                    src={post.cover_image}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101012] via-transparent to-transparent opacity-40 group-hover:opacity-20 transition-opacity" />
                </Link>
              )}

              {/* Clean Gaming Card Action Footer */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-t border-white/[0.04] bg-[#0c0c0e]">
                <div className="flex items-center gap-2 text-xs text-[#A5A5AD]">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                    {post.post_type === 'blog' ? 'Editorial Article' : 'Media Asset'}
                  </span>
                </div>

                <Link
                  href={detailUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#171719] border border-white/[0.08] px-4 py-2 text-xs font-bold text-white hover:bg-[#D71932] hover:border-[#D71932] transition-all transform hover:-translate-y-0.5 group"
                >
                  <span>{post.post_type === 'blog' ? 'Read Full Intel' : 'View High-Res Artwork'}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
