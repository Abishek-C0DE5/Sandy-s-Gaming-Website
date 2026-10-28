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
          <h2 className="text-xl font-bold tracking-tight text-white">
            Content Management (CMS)
          </h2>
          <p className="mt-1 text-xs text-[#A5A5AD]">
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
        <div className="rounded-2xl border border-white/[0.08] bg-[#101012] shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-white/[0.06] text-left text-xs">
            <thead className="bg-[#171719] text-[#A5A5AD]">
              <tr>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Post</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Type</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {posts.map((post) => {
                const publicUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;

                return (
                  <tr key={post.id} className="hover:bg-[#171719]/60 transition-colors">
                    <td className="px-6 py-3 font-medium text-white">
                      <div className="flex items-center gap-3">
                        {post.cover_image && (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[#171719] border border-white/[0.08]">
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
                          <div className="font-semibold line-clamp-1 text-white">{post.title}</div>
                          <div className="font-mono text-[11px] text-[#A5A5AD]">/{post.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-neutral-300 uppercase">
                        <Layers className="h-3 w-3 text-[#D71932]" />
                        <span>{post.post_type}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                          post.status === 'published'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                            : post.status === 'draft'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20'
                            : 'bg-white/[0.06] text-neutral-400'
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[#A5A5AD]">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-neutral-500" />
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
                            className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-[#171719] px-2 py-1 text-xs font-medium text-[#A5A5AD] hover:text-white hover:border-white/[0.2]"
                            title="View Public Post"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Preview</span>
                          </Link>
                        )}
                        <Link
                          href={`/admin/posts/${post.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-md bg-[#D71932] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#b01328] transition-colors"
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
