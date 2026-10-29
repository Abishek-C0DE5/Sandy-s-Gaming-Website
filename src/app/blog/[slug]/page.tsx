import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Calendar, Clock, ArrowLeft, User, MessageSquare } from 'lucide-react';

interface BlogPostPageProps {
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

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: 'Article Not Found' };

  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt, cover_image')
    .eq('slug', slug)
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .maybeSingle();

  if (!post) {
    return {
      title: 'Article Not Found | Sandy\'s Gaming',
      description: 'The requested article could not be located.',
    };
  }

  const resolvedImage = resolveImageUrl(supabase, post.cover_image);

  return {
    title: `${post.title} | Sandy's Gaming Blog`,
    description: post.excerpt || 'Read this article on Sandy\'s Gaming.',
    openGraph: {
      title: post.title,
      description: post.excerpt || '',
      images: resolvedImage ? [{ url: resolvedImage }] : [],
    },
  };
}

export default async function BlogPostDetailPage({ params }: BlogPostPageProps) {
  await connection();
  const { slug } = await params;

  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    notFound();
  }

  const cleanSlug = slug.trim();
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', cleanSlug)
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .maybeSingle();

  if (error || !post) {
    notFound();
  }

  const coverUrl = resolveImageUrl(supabase, post.cover_image);

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently published';

  return (
    <article className="w-full max-w-[1720px] mx-auto px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Articles</span>
        </Link>

        <span className="inline-flex items-center rounded-full glass px-3 py-0.5 text-xs font-semibold text-[var(--brand-primary)]">
          Published Article
        </span>
      </div>

      {/* Article Header */}
      <header className="mt-8 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-5xl leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] font-mono border-y border-white/[0.06] py-3.5">
          <div className="flex items-center gap-1.5 font-sans font-semibold text-[var(--text-secondary)]">
            <User className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <span>Sandy&apos;s Editorial Team</span>
          </div>
          <span className="opacity-40">&bull;</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <time dateTime={post.published_at || ''}>{formattedDate}</time>
          </div>
          <span className="opacity-40">&bull;</span>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span>4 min read</span>
          </div>
        </div>

        {post.excerpt && (
          <p className="text-base sm:text-lg leading-relaxed text-[var(--text-secondary)] font-medium italic">
            &ldquo;{post.excerpt}&rdquo;
          </p>
        )}
      </header>

      {/* Featured Cover Image */}
      {coverUrl && (
        <div className="relative mt-8 h-80 sm:h-[480px] xl:h-[600px] w-full overflow-hidden rounded-3xl glass-elevated">
          <Image
            src={coverUrl}
            alt={post.title}
            fill
            priority
            sizes="(max-width: 1720px) 100vw, 1720px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Article Body Content */}
      <div className="mt-10 space-y-6 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)] max-w-4xl">
        {post.body ? (
          <div className="whitespace-pre-line prose prose-invert max-w-none text-[var(--text-secondary)] leading-loose">
            {post.body}
          </div>
        ) : (
          <p>No content provided for this article.</p>
        )}
      </div>

      {/* Article Footer */}
      <footer className="mt-14 border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-4xl">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">Have questions or feedback?</h4>
          <p className="text-xs text-[var(--text-secondary)]">Reach out directly to our team via guest inquiry or live support.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <span>Contact Us</span>
          </Link>
          <Link
            href="/chat"
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Start Live Chat</span>
          </Link>
        </div>
      </footer>
    </article>
  );
}
