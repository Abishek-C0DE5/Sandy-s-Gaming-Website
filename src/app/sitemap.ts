import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sandys-gaming.vercel.app';
  const supabase = createPublicClient();

  // Fetch all published posts to dynamically index them
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, post_type, published_at, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/posts`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/chat`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const postRoutes: MetadataRoute.Sitemap = (posts || []).map((post) => {
    const routePrefix = post.post_type === 'blog' ? '/blog' : '/posts';
    return {
      url: `${siteUrl}${routePrefix}/${encodeURIComponent(post.slug)}`,
      lastModified: post.updated_at ? new Date(post.updated_at) : new Date(post.published_at || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    };
  });

  return [...staticRoutes, ...postRoutes];
}
