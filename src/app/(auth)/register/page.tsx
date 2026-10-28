'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, User, ArrowRight, Shield, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/chat';

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter a display name (at least 2 characters).');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // 1. Call server registration endpoint
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account.');
      }

      setSuccessMsg('Account created successfully! Signing you in...');

      // 2. Automatically sign in with client
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        // Fallback: redirect to login if auto-login fails
        router.push(`/login?email=${encodeURIComponent(cleanEmail)}`);
        return;
      }

      // 3. Redirect to live chat
      setTimeout(() => {
        router.push(redirectTarget);
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#D71932] text-white shadow-sm">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Create Your Account
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Join Sandy&apos;s Gaming to start chatting with our Support Team.
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

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Chosen Display Name
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <User className="h-4 w-4" />
              </div>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="GamerTag or Your Name"
                className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D71932] focus:ring-1 focus:ring-[#D71932] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email Address
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D71932] focus:ring-1 focus:ring-[#D71932] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Password
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D71932] focus:ring-1 focus:ring-[#D71932] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Confirm Password
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="reg-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D71932] focus:ring-1 focus:ring-[#D71932] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D71932] py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#b01328] disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="border-t border-neutral-200 pt-4 text-center text-xs text-neutral-500 dark:border-neutral-800">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#D71932] hover:underline">
              Sign In here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
