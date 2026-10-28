import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { StaffChatClient } from './StaffChatClient';
import { ensureConversationAssigned } from '@/lib/chat/assignment';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminConversationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireRole(['admin', 'super_admin'], `/admin/conversations/${id}`);
  
  // Ensure this conversation has assignment so the admin has full RLS access
  await ensureConversationAssigned(id);

  const supabase = await createClient();

  // 1. Check conversation and authorization
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select(`
      id,
      customer_id,
      subject,
      status,
      last_message_at,
      created_at,
      customer:profiles!conversations_customer_id_fkey(id, display_name, role)
    `)
    .eq('id', id)
    .single();

  if (convError || !conv) {
    notFound();
  }

  // 2. Load assigned specialists
  const { data: assignments } = await supabase
    .from('conversation_assignments')
    .select(`
      id,
      admin_id,
      status,
      admin:profiles!conversation_assignments_admin_id_fkey(id, display_name, role)
    `)
    .eq('conversation_id', id)
    .eq('status', 'active');

  // 3. Load available admins if super admin
  let availableAdmins: { id: string; display_name: string }[] = [];
  if (profile.role === 'super_admin') {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('role', ['admin', 'super_admin'])
      .eq('account_status', 'active');

    availableAdmins = (admins || []).map((a) => ({
      id: a.id,
      display_name: a.display_name || 'Admin',
    }));
  }

  // 4. Load messages with bounded pagination (newest 50 messages)
  const { data: rawMessages } = await supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      body,
      message_type,
      created_at,
      edited_at,
      sender:profiles!messages_sender_id_fkey(id, display_name, role)
    `)
    .eq('conversation_id', id);

  interface RawStaffMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    message_type: string;
    created_at: string;
    sender?: { id: string; display_name: string; role: string } | null;
  }

  const chronological = ((rawMessages as unknown as RawStaffMessage[]) || []).reverse();
  const initialMessages = chronological.map((msg) => {
    const isSelf = msg.sender_id === profile.id;
    const sender = msg.sender;
    const senderRole = sender?.role || 'staff';
    const senderName = isSelf
      ? 'You'
      : sender?.display_name || (senderRole === 'customer' ? 'Customer' : 'Specialist');

    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      body: msg.body,
      message_type: msg.message_type,
      created_at: msg.created_at,
      is_self: isSelf,
      sender_name: senderName,
      sender_role: senderRole,
      status: 'sent' as const,
    };
  });

  return (
    <StaffChatClient
      conversationId={id}
      initialConversation={conv as unknown as Parameters<typeof StaffChatClient>[0]['initialConversation']}
      initialMessages={initialMessages}
      initialAssignedStaff={(assignments || []) as unknown as Parameters<typeof StaffChatClient>[0]['initialAssignedStaff']}
      currentUser={{
        id: profile.id,
        role: profile.role,
        displayName: profile.display_name,
      }}
      availableAdmins={availableAdmins}
    />
  );
}
