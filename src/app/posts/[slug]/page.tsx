import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft, Calendar, Layers, Sparkles } from 'lucide-react';

interface PostDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: 'Asset Not Found' };

  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt, cover_image, post_type')
    .eq('slug', slug)
    .in('post_type', ['poster', 'photo'])
    .eq('status', 'published')
    .maybeSingle();

  if (!post) {
    return {
      title: 'Gallery Asset Not Found | ApexPublish',
      description: 'The requested visual media asset could not be located.',
    };
  }

  return {
    title: `${post.title} | ${post.post_type.toUpperCase()} Gallery`,
    description: post.excerpt || `View high-resolution ${post.post_type} on ApexPublish.`,
    openGraph: {
      title: post.title,
      description: post.excerpt || '',
      images: post.cover_image ? [{ url: post.cover_image }] : [],
    },
  };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { slug } = await params;

  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    notFound();
  }

  const cleanSlug = slug.trim();
  const supabase = await createClient();

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

  const galleryMedia = mediaItems && mediaItems.length > 0
    ? mediaItems
    : post.cover_image
    ? [{ id: 'primary', storage_path: post.cover_image, alt_text: post.title, sort_order: 1 }]
    : [];

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently published';

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <Link
          href="/posts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Gallery</span>
        </Link>

        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300 uppercase tracking-wide">
          <Layers className="h-3 w-3" />
          <span>{post.post_type}</span>
        </span>
      </div>

      {/* Main Asset Presentation */}
      <div className="mt-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            <time dateTime={post.published_at || ''}>{formattedDate}</time>
            <span>&bull;</span>
            <span>Apex Visual Studio</span>
          </div>
        </div>

        {/* Gallery Image Display */}
        <div className="space-y-6">
          {galleryMedia.map((m, idx) => (
            <div
              key={m.id || idx}
              className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="relative aspect-16/10 w-full sm:aspect-16/9">
                <Image
                  src={m.storage_path}
                  alt={m.alt_text || post.title}
                  fill
                  priority={idx === 0}
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              {m.alt_text && (
                <div className="border-t border-neutral-200 bg-white/80 px-4 py-2 text-xs text-neutral-600 backdrop-blur-xs dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
                  {m.alt_text}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Description & Narrative */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
            <Sparkles className="h-4 w-4" />
            <span>Creative Notes</span>
          </div>
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
            {post.body || post.excerpt || 'No description provided.'}
          </p>
        </div>
      </div>
    </div>
  );
}
