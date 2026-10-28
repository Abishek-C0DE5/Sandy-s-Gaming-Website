import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  SuperAdminConversationsClient,
  type SuperAdminConversationItem,
} from './SuperAdminConversationsClient';

export default async function SuperAdminConversationsPage() {
  await requireRole(['super_admin'], '/super-admin/conversations');
  const supabase = await createClient();

  const { data: rawConversations } = await supabase
    .from('conversations')
    .select(`
      *,
      customer:profiles!conversations_customer_id_fkey(id, display_name, role),
      assignments:conversation_assignments(
        id,
        status,
        admin:profiles!conversation_assignments_admin_id_fkey(id, display_name)
      )
    `)
    .order('last_message_at', { ascending: false });

  const conversations = (rawConversations as unknown as SuperAdminConversationItem[]) || [];

  return <SuperAdminConversationsClient initialConversations={conversations} />;
}
