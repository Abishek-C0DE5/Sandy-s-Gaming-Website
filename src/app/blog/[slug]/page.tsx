import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Calendar, Clock, ArrowLeft, User } from 'lucide-react';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
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
      title: 'Article Not Found | ApexPublish',
      description: 'The requested article could not be located.',
    };
  }

  return {
    title: `${post.title} | ApexPublish Blog`,
    description: post.excerpt || 'Read this article on ApexPublish.',
    openGraph: {
      title: post.title,
      description: post.excerpt || '',
      images: post.cover_image ? [{ url: post.cover_image }] : [],
    },
  };
}

export default async function BlogPostDetailPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  // Validate slug parameter safely
  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    notFound();
  }

  const cleanSlug = slug.trim();
  const supabase = await createClient();

  // Query strictly published posts
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', cleanSlug)
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .maybeSingle();

  // Enforce 404 if post doesn't exist or is a private draft
  if (error || !post) {
    notFound();
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently published';

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Articles</span>
        </Link>

        <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Published Article
        </span>
      </div>

      {/* Article Header */}
      <header className="mt-8 space-y-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-5xl leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 border-y border-neutral-100 py-3 dark:border-neutral-800/80">
          <div className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
            <User className="h-3.5 w-3.5 text-neutral-400" />
            <span>Apex Editorial Team</span>
          </div>
          <span>&bull;</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            <time dateTime={post.published_at || ''}>{formattedDate}</time>
          </div>
          <span>&bull;</span>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-neutral-400" />
            <span>4 min read</span>
          </div>
        </div>

        {post.excerpt && (
          <p className="text-base sm:text-lg leading-relaxed text-neutral-600 dark:text-neutral-300 font-medium italic">
            &ldquo;{post.excerpt}&rdquo;
          </p>
        )}
      </header>

      {/* Featured Cover Image */}
      {post.cover_image && (
        <div className="relative mt-8 h-72 sm:h-96 w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 shadow-xs">
          <Image
            src={post.cover_image}
            alt={post.title}
            fill
            priority
            sizes="(max-width: 896px) 100vw, 896px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Article Body Content */}
      <div className="mt-10 space-y-6 text-sm sm:text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
        {post.body ? (
          <div className="whitespace-pre-line prose dark:prose-invert max-w-none">
            {post.body}
          </div>
        ) : (
          <p>No content provided for this article.</p>
        )}
      </div>

      {/* Article Footer */}
      <footer className="mt-14 border-t border-neutral-200 pt-8 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">Have questions or feedback?</h4>
          <p className="text-xs text-neutral-500">Reach out directly to our team via guest inquiry or live support.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <span>Contact Us</span>
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <span>Start Live Chat</span>
          </Link>
        </div>
      </footer>
    </article>
  );
}
