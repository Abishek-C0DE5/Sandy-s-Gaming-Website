import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { BookOpen, Calendar, Clock, ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Blog & Articles | ApexPublish',
  description: 'Explore engineering insights, modern web architecture, and platform design updates.',
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function BlogListingPage({ searchParams }: BlogPageProps) {
  await connection();
  const { page, q } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const pageSize = 6;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, published_at, post_type', { count: 'exact' })
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-neutral-200 pb-8 dark:border-neutral-800 gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <BookOpen className="h-4 w-4" />
            <span>Articles &amp; Publication Feed</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
            Latest Blog Articles
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
            In-depth guides on high-throughput web development, database security, and real-time multi-admin architectures.
          </p>
        </div>

        {/* Search Input Bar */}
        <form method="get" action="/blog" className="relative w-full max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="search"
            name="q"
            defaultValue={q || ''}
            placeholder="Search articles..."
            className="block w-full rounded-xl border border-neutral-300 bg-white py-2 pr-3 pl-9 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </form>
      </div>

      {/* Content Feed */}
      <div className="mt-10">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
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
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                >
                  Clear Search
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-800"
                >
                  <div>
                    {post.cover_image && (
                      <div className="relative h-48 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                        <Image
                          src={post.cover_image}
                          alt={post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                          <time dateTime={post.published_at || ''}>{formattedDate}</time>
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-neutral-400" />
                          <span>4 min read</span>
                        </span>
                      </div>

                      <h2 className="text-lg font-bold tracking-tight text-neutral-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                        <Link href={`/blog/${encodeURIComponent(post.slug)}`}>
                          {post.title}
                        </Link>
                      </h2>

                      {post.excerpt && (
                        <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 p-6 pt-3 pb-4 dark:border-neutral-800/60">
                    <Link
                      href={`/blog/${encodeURIComponent(post.slug)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <span>Read article</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Bounded Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-between border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <div className="text-xs text-neutral-500">
              Showing page <span className="font-semibold">{currentPage}</span> of{' '}
              <span className="font-semibold">{totalPages}</span> ({totalCount} total articles)
            </div>

            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={`/blog?page=${currentPage - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-300 cursor-not-allowed dark:border-neutral-800 dark:text-neutral-700">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </span>
              )}

              {currentPage < totalPages ? (
                <Link
                  href={`/blog?page=${currentPage + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-300 cursor-not-allowed dark:border-neutral-800 dark:text-neutral-700">
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
