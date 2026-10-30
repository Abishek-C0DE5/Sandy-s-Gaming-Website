import Link from 'next/link';
import Image from 'next/image';
import { connection } from 'next/server';
import { createPublicClient } from '@/lib/supabase/server';
import { CinematicHeroContainer } from '@/components/home/CinematicHeroContainer';
import { SocialFeed } from '@/components/home/SocialFeed';
import {
  BookOpen,
  MessageSquare,
  ArrowRight,
  Calendar,
  Sparkles,
  Flame,
  Users,
} from 'lucide-react';

export const instant = false;

export default async function HomePage() {
  await connection();
  const supabase = createPublicClient();

  // Query recent feed posts, blog articles, and gallery items in parallel
  const [
    { data: feedPosts },
    { data: recentBlogs },
    { data: recentGallery },
  ] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, slug, excerpt, body, cover_image, post_type, published_at, created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(18),
    supabase
      .from('posts')
      .select('id, title, slug, excerpt, cover_image, published_at')
      .eq('post_type', 'blog')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('posts')
      .select('id, title, slug, excerpt, cover_image, post_type, published_at')
      .in('post_type', ['poster', 'photo'])
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),
  ]);

  const blogs = recentBlogs || [];
  const gallery = recentGallery || [];

  return (
    <div className="relative isolate overflow-hidden space-y-28" suppressHydrationWarning>
      {/* 1. Cinematic Slot-Reveal Hero Container */}
      <CinematicHeroContainer />

      {/* 2. Community & Esports Social Feed (Fluid Full-Width Grid with Progressive Step-by-Step Loading) */}
      <section className="relative">
        <SocialFeed initialPosts={feedPosts || []} />
      </section>

      {/* 3. Featured Esports Articles Section (Fluid Full-Desktop Width) */}
      {blogs.length > 0 && (
        <section className="w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.08] pb-5 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--brand-highlight)]">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Editorial Feed</span>
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl xl:text-3xl font-black tracking-tight text-white">
                Recent Publications
              </h2>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <span>View All Articles</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-6 grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {blogs.map((post) => (
              <article
                key={post.id}
                className="gaming-card group flex flex-col justify-between overflow-hidden"
              >
                {/* Media Image */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface-secondary)]">
                  {post.cover_image ? (
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <BookOpen className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Article
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <Calendar className="h-3 w-3 text-[var(--brand-highlight)]" />
                      <time dateTime={post.published_at || ''}>
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Published'}
                      </time>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[var(--brand-highlight)] transition-colors duration-200 line-clamp-2 leading-snug">
                      <Link href={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </h3>

                    {post.excerpt && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-highlight)] group-hover:text-white transition-colors"
                    >
                      <span>Read Article</span>
                      <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 4. Posters & Visual Media Showcase (Fluid Full-Desktop Width) */}
      {gallery.length > 0 && (
        <section className="w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.08] pb-5 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--brand-highlight)]">
                <Flame className="h-3.5 w-3.5" />
                <span>Gallery &amp; Artwork</span>
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl xl:text-3xl font-black tracking-tight text-white">
                Featured Posters &amp; Visuals
              </h2>
            </div>
            <Link
              href="/posts"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <span>Explore Gallery</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-6 grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((post) => (
              <article
                key={post.id}
                className="gaming-card group flex flex-col justify-between overflow-hidden"
              >
                {/* Media Image */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface-secondary)]">
                  {post.cover_image ? (
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <Sparkles className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white capitalize">
                    {post.post_type}
                  </div>
                </div>

                <div className="p-4 sm:p-4.5 space-y-2">
                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[var(--brand-highlight)] transition-colors duration-200 line-clamp-1">
                    <Link href={`/posts/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h3>
                  {post.excerpt && (
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="pt-2 border-t border-white/[0.06]">
                    <Link
                      href={`/posts/${post.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-highlight)] hover:text-white transition-colors"
                    >
                      <span>View Artwork</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 5. Live Support Command Banner (Refined Architecture) */}
      <section className="w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-20">
        <div className="relative rounded-2xl bg-[#0F1117] border border-white/[0.08] p-8 sm:p-12 overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--brand-primary)] to-transparent" />
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-xs font-semibold text-[var(--brand-highlight)]">
              <Users className="h-3.5 w-3.5" />
              <span>Direct Support</span>
            </div>
            <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-white leading-tight">
              Need Help or Tournament Inquiries?
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Connect directly with our staff via authenticated live chat or submit a guest inquiry. We are here to support every player.
            </p>
            <div className="pt-3 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Open Live Chat</span>
              </Link>
              <Link
                href="/contact"
                className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
              >
                <span>Submit Guest Ticket</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
