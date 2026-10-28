import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminInboxClient, type InboxConversationItem } from './AdminInboxClient';

export default async function AdminConversationsListPage() {
  const profile = await requireRole(['admin', 'super_admin'], '/admin/conversations');
  const supabase = await createClient();

  // Fetch all conversations for the admin inbox
  const { data } = await supabase
    .from('conversations')
    .select(`
      id,
      subject,
      status,
      last_message_at,
      created_at,
      customer:profiles!conversations_customer_id_fkey(id, display_name, role)
    `)
    .order('last_message_at', { ascending: false });

  const convs = (data as unknown as InboxConversationItem[]) || [];

  return (
    <AdminInboxClient
      initialConversations={convs}
      userRole={profile.role}
    />
  );
}
