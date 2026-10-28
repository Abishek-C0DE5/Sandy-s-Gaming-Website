import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  AssignmentsHubClient,
  type ConversationSummaryItem,
  type AdminUserOption,
} from './AssignmentsHubClient';

interface PageProps {
  searchParams: Promise<{ conversation_id?: string }>;
}

export default async function SuperAdminAssignmentsPage({ searchParams }: PageProps) {
  await requireRole(['super_admin'], '/super-admin/assignments');
  const supabase = await createClient();
  const { conversation_id } = await searchParams;

  // 1. Fetch all conversations with assignments and customer profiles
  const { data: rawConversations } = await supabase
    .from('conversations')
    .select(`
      id,
      subject,
      status,
      last_message_at,
      created_at,
      customer:profiles!conversations_customer_id_fkey(id, display_name, role),
      assignments:conversation_assignments(
        id,
        conversation_id,
        admin_id,
        assigned_by,
        status,
        assigned_at,
        removed_at,
        admin:profiles!conversation_assignments_admin_id_fkey(id, display_name, role),
        assigner:profiles!conversation_assignments_assigned_by_fkey(id, display_name, role)
      )
    `)
    .order('last_message_at', { ascending: false });

  const conversations = (rawConversations as unknown as ConversationSummaryItem[]) || [];

  // 2. Fetch all eligible active staff members (admins and super admins)
  const { data: staffMembers } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .in('role', ['admin', 'super_admin'])
    .eq('account_status', 'active')
    .order('display_name', { ascending: true });

  const availableAdmins: AdminUserOption[] = (staffMembers || []).map((s) => ({
    id: s.id,
    display_name: s.display_name || 'Admin',
    role: s.role,
  }));

  return (
    <AssignmentsHubClient
      initialConversations={conversations}
      availableAdmins={availableAdmins}
      preselectedConversationId={conversation_id}
    />
  );
}
