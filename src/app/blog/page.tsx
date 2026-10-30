import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { connection } from 'next/server';
import { createPublicClient } from '@/lib/supabase/server';
import { BookOpen, Calendar, Clock, ArrowRight, ChevronLeft, ChevronRight, Search, Flame } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Blog & Esports Meta Breakdown',
  description:
    'Explore in-depth esports tournament breakdowns, patch 9.0 meta analysis, competitive FPS guides, and Sandy\'s Gaming community updates.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Blog & Esports Meta Breakdown | Sandy\'s Gaming',
    description:
      'Explore in-depth esports tournament breakdowns, patch 9.0 meta analysis, competitive FPS guides, and Sandy\'s Gaming community updates.',
    type: 'website',
  },
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export const instant = false;

export default async function BlogListingPage({ searchParams }: BlogPageProps) {
  await connection();
  const { page, q } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const pageSize = 6;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createPublicClient();

  let query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, published_at, post_type', { count: 'exact' })
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike('title', `%${q.trim()}%`);
  }

  const { data: posts, count, error } = await query;

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const blogList = posts || [];

  return (
    <div className="w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 py-12 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-white/[0.06] pb-8 gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
            <Flame className="h-4 w-4" />
            <span>Sandy&apos;s Editorial &amp; Esports Feed</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--text-primary)]">
            Latest Publications
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            In-depth guides on competitive gaming, esports rosters, and platform updates curated by Sandy&apos;s Gaming.
          </p>
        </div>

        {/* Search Input Bar */}
        <form method="get" action="/blog" className="relative w-full max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-muted)]">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="search"
            name="q"
            defaultValue={q || ''}
            placeholder="Search articles..."
            className="block w-full rounded-xl border border-white/[0.08] bg-[var(--surface-secondary)] py-2.5 pr-3 pl-10 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/30 transition-all duration-300"
          />
        </form>
      </div>

      {/* Content Feed */}
      <div className="mt-10">
        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-sm text-red-400">
            Failed to load articles from database. Please refresh or try again later.
          </div>
        ) : blogList.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={q ? `No articles matching "${q}"` : 'No published articles yet'}
            description={
              q
                ? 'Try searching with different keywords or clear the search query to see all articles.'
                : 'Our editorial team is preparing new publication posts. Check back soon for fresh content.'
            }
            action={
              q ? (
                <Link
                  href="/blog"
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                >
                  Clear Search
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4.5 sm:gap-5 lg:gap-6">
            {blogList.map((post) => {
              const formattedDate = post.published_at
                ? new Date(post.published_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recently published';

              return (
                <article
                  key={post.id}
                  className="rounded-2xl glass-elevated overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-white/[0.14] hover:shadow-xl hover:-translate-y-0.5 group"
                >
                  <Link
                    href={`/blog/${encodeURIComponent(post.slug)}`}
                    className="block relative aspect-[16/10] w-full bg-[var(--surface-secondary)] overflow-hidden shrink-0"
                  >
                    {post.cover_image ? (
                      <Image
                        src={post.cover_image}
                        alt={post.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--surface-secondary)] to-[var(--background)]">
                        <BookOpen className="h-9 w-9 text-[var(--brand-primary)] opacity-30" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 rounded-full glass px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-md">
                      Article
                    </div>
                    <div className="absolute top-2.5 right-2.5 rounded-full glass px-2 py-0.5 text-[10px] font-mono text-[var(--text-secondary)] backdrop-blur-md">
                      {formattedDate}
                    </div>
                  </Link>

                  <div className="p-4 sm:p-4.5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
                        <Clock className="h-3 w-3 text-[var(--brand-primary)]" />
                        <span>4 min read</span>
                      </div>

                      <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors duration-200 line-clamp-2 leading-snug">
                        <Link href={`/blog/${encodeURIComponent(post.slug)}`}>
                          {post.title}
                        </Link>
                      </h2>

                      {post.excerpt && (
                        <p className="text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-white/[0.04] flex items-center justify-between">
                      <span className="text-[11px] text-[var(--text-muted)]">Sandy&apos;s Editorial</span>
                      <Link
                        href={`/blog/${encodeURIComponent(post.slug)}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-primary)] group-hover:text-white transition-colors"
                      >
                        <span>Read</span>
                        <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Bounded Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-between border-t border-white/[0.06] pt-6">
            <div className="text-xs text-[var(--text-muted)] font-mono">
              Showing page <span className="font-semibold text-white">{currentPage}</span> of{' '}
              <span className="font-semibold text-white">{totalPages}</span> ({totalCount} total articles)
            </div>

            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={`/blog?page=${currentPage - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all duration-300"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-40 cursor-not-allowed">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </span>
              )}

              {currentPage < totalPages ? (
                <Link
                  href={`/blog?page=${currentPage + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all duration-300"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-40 cursor-not-allowed">
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
