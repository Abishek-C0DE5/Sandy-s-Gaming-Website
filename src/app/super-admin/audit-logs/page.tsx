import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ShieldAlert } from 'lucide-react';
import { AuditLogsClient, type AuditLogItem } from './AuditLogsClient';

export default async function SuperAdminAuditLogsPage() {
  await requireRole(['super_admin'], '/super-admin/audit-logs');
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from('audit_logs')
    .select(`
      id,
      actor_id,
      action,
      target_type,
      target_id,
      metadata,
      created_at,
      actor:profiles!audit_logs_actor_id_fkey(
        id,
        display_name,
        email,
        role
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  // Cast safely for AuditLogItem
  const auditLogs = ((logs || []) as unknown as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor?: {
      id: string;
      display_name: string;
      email: string;
      role: string;
    } | Array<{
      id: string;
      display_name: string;
      email: string;
      role: string;
    }> | null;
  }>).map((l) => ({
    ...l,
    actor: Array.isArray(l.actor) ? l.actor[0] || null : l.actor || null,
  })) as AuditLogItem[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Security Audit Trail
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Immutable, append-only event ledger capturing all administrative mutations, role updates, suspensions, and interventions. Protected by database trigger against deletion or tampering.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Append-Only Engine</span>
        </div>
      </div>

      <AuditLogsClient initialLogs={auditLogs} />
    </div>
  );
}
