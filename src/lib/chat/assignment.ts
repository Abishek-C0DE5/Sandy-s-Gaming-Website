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
    const { data: admins, error: adminsError } = await client
      .from('profiles')
      .select('id, email, role')
      .in('role', ['admin', 'super_admin'])
      .eq('account_status', 'active');

    if (adminsError || !admins || admins.length === 0) {
      console.warn('[Assignment] No active admins found in profiles');
      return false;
    }

    for (const admin of admins) {
      const { data: existing } = await client
        .from('conversation_assignments')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('admin_id', admin.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!existing) {
        await client.from('conversation_assignments').insert({
          conversation_id: conversationId,
          admin_id: admin.id,
          status: 'active',
        });
      }
    }

    return true;
  } catch (err) {
    console.error('[Assignment] Error ensuring conversation assignment:', err);
    return false;
  }
}
