import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let realtimeAdminClient: SupabaseClient | null = null;

function getRealtimeAdminClient(): SupabaseClient | null {
  if (!realtimeAdminClient && supabaseUrl && serviceRoleKey) {
    realtimeAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return realtimeAdminClient;
}

export type RealtimeBroadcastEvent =
  | 'new_message'
  | 'assignment_revoked'
  | 'assignment_added'
  | 'status_changed';

/**
 * Broadcasts an event to a private conversation topic.
 * Uses service-role authorization to bypass client RLS on emission.
 * Subscribing clients receive the event subject to private channel authorization.
 */
export async function broadcastConversationEvent(
  conversationId: string,
  event: RealtimeBroadcastEvent,
  payload: Record<string, unknown>
): Promise<boolean> {
  const client = getRealtimeAdminClient();
  if (!client) {
    console.warn('[Realtime Broadcast] Service role client is not configured');
    return false;
  }

  const topic = `conversation:${conversationId}`;
  const channel = client.channel(topic, {
    config: { private: true },
  });

  return new Promise((resolve) => {
    let completed = false;

    const timeout = setTimeout(async () => {
      if (!completed) {
        completed = true;
        try {
          await client.removeChannel(channel);
        } catch {}
        resolve(false);
      }
    }, 4000);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && !completed) {
        try {
          await channel.send({
            type: 'broadcast',
            event,
            payload,
          });
        } catch (err) {
          console.error(`[Realtime Broadcast Error: ${event}]`, err);
        } finally {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            try {
              await client.removeChannel(channel);
            } catch {}
            resolve(true);
          }
        }
      } else if (status === 'CHANNEL_ERROR' && !completed) {
        completed = true;
        clearTimeout(timeout);
        try {
          await client.removeChannel(channel);
        } catch {}
        resolve(false);
      }
    });
  });
}
