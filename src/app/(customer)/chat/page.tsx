import { requireAuth, getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CustomerChatClient } from './CustomerChatClient';
import { ensureConversationAssigned } from '@/lib/chat/assignment';

export default async function CustomerChatPage() {
  const user = await requireAuth('/login?redirect=/chat');
  const profile = await getCurrentProfile();

  // If user is staff (admin or super_admin), route them directly to the Admin Inbox
  if (profile?.role === 'admin' || profile?.role === 'super_admin') {
    redirect('/admin/conversations');
  }

  const supabase = await createClient();

  // 1. Retrieve or automatically provision active conversation
  let { data: activeConv } = await supabase
    .from('conversations')
    .select('*')
    .eq('customer_id', user.id)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeConv) {
    // Provision initial persistent conversation for the customer
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        customer_id: user.id,
        subject: 'General Support',
        status: 'open',
      })
      .select()
      .single();

    if (createError) {
      console.error('[CustomerChatPage] Error creating conversation:', createError);
    }
    activeConv = newConv;
  }

  // Ensure active conversation has staff assigned for real-time delivery & inbox visibility
  if (activeConv?.id) {
    await ensureConversationAssigned(activeConv.id);
  }

  interface RawMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    message_type: string;
    created_at: string;
    edited_at: string | null;
  }

  interface MessageItem {
    id: string;
    conversation_id: string;
    body: string;
    message_type: string;
    created_at: string;
    is_self: boolean;
    sender_name: string;
    sender_role: string;
    status: 'sent';
  }

  // 2. Fetch initial messages with bounded pagination (newest 50 messages)
  let initialMessages: MessageItem[] = [];
  if (activeConv) {
    const { data: messages } = await supabase
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
      .eq('conversation_id', activeConv.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Reverse to chronological order and mask staff identity
    const chronological = ((messages as unknown as RawMessage[]) || []).reverse();
    initialMessages = chronological.map((msg) => {
      const isSelf = msg.sender_id === user.id;
      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        body: msg.body,
        message_type: msg.message_type,
        created_at: msg.created_at,
        is_self: isSelf,
        sender_name: isSelf ? 'You' : 'Support Team',
        sender_role: isSelf ? 'customer' : 'staff',
        status: 'sent',
      };
    });
  }

  return (
    <CustomerChatClient
      initialConversation={activeConv}
      initialMessages={initialMessages}
      currentUserId={user.id}
      customerDisplayName={profile?.display_name || user.email?.split('@')[0] || 'Customer'}
    />
  );
}
