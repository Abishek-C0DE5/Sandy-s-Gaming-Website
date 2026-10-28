import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { Inbox, Mail, BookOpen, Clock, CheckCircle, Plus, FileText, Edit, ExternalLink, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AdminDashboardPage() {
  const profile = await requireRole(['admin', 'super_admin'], '/admin');
  const supabase = await createClient();

  // Query genuine database counts for authorized admin
  const { count: assignedCount } = await supabase
    .from('conversation_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('admin_id', profile.id)
    .eq('status', 'active');

  const { count: pendingInquiries } = await supabase
    .from('contact_inquiries')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');

  const { count: postsCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });

  // Query recent posts to display directly on the dashboard
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id, title, slug, post_type, status, cover_image, created_at, published_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const totalAssigned = assignedCount ?? 0;
  const totalInquiries = pendingInquiries ?? 0;
  const totalPosts = postsCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Quick Publishing & Operational Action Banner */}
      <div className="rounded-2xl border border-[#D71932]/30 bg-gradient-to-r from-[#171719] via-[#101012] to-[#1a1114] p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#D71932]/20 px-2 py-0.5 text-xs font-bold text-[#D71932]">
                <Sparkles className="h-3 w-3" />
                Staff Quick Actions
              </span>
              <span className="text-xs text-neutral-400">Ready to post updates or engage players?</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Content Publishing & Live Operations
            </h2>
            <p className="text-xs text-neutral-400">
              Create and publish new blogs, tournament posters, and gaming news with instant image uploading.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#D71932] px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(215,25,50,0.4)] hover:bg-[#b01328] transition-all transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Post</span>
            </Link>
            <Link
              href="/admin/posts"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/80 px-4 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors"
            >
              <FileText className="h-4 w-4 text-neutral-400" />
              <span>Manage All Posts ({totalPosts})</span>
            </Link>
            <Link
              href="/admin/conversations"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-900/50 bg-blue-950/30 px-4 py-2.5 text-xs font-semibold text-blue-300 hover:bg-blue-900/40 transition-colors"
            >
              <Inbox className="h-4 w-4 text-blue-400" />
              <span>Live Chat Queue</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards (Backed by real database queries) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link
          href="/admin/conversations"
          className="group rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-xs hover:border-[#D71932]/50 hover:bg-[#171719] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A5A5AD] uppercase tracking-wider">Assigned Chats</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950/60 text-blue-400 group-hover:scale-110 transition-transform">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">
            {totalAssigned}
          </p>
          <p className="mt-1 text-xs text-[#A5A5AD]">Active conversations assigned to your queue &rarr;</p>
        </Link>

        <Link
          href="/admin/contact-requests"
          className="group rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-xs hover:border-amber-500/50 hover:bg-[#171719] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A5A5AD] uppercase tracking-wider">Pending Inquiries</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-950/60 text-amber-400 group-hover:scale-110 transition-transform">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">
            {totalInquiries}
          </p>
          <p className="mt-1 text-xs text-[#A5A5AD]">Unresolved guest contact submissions &rarr;</p>
        </Link>

        <Link
          href="/admin/posts"
          className="group rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-xs hover:border-emerald-500/50 hover:bg-[#171719] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A5A5AD] uppercase tracking-wider">CMS Articles</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/60 text-emerald-400 group-hover:scale-110 transition-transform">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">
            {totalPosts}
          </p>
          <p className="mt-1 text-xs text-[#A5A5AD]">Database published and draft posts &rarr;</p>
        </Link>
      </div>

      {/* Content Management & Publishing Hub (Prominently displayed) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/[0.08] gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#D71932]" />
              <span>CMS Posts & Media Articles</span>
            </h2>
            <p className="text-xs text-[#A5A5AD]">
              Publish news, blogs, and posters to Sandy&apos;s Gaming website.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D71932] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#b01328] transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Post</span>
            </Link>
            <Link
              href="/admin/posts"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#171719] px-3 py-1.5 text-xs font-semibold text-[#A5A5AD] hover:text-white hover:border-[#D71932] transition-colors"
            >
              <span>View All ({totalPosts})</span>
            </Link>
          </div>
        </div>

        {!recentPosts || recentPosts.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={FileText}
              title="No articles created yet"
              description="Your CMS library is empty. Click Create Post to start authoring blogs, posters, or photos."
              action={
                <Link
                  href="/admin/posts/new"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D71932] px-4 py-2 text-xs font-bold text-white hover:bg-[#b01328]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Post</span>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.06]">
            {recentPosts.map((post) => {
              const publicUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;
              return (
                <div
                  key={post.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#171719] px-3 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {post.cover_image ? (
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#171719] border border-white/[0.08]">
                        <Image
                          src={post.cover_image}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-[#171719] border border-white/[0.08] text-neutral-400">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {post.title}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            post.status === 'published'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {post.status}
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-neutral-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
                          {post.post_type}
                        </span>
                      </div>
                      <p className="text-xs text-[#A5A5AD] truncate mt-0.5 font-mono">
                        /{post.slug} &bull; {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {post.status === 'published' && (
                      <Link
                        href={publicUrl}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#171719] px-2.5 py-1 text-xs font-medium text-[#A5A5AD] hover:text-white hover:border-white/[0.2]"
                        title="View Public Post"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Preview</span>
                      </Link>
                    )}
                    <Link
                      href={`/admin/posts/${post.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#D71932] px-3 py-1 text-xs font-semibold text-white hover:bg-[#b01328] transition-colors"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Operational Modules (Live Chat & Contact) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-xs">
          <h2 className="text-base font-semibold text-white mb-1">
            Assigned Live Chats (Shared Model)
          </h2>
          <p className="text-xs text-[#A5A5AD] mb-6">
            Real-time chat threads currently assigned to your specialist queue. Multiple admins can participate simultaneously.
          </p>
          {totalAssigned === 0 ? (
            <EmptyState
              icon={Clock}
              title="No chats currently assigned"
              description="Your support queue is clear. New visitor conversations will automatically route here."
            />
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#A5A5AD]">
                You have {totalAssigned} active conversation(s) assigned to your queue.
              </p>
              <Link
                href="/admin/conversations"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                <span>Open Support Queue</span>
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-xs">
          <h2 className="text-base font-semibold text-white mb-1">
            Guest Contact Requests
          </h2>
          <p className="text-xs text-[#A5A5AD] mb-6">
            Submissions received from the public Contact Us form for staff triage and email response.
          </p>
          {totalInquiries === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="All inquiries resolved"
              description="No unresolved guest messages in the queue. New submissions will populate here for review."
            />
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#A5A5AD]">You have {totalInquiries} pending inquiry request(s).</p>
              <Link
                href="/admin/contact-requests"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#171719] px-4 py-2 text-xs font-semibold text-[#A5A5AD] hover:text-white hover:border-[#D71932] transition-colors"
              >
                <span>View Contact Requests</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
