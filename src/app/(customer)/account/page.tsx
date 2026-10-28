import { requireAuth, getCurrentProfile } from '@/lib/auth';
import { User, Mail, ShieldCheck, Clock, Key } from 'lucide-react';

export default async function CustomerAccountPage() {
  const user = await requireAuth('/login?redirect=/account');
  const profile = await getCurrentProfile();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
          Account Profile &amp; Identity
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Your authenticated identity managed via Supabase Auth &amp; PostgreSQL profile.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <User className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-neutral-500">Display Name</span>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {profile?.display_name || 'Customer User'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <Mail className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-neutral-500">Verified Email / Phone</span>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {profile?.email || user.email}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-neutral-500">Account Role</span>
              <p className="text-sm font-semibold capitalize text-neutral-900 dark:text-white">
                {profile?.role || 'Customer'}
              </p>
              <span className="text-[11px] text-neutral-400">
                Roles are protected and managed exclusively by Super Admins.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <Clock className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-neutral-500">Account Status</span>
              <p className="text-sm font-semibold capitalize text-emerald-600 dark:text-emerald-400">
                {profile?.account_status || 'Active'}
              </p>
              <span className="text-[11px] text-neutral-400">
                Active standing with full support access.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 mb-2">
          <Key className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Security &amp; Sessions</h3>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          You are signed in with a passwordless One-Time Passcode (OTP). Your session is verified server-side with cryptographic JWT cookies. No sensitive passwords or credentials are stored.
        </p>
      </div>
    </div>
  );
}
