import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { CinematicHeroContainer } from '@/components/home/CinematicHeroContainer';
import {
  BookOpen,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  Flame,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';

export default async function HomePage() {
  await connection();
  const supabase = await createClient();

  // Query recent published blog articles (limit 3)
  const { data: recentBlogs } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, published_at')
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(3);

  // Query recent published gallery items (limit 3)
  const { data: recentGallery } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, post_type, published_at')
    .in('post_type', ['poster', 'photo'])
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(3);

  const blogs = recentBlogs || [];
  const gallery = recentGallery || [];

  return (
    <div className="relative isolate overflow-hidden space-y-24 bg-[#080809] text-[#F7F7F8]">
      {/* 1. Cinematic Slot-Reveal Hero Container */}
      <CinematicHeroContainer />

      {/* 2. Brand Value & Arena Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171719] border border-[#D71932]/30 text-xs font-bold text-[#D71932] uppercase tracking-wider">
            <Swords className="h-3.5 w-3.5" />
            <span>The Sandy&apos;s Advantage</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#F7F7F8]">
            Engineered For <span className="text-[#D71932]">Competitors</span>
          </h2>
          <p className="mt-2 text-sm text-[#A5A5AD]">
            Everything a competitive gamer and fan needs — from tournament reports and tactical guides to direct support.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="gaming-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-[#D71932]/10 rounded-full blur-2xl group-hover:bg-[#D71932]/25 transition-all" />
            <div className="h-12 w-12 rounded-xl bg-[#171719] border border-white/[0.08] flex items-center justify-center text-[#D71932] mb-4">
              <Trophy className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-[#F7F7F8] tracking-tight">Competitive Coverage</h3>
            <p className="mt-2 text-sm text-[#A5A5AD] leading-relaxed">
              In-depth tournament analysis, player rosters, meta tier lists, and tactical breakdowns curated by seasoned competitors.
            </p>
          </div>

          <div className="gaming-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-[#D71932]/10 rounded-full blur-2xl group-hover:bg-[#D71932]/25 transition-all" />
            <div className="h-12 w-12 rounded-xl bg-[#171719] border border-white/[0.08] flex items-center justify-center text-[#D71932] mb-4">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-[#F7F7F8] tracking-tight">Exclusive Art &amp; Media</h3>
            <p className="mt-2 text-sm text-[#A5A5AD] leading-relaxed">
              Official high-resolution anime and warrior-themed posters, desktop wallpapers, and custom esports artwork.
            </p>
          </div>

          <div className="gaming-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-[#D71932]/10 rounded-full blur-2xl group-hover:bg-[#D71932]/25 transition-all" />
            <div className="h-12 w-12 rounded-xl bg-[#171719] border border-white/[0.08] flex items-center justify-center text-[#D71932] mb-4">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-[#F7F7F8] tracking-tight">Real-Time Staff Support</h3>
            <p className="mt-2 text-sm text-[#A5A5AD] leading-relaxed">
              Authenticated live customer chat with our multi-admin Support Team. Instant answers, ticket tracking, and direct inquiry follow-up.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Featured Esports Articles Section (Real Data from Supabase) */}
      {blogs.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.08] pb-4 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D71932]">
                <BookOpen className="h-4 w-4" />
                <span>Editorial Feed</span>
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#F7F7F8]">
                Recent Publications
              </h2>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A5A5AD] hover:text-[#D71932] transition-colors"
            >
              <span>View All Articles</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {blogs.map((post) => (
              <article
                key={post.id}
                className="gaming-card group flex flex-col overflow-hidden rounded-2xl"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-[#171719]">
                  {post.cover_image ? (
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-600">
                      <BookOpen className="h-10 w-10 opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 rounded-full bg-[#080809]/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-[#D71932] border border-white/[0.08]">
                    BLOG
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 text-xs text-[#A5A5AD] font-mono">
                    <Calendar className="h-3.5 w-3.5 text-[#D71932]" />
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

                  <h3 className="mt-2 text-base font-bold text-[#F7F7F8] group-hover:text-[#D71932] transition-colors line-clamp-2">
                    <Link href={`/blog/${post.slug}`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </Link>
                  </h3>

                  {post.excerpt && (
                    <p className="mt-2 text-xs text-[#A5A5AD] line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="mt-auto pt-4 flex items-center gap-1 text-xs font-semibold text-[#D71932]">
                    <span>Read Article</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 4. Posters & Visual Media Showcase */}
      {gallery.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.08] pb-4 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D71932]">
                <Flame className="h-4 w-4" />
                <span>Gallery &amp; Artwork</span>
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#F7F7F8]">
                Featured Posters &amp; Visuals
              </h2>
            </div>
            <Link
              href="/posts"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A5A5AD] hover:text-[#D71932] transition-colors"
            >
              <span>Explore Gallery</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((post) => (
              <article
                key={post.id}
                className="gaming-card group flex flex-col overflow-hidden rounded-2xl"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#171719]">
                  {post.cover_image ? (
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-600">
                      <Sparkles className="h-10 w-10 opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 rounded-full bg-[#080809]/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-[#D71932] border border-white/[0.08] uppercase">
                    {post.post_type}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="text-sm font-bold text-[#F7F7F8] group-hover:text-[#D71932] transition-colors line-clamp-1">
                    <Link href={`/posts/${post.slug}`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </Link>
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 5. Live Support & Community Call-To-Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="relative rounded-3xl border border-[#D71932]/30 bg-gradient-to-r from-[#171719] via-[#101012] to-[#171719] p-8 sm:p-12 overflow-hidden shadow-2xl">
          <div
            className="absolute top-0 right-0 w-96 h-96 bg-[#D71932]/15 blur-[100px] rounded-full pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#D71932]/15 border border-[#D71932]/30 px-3 py-1 text-xs font-bold text-[#D71932] uppercase">
              <Users className="h-3.5 w-3.5" />
              <span>Direct Gamer Support</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black uppercase text-[#F7F7F8] tracking-tight">
              Need Help or Tournament Inquiries?
            </h2>
            <p className="text-sm sm:text-base text-[#A5A5AD] leading-relaxed">
              Connect directly with our staff via authenticated live chat or submit a guest inquiry. We are here to support every warrior.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-[#D71932] px-6 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(215,25,50,0.4)] hover:bg-[#b01328] transition-all"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Open Live Chat</span>
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#080809] px-6 py-3 text-sm font-bold text-[#F7F7F8] hover:border-[#D71932]/40 transition-colors"
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
