import { requireRole } from '@/lib/auth';
import { Shield, Server, Bell } from 'lucide-react';

export default async function SuperAdminSettingsPage() {
  await requireRole(['super_admin'], '/super-admin/settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          System Governance Settings
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Global configuration, security policies, and environment status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Database &amp; API Health</h3>
          </div>
          <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="font-medium">Supabase Project Ref</span>
              <span className="font-mono text-neutral-900 dark:text-white">
                {process.env.NEXT_PUBLIC_SUPABASE_URL
                  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
                  : 'Configured'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="font-medium">Row Level Security (RLS)</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                Enforced (9 Tables)
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="font-medium">Realtime Engine</span>
              <span className="font-mono text-neutral-900 dark:text-white">messages publication active</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Authentication Policies</h3>
          </div>
          <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="font-medium">Primary OTP Channel</span>
              <span className="font-mono capitalize text-neutral-900 dark:text-white">
                {process.env.NEXT_PUBLIC_AUTH_OTP_CHANNEL || 'email'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="font-medium">Default Registration Role</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">customer (Protected by trigger)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="font-medium">Session Verification</span>
              <span className="font-mono text-neutral-900 dark:text-white">Server-side cookies + Next.js 16 Proxy</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Notification Integrations</h3>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          Transactional email dispatch drivers (Resend / SendGrid) and SMS gateways will be configured in Phase 9 &amp; 10 for automated customer notifications.
        </p>
      </div>
    </div>
  );
}
