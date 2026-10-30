import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import Image from 'next/image';
import { createPublicClient } from '@/lib/supabase/server';
import { ArrowLeft, Calendar, Layers, Sparkles, ExternalLink } from 'lucide-react';

interface PostDetailPageProps {
  params: Promise<{ slug: string }>;
}

function resolveImageUrl(supabase: { storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } } }, pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
  return supabase.storage.from('public-media').getPublicUrl(clean).data.publicUrl;
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: 'Asset Not Found' };

  const supabase = createPublicClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt, cover_image, post_type, published_at')
    .eq('slug', slug)
    .in('post_type', ['poster', 'photo'])
    .eq('status', 'published')
    .maybeSingle();

  if (!post) {
    return {
      title: 'Gallery Asset Not Found | Sandy\'s Gaming',
      description: 'The requested visual media asset could not be located.',
    };
  }

  const resolvedImage = resolveImageUrl(supabase, post.cover_image);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sandys-gaming.vercel.app';

  return {
    title: `${post.title} | ${post.post_type.toUpperCase()} Gallery | Sandy's Gaming`,
    description: post.excerpt || `View high-resolution ${post.post_type} on Sandy\'s Gaming.`,
    alternates: {
      canonical: `/posts/${encodeURIComponent(slug)}`,
    },
    openGraph: {
      title: `${post.title} | Sandy's Gaming Gallery`,
      description: post.excerpt || '',
      url: `${siteUrl}/posts/${encodeURIComponent(slug)}`,
      type: 'article',
      images: resolvedImage ? [{ url: resolvedImage }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || '',
      images: resolvedImage ? [resolvedImage] : [],
    },
  };
}

export const instant = false;

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  await connection();
  const { slug } = await params;

  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    notFound();
  }

  const cleanSlug = slug.trim();
  const supabase = createPublicClient();

  // Query strictly published poster or photo post
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', cleanSlug)
    .in('post_type', ['poster', 'photo'])
    .eq('status', 'published')
    .maybeSingle();

  if (error || !post) {
    notFound();
  }

  // Query normalized media assets
  const { data: mediaItems } = await supabase
    .from('post_media')
    .select('*')
    .eq('post_id', post.id)
    .order('sort_order', { ascending: true });

  // Resolve all image URLs properly (handling both relative storage paths and full URLs)
  const resolvedMedia: Array<{ id: string; url: string; alt_text: string }> = [];

  // 1. If cover_image exists, add it first
  if (post.cover_image) {
    resolvedMedia.push({
      id: 'cover',
      url: resolveImageUrl(supabase, post.cover_image),
      alt_text: post.title,
    });
  }

  // 2. Add attached media items, avoiding duplicates
  if (mediaItems && mediaItems.length > 0) {
    for (const item of mediaItems) {
      const itemUrl = resolveImageUrl(supabase, item.storage_path);
      if (itemUrl && !resolvedMedia.some((m) => m.url === itemUrl)) {
        resolvedMedia.push({
          id: item.id,
          url: itemUrl,
          alt_text: item.alt_text || post.title,
        });
      }
    }
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently published';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sandys-gaming.vercel.app';
  const artworkJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    name: post.title,
    description: post.excerpt || post.title,
    image: resolvedMedia.length > 0 ? resolvedMedia.map((m) => m.url) : undefined,
    artform: post.post_type === 'poster' ? 'Digital Poster' : 'Wallpaper Artwork',
    creator: {
      '@type': 'Organization',
      name: "Sandy's Gaming Creative Studio",
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: "Sandy's Gaming",
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/brand/sandys-gaming-logo.png`,
      },
    },
  };

  return (
    <div className="w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 py-12 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(artworkJsonLd) }}
      />
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <Link
          href="/posts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Gallery</span>
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] uppercase tracking-wide">
          <Layers className="h-3.5 w-3.5" />
          <span>{post.post_type}</span>
        </span>
      </div>

      {/* Main Asset Presentation */}
      <div className="mt-8 space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight text-[var(--text-primary)]">
            {post.title}
          </h1>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
            <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <time dateTime={post.published_at || ''}>{formattedDate}</time>
            <span className="opacity-40">&bull;</span>
            <span>Sandy&apos;s Creative Studio</span>
          </div>
        </div>

        {/* Gallery Image Display */}
        {resolvedMedia.length > 0 ? (
          <div className="space-y-8">
            {resolvedMedia.map((m, idx) => (
              <div
                key={m.id || idx}
                className="relative overflow-hidden rounded-3xl glass-elevated group"
              >
                <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-[var(--surface-secondary)]">
                  <Image
                    src={m.url}
                    alt={m.alt_text || post.title}
                    fill
                    priority={idx === 0}
                    sizes="(max-width: 1720px) 100vw, 1720px"
                    className="object-contain sm:object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                  />
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/[0.1] shadow-xl"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>View Full Resolution</span>
                    </a>
                  </div>
                </div>
                {m.alt_text && m.alt_text !== post.title && (
                  <div className="border-t border-white/[0.06] bg-black/40 px-5 py-3 text-xs text-[var(--text-secondary)] backdrop-blur-md">
                    {m.alt_text}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl glass p-12 text-center text-sm text-[var(--text-muted)]">
            No image attached to this visual post.
          </div>
        )}

        {/* Description & Narrative */}
        {(post.body || post.excerpt) && (
          <div className="rounded-3xl glass-elevated p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--brand-primary)] tracking-wide mb-3">
              <Sparkles className="h-4 w-4" />
              <span>Creative Notes</span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
              {post.body || post.excerpt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
