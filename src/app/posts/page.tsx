import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { Image as ImageIcon, Sparkles, ArrowRight, Layers } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Visual Gallery & Posters | ApexPublish',
  description: 'Browse high-resolution architectural photography, creative posters, and visual design assets.',
};

interface PostsGalleryPageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function PostsGalleryPage({ searchParams }: PostsGalleryPageProps) {
  await connection();
  const { type } = await searchParams;
  const activeFilter = type === 'poster' || type === 'photo' ? type : 'all';

  const supabase = await createClient();

  const query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, post_type, published_at')
    .in('post_type', activeFilter === 'all' ? ['poster', 'photo'] : [activeFilter])
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(18);

  const { data: posts, error } = await query;
  const galleryItems = posts || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Gallery Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-neutral-200 pb-8 dark:border-neutral-800 gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <Sparkles className="h-4 w-4" />
            <span>Creative Showcase</span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
            Visual Media &amp; Gallery
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Curated posters, 35mm architectural photography, and creative visual assets published by the Apex studio.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 self-start md:self-auto">
          <Link
            href="/posts"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400'
            }`}
          >
            All Media
          </Link>
          <Link
            href="/posts?type=poster"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === 'poster'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400'
            }`}
          >
            Posters
          </Link>
          <Link
            href="/posts?type=photo"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === 'photo'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400'
            }`}
          >
            Photography
          </Link>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="mt-10">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            Failed to load gallery items from database. Please refresh or try again later.
          </div>
        ) : galleryItems.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={`No published ${activeFilter === 'all' ? 'gallery items' : activeFilter + 's'} found`}
            description="Our creative studio is curating new visual works. Published posters and photography will appear here."
            action={
              activeFilter !== 'all' ? (
                <Link
                  href="/posts"
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                >
                  View All Gallery Works
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {galleryItems.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:border-purple-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-purple-800"
              >
                {item.cover_image && (
                  <div className="relative aspect-4/3 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <Image
                      src={item.cover_image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/80 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs uppercase tracking-wide">
                        <Layers className="h-3 w-3" />
                        <span>{item.post_type}</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-neutral-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400 transition-colors">
                      <Link href={`/posts/${encodeURIComponent(item.slug)}`}>
                        {item.title}
                      </Link>
                    </h2>
                    {item.excerpt && (
                      <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-2">
                        {item.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60">
                    <Link
                      href={`/posts/${encodeURIComponent(item.slug)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                      <span>View asset &amp; details</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
