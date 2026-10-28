import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { InquiryDetailClient, EmailConfigInfo } from './InquiryDetailClient';
import { getEmailAdapter } from '@/lib/email/adapter';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inquiry Detail | Staff Operations',
  description: 'Manage guest contact inquiry triage, assignment, and reply history.',
};

interface InquiryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InquiryDetailPage({ params }: InquiryDetailPageProps) {
  const profile = await requireRole(['admin', 'super_admin'], '/admin/contact-requests');
  const { id } = await params;

  const adminClient = await createAdminClient();

  // 1. Fetch inquiry
  const { data: inquiry, error: inqError } = await adminClient
    .from('contact_inquiries')
    .select('*')
    .eq('id', id)
    .single();

  if (inqError || !inquiry) {
    notFound();
  }

  // 2. Fetch replies
  const { data: replies } = await adminClient
    .from('contact_inquiry_replies')
    .select('*')
    .eq('inquiry_id', id)
    .order('created_at', { ascending: true });

  // 3. Fetch available staff profiles
  const { data: staffList } = await adminClient
    .from('profiles')
    .select('id, display_name, email, role')
    .in('role', ['admin', 'super_admin'])
    .eq('account_status', 'active')
    .order('display_name', { ascending: true });

  const staffMap = new Map(staffList?.map((s) => [s.id, s]) || []);

  const assignedProfile = inquiry.assigned_admin_id ? staffMap.get(inquiry.assigned_admin_id) || null : null;

  const enrichedInquiry = {
    ...inquiry,
    assigned_admin: assignedProfile,
  };

  const enrichedReplies = (replies || []).map((r) => ({
    ...r,
    admin: staffMap.get(r.admin_id) || null,
  }));

  // 4. Get active email provider configuration
  const emailAdapter = getEmailAdapter();
  const emailConfig: EmailConfigInfo = {
    isConfigured: emailAdapter.isConfigured,
    provider: emailAdapter.name,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'support@sandysgaming.com',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <Link
          href="/admin/contact-requests"
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Inquiry from {inquiry.name || 'Anonymous Guest'}
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                inquiry.status === 'new'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : inquiry.status === 'in_progress'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                  : inquiry.status === 'replied'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {inquiry.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 font-mono">
            {inquiry.email} &bull; Received on {new Date(inquiry.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Main Interactive Detail Client */}
      <InquiryDetailClient
        inquiry={enrichedInquiry}
        replies={enrichedReplies}
        availableStaff={staffList || []}
        currentUserId={profile.id}
        emailConfig={emailConfig}
      />
    </div>
  );
}
