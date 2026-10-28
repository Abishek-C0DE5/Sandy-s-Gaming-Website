import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let adminServiceClient: ReturnType<typeof createClient<Database>> | null = null;

function getAdminServiceClient() {
  if (!adminServiceClient && supabaseUrl && serviceRoleKey) {
    adminServiceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminServiceClient;
}

export async function ensureConversationAssigned(conversationId: string): Promise<boolean> {
  const client = getAdminServiceClient();
  if (!client) {
    console.warn('[Assignment] Service role client not configured');
    return false;
  }

  try {
    // 1. Fast check: is this conversation already assigned to staff?
    const { data: existing } = await client
      .from('conversation_assignments')
      .select('admin_id')
      .eq('conversation_id', conversationId)
      .eq('status', 'active')
      .limit(1);

    if (existing && existing.length > 0) {
      // Already assigned; 0ms overhead
      return true;
    }

    // 2. Not assigned yet: fetch active staff and batch insert
    const { data: admins, error: adminsError } = await client
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])
      .eq('account_status', 'active');

    if (adminsError || !admins || admins.length === 0) {
      return false;
    }

    const assignmentsToInsert = admins.map((admin) => ({
      conversation_id: conversationId,
      admin_id: admin.id,
      status: 'active' as const,
    }));

    await client.from('conversation_assignments').insert(assignmentsToInsert);
    return true;
  } catch (err) {
    console.error('[Assignment] Error ensuring conversation assignment:', err);
    return false;
  }
}
