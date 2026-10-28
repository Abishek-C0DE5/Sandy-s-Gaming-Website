import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { FileText, Plus, Edit, ExternalLink, Calendar, Layers } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AdminPostsPage() {
  await requireRole(['admin', 'super_admin'], '/admin/posts');
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  const hasPosts = posts && posts.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Content Management (CMS)
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Author, edit, publish, or archive blogs, posters, and photography posts. Storage assets are automatically managed.
          </p>
        </div>

        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#D71932] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#b01328] transition-all shadow-[0_0_15px_rgba(215,25,50,0.35)] transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          <span>+ Create New Post</span>
        </Link>
      </div>

      {!hasPosts ? (
        <EmptyState
          icon={FileText}
          title="No articles created yet"
          description="Your CMS library is currently empty. Click Create New Post above to start authoring blogs, posters, or photos."
          action={
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#D71932] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#b01328] shadow-[0_0_15px_rgba(215,25,50,0.35)]"
            >
              <Plus className="h-4 w-4" />
              <span>+ Create First Post</span>
            </Link>
          }
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Post</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {posts.map((post) => {
                const publicUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;

                return (
                  <tr key={post.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                    <td className="px-6 py-3 font-medium text-neutral-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        {post.cover_image && (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
                            <Image
                              src={post.cover_image}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold line-clamp-1">{post.title}</div>
                          <div className="font-mono text-[11px] text-neutral-400">/{post.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 uppercase">
                        <Layers className="h-3 w-3" />
                        <span>{post.post_type}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                          post.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : post.status === 'draft'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-neutral-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-neutral-400" />
                        <span>
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString()
                            : new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {post.status === 'published' && (
                          <Link
                            href={publicUrl}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
                            title="View Public Post"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Preview</span>
                          </Link>
                        )}
                        <Link
                          href={`/admin/posts/${post.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
