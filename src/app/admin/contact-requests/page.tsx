import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { Mail, Clock, User, Phone, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import { InquiryStatus } from '@/types/database';

interface AdminContactRequestsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminContactRequestsPage({
  searchParams,
}: AdminContactRequestsPageProps) {
  await requireRole(['admin', 'super_admin'], '/admin/contact-requests');
  const { status: statusFilter } = await searchParams;

  const adminClient = await createAdminClient();

  let query = adminClient
    .from('contact_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (
    statusFilter &&
    (['new', 'in_progress', 'replied', 'closed'] as const).includes(statusFilter as InquiryStatus)
  ) {
    query = query.eq('status', statusFilter as InquiryStatus);
  }

  const { data: inquiries } = await query;

  // Counts for tabs
  const { data: allCounts } = await adminClient
    .from('contact_inquiries')
    .select('status');

  const counts = {
    all: allCounts?.length || 0,
    new: allCounts?.filter((i) => i.status === 'new').length || 0,
    in_progress: allCounts?.filter((i) => i.status === 'in_progress').length || 0,
    replied: allCounts?.filter((i) => i.status === 'replied').length || 0,
    closed: allCounts?.filter((i) => i.status === 'closed').length || 0,
  };

  // Fetch staff profiles for assigned names lookup
  const { data: staffProfiles } = await adminClient
    .from('profiles')
    .select('id, display_name, email');

  const staffMap = new Map(staffProfiles?.map((p) => [p.id, p]) || []);

  const hasInquiries = inquiries && inquiries.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Guest Contact Requests
          </h2>
          <p className="mt-1 text-xs text-[#A5A5AD]">
            Inquiries submitted via the public Contact Us form. Triage status, manage staff assignments, and record responses.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.08] pb-2 overflow-x-auto text-xs font-medium">
        {[
          { key: undefined, label: 'All Requests', count: counts.all },
          { key: 'new', label: 'New', count: counts.new },
          { key: 'in_progress', label: 'In Progress', count: counts.in_progress },
          { key: 'replied', label: 'Replied', count: counts.replied },
          { key: 'closed', label: 'Closed', count: counts.closed },
        ].map((tab) => {
          const isActive = (!statusFilter && !tab.key) || statusFilter === tab.key;
          const href = tab.key ? `/admin/contact-requests?status=${tab.key}` : '/admin/contact-requests';

          return (
            <Link
              key={tab.label}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#171719] text-[#D71932] border border-[#D71932]/40 font-semibold'
                  : 'text-[#A5A5AD] hover:text-white hover:bg-[#171719]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  isActive
                    ? 'bg-[#D71932]/20 text-[#D71932]'
                    : 'bg-white/[0.08] text-[#A5A5AD]'
                }`}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {!hasInquiries ? (
        <EmptyState
          icon={Mail}
          title={statusFilter ? `No ${statusFilter.replace('_', ' ')} inquiries` : 'No contact inquiries found'}
          description="Submissions from the public Contact Us form will appear here for staff triage and email response."
        />
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101012] shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-white/[0.06] text-left text-xs">
            <thead className="bg-[#171719] text-[#A5A5AD]">
              <tr>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Sender Details</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Message Synopsis</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Assigned Staff</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {inquiries.map((inq) => {
                const assigned = inq.assigned_admin_id ? staffMap.get(inq.assigned_admin_id) : null;

                return (
                  <tr key={inq.id} className="hover:bg-[#171719]/60 transition-colors">
                    {/* Sender Details */}
                    <td className="px-6 py-3.5 font-medium text-white">
                      <div>
                        <div className="font-semibold text-xs text-white">
                          {inq.name || 'Anonymous Guest'}
                        </div>
                        <div className="text-[11px] text-[#A5A5AD] font-mono mt-0.5">
                          {inq.email}
                        </div>
                        <div className="text-[11px] text-[#A5A5AD] flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-neutral-500" />
                          <span>{inq.phone}</span>
                        </div>
                      </div>
                    </td>

                    {/* Message Preview */}
                    <td className="px-6 py-3.5 text-neutral-300 max-w-sm">
                      <p className="line-clamp-2 text-xs leading-relaxed">
                        {inq.message}
                      </p>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          inq.status === 'new'
                            ? 'bg-blue-950/60 text-blue-400 border border-blue-500/20'
                            : inq.status === 'in_progress'
                            ? 'bg-purple-950/60 text-purple-400 border border-purple-500/20'
                            : inq.status === 'replied'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                            : 'bg-white/[0.06] text-neutral-400'
                        }`}
                      >
                        {inq.status === 'new' && <AlertCircle className="h-3 w-3" />}
                        {inq.status === 'replied' && <CheckCircle2 className="h-3 w-3" />}
                        <span>{inq.status.replace('_', ' ')}</span>
                      </span>
                    </td>

                    {/* Assigned Staff */}
                    <td className="px-6 py-3.5 text-[#A5A5AD]">
                      {assigned?.display_name ? (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-200 font-medium">
                          <User className="h-3 w-3 text-neutral-500" />
                          <span>{assigned.display_name}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-3.5 text-[#A5A5AD] whitespace-nowrap">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3 text-neutral-500" />
                        <span>{new Date(inq.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/contact-requests/${inq.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#D71932] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#b01328] transition-colors"
                      >
                        <span>View</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
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
