import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { connection } from 'next/server';
import { createPublicClient } from '@/lib/supabase/server';
import { Image as ImageIcon, Sparkles, ArrowRight, Layers, Flame } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Visual Gallery & Posters',
  description:
    'Browse official high-resolution 4K wallpapers, esports artwork posters, and creative digital assets released by Sandy\'s Gaming.',
  alternates: {
    canonical: '/posts',
  },
  openGraph: {
    title: 'Visual Gallery & Posters | Sandy\'s Gaming',
    description:
      'Browse official high-resolution 4K wallpapers, esports artwork posters, and creative digital assets released by Sandy\'s Gaming.',
    type: 'website',
  },
};

interface PostsGalleryPageProps {
  searchParams: Promise<{ type?: string }>;
}

export const instant = false;

export default async function PostsGalleryPage({ searchParams }: PostsGalleryPageProps) {
  await connection();
  const { type } = await searchParams;
  const activeFilter = type === 'poster' || type === 'photo' ? type : 'all';

  const supabase = createPublicClient();

  const query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, post_type, published_at')
    .in('post_type', activeFilter === 'all' ? ['poster', 'photo'] : [activeFilter])
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(18);

  const { data: posts, error } = await query;
  const galleryItems = posts || [];

  return (
    <div className="w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 py-12 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
      {/* Gallery Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-white/[0.08] pb-6 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--brand-highlight)]">
            <Flame className="h-3.5 w-3.5" />
            <span>Official Artwork &amp; Media</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
            Visual Media &amp; Posters
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Curated high-res esports wallpapers, custom digital posters, and creative assets released by Sandy&apos;s Gaming.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-xl bg-[#0B0D14] border border-white/[0.08] p-1 self-start md:self-auto">
          {[
            { key: 'all', label: 'All Media', href: '/posts' },
            { key: 'poster', label: 'Posters', href: '/posts?type=poster' },
            { key: 'photo', label: 'Wallpapers', href: '/posts?type=photo' },
          ].map(({ key, label, href }) => (
            <Link
              key={key}
              href={href}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                activeFilter === key
                  ? 'bg-[#1A1F2C] text-white border border-white/[0.1] shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="mt-8">
        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-sm text-red-400">
            Failed to load gallery items from database. Please refresh or try again later.
          </div>
        ) : galleryItems.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={`No published ${activeFilter === 'all' ? 'gallery items' : activeFilter + 's'} found`}
            description="Our creative team is crafting new visual works. Published posters and wallpapers will appear here."
            action={
              activeFilter !== 'all' ? (
                <Link
                  href="/posts"
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                >
                  View All Gallery Works
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4.5 sm:gap-5 lg:gap-6">
            {galleryItems.map((item) => (
              <article
                key={item.id}
                className="gaming-card overflow-hidden flex flex-col justify-between group"
              >
                <Link
                  href={`/posts/${encodeURIComponent(item.slug)}`}
                  className="block relative aspect-[16/10] w-full bg-[var(--surface-secondary)] overflow-hidden shrink-0"
                >
                  {item.cover_image ? (
                    <Image
                      src={item.cover_image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--surface-secondary)] to-[var(--background)]">
                      <Sparkles className="h-9 w-9 text-[var(--brand-highlight)] opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/75 backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      <Layers className="h-2.5 w-2.5 text-[var(--brand-highlight)]" />
                      <span>{item.post_type}</span>
                    </span>
                  </div>
                </Link>

                <div className="p-4 sm:p-4.5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-[var(--brand-highlight)] transition-colors duration-200 line-clamp-2 leading-snug">
                      <Link href={`/posts/${encodeURIComponent(item.slug)}`}>
                        {item.title}
                      </Link>
                    </h2>
                    {item.excerpt && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {item.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400">Sandy&apos;s Studio</span>
                    <Link
                      href={`/posts/${encodeURIComponent(item.slug)}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-highlight)] group-hover:text-white transition-colors"
                    >
                      <span>View</span>
                      <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
