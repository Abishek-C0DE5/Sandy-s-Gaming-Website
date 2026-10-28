'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, CheckCircle2, AlertCircle, Loader2, Ban, Check } from 'lucide-react';
import type { Database, UserRole } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('admin');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        throw new Error('Failed to load user directory.');
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error loading users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/admin/users')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load user directory.');
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setUsers(data.users || []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : 'Error loading users.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to provision user.');
      }

      setSuccessMsg(data.message || 'User provisioned successfully.');
      setEmail('');
      setDisplayName('');
      fetchUsers();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error provisioning user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, currentRole: UserRole, newStatus: 'active' | 'suspended') => {
    const warning =
      newStatus === 'suspended'
        ? `Are you sure you want to SUSPEND this account?\n\n• All active conversation assignments will be immediately revoked.\n• The user will be signed out from all active sessions.\n• Access to administrative portals will be denied.`
        : `Are you sure you want to REACTIVATE this account?`;

    if (!confirm(warning)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: currentRole, accountStatus: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update account status.');
      }

      setSuccessMsg(data.message || `Account successfully ${newStatus === 'suspended' ? 'suspended' : 'activated'}.`);
      fetchUsers();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error updating status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!confirm(`Are you sure you want to change this user's role to "${newRole.toUpperCase()}"?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update role.');
      }

      setSuccessMsg(`Role updated to ${newRole}.`);
      fetchUsers();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error updating role.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Staff Provisioning &amp; Account Governance
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Super Admin authorization required. Public signups can only create customer accounts.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Provisioning Form */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5 text-purple-600" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Provision or Invite Staff Account
          </h3>
        </div>

        <form onSubmit={handleProvisionUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@domain.com"
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Full Name / Staff Alias"
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Role Assignment
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="admin">Admin (Staff Specialist)</option>
              <option value="super_admin">Super Admin (System Governance)</option>
              <option value="customer">Customer</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              <span>Provision User</span>
            </button>
          </div>
        </form>
      </div>

      {/* Directory Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">User Directory</h3>
          </div>
          <span className="text-xs text-neutral-500">{users.length} registered accounts</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-600" />
            <p className="mt-2 text-xs text-neutral-500">Loading directory...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                    <td className="px-6 py-3 font-medium text-neutral-900 dark:text-white">
                      {u.display_name || 'Unnamed'}
                    </td>
                    <td className="px-6 py-3 text-neutral-600 dark:text-neutral-400">{u.email}</td>
                    <td className="px-6 py-3">
                      <select
                        value={u.role}
                        disabled={actionLoading}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                          u.role === 'super_admin'
                            ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
                            : u.role === 'admin'
                            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                            : 'border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}
                      >
                        <option value="customer">Customer</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.account_status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                        }`}
                      >
                        {u.account_status === 'active' ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <Ban className="h-3 w-3" />
                            <span>Suspended</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {u.account_status === 'active' ? (
                        <button
                          type="button"
                          disabled={actionLoading || u.role === 'super_admin'}
                          onClick={() => handleStatusChange(u.id, u.role, 'suspended')}
                          className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-30 dark:border-red-800 dark:hover:bg-red-950/30"
                        >
                          <Ban className="h-3 w-3" />
                          <span>Suspend</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleStatusChange(u.id, u.role, 'active')}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                        >
                          <Check className="h-3 w-3" />
                          <span>Activate</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
