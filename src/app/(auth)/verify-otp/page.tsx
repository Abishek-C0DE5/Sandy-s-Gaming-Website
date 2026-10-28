'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { KeyRound, ArrowRight, AlertCircle, CheckCircle2, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '';

  const [target] = useState(() => searchParams.get('target') || searchParams.get('email') || '');
  const [channel] = useState<'email' | 'phone'>(() => {
    const rawChannel = searchParams.get('channel');
    if (rawChannel === 'phone' || (!rawChannel && target && !target.includes('@'))) {
      return 'phone';
    }
    return 'email';
  });

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanToken = token.trim();
    if (!cleanToken || cleanToken.length < 6) {
      setErrorMsg('Please enter a valid 6-digit passcode.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      let authResult;

      if (channel === 'phone') {
        authResult = await supabase.auth.verifyOtp({
          phone: target,
          token: cleanToken,
          type: 'sms',
        });
      } else {
        authResult = await supabase.auth.verifyOtp({
          email: target,
          token: cleanToken,
          type: 'email',
        });
      }

      if (authResult.error) {
        throw authResult.error;
      }

      const user = authResult.data.user;
      if (!user) {
        throw new Error('Authentication succeeded but user identity could not be retrieved.');
      }

      setSuccessMsg('Verification successful! Resolving your account...');

      // Query database profile to check role and account status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', user.id)
        .single();

      if (profile && profile.account_status === 'suspended') {
        await supabase.auth.signOut();
        router.push('/suspended');
        return;
      }

      setTimeout(() => {
        if (redirectTarget) {
          router.push(redirectTarget);
        } else if (profile?.role === 'super_admin') {
          router.push('/super-admin');
        } else if (profile?.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/chat');
        }
      }, 700);
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : '';
      let friendlyMessage = 'Invalid or expired OTP code. Please check the passcode and try again.';
      if (rawMessage.toLowerCase().includes('expired')) {
        friendlyMessage = 'The OTP code has expired. Please request a new code below.';
      }
      setErrorMsg(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !target) return;
    setResending(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      if (channel === 'phone') {
        const { error } = await supabase.auth.signInWithOtp({
          phone: target,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setSuccessMsg('A new 6-digit passcode has been sent to your phone.');
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: target,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setSuccessMsg('A new 6-digit passcode has been sent to your email.');
      }
      setResendCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend OTP.';
      setErrorMsg(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-neutral-200 bg-white p-8 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Enter Verification Code
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            We sent a 6-digit passcode to <br />
            <strong className="text-neutral-900 dark:text-white">
              {target || (channel === 'phone' ? 'your phone' : 'your email')}
            </strong>
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

        <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              6-Digit Code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456"
              className="mt-1 block w-full tracking-widest text-center text-2xl font-mono rounded-lg border border-neutral-300 bg-white py-3 text-neutral-900 placeholder:text-neutral-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify &amp; Continue</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-6 text-xs dark:border-neutral-800">
          <Link
            href="/login"
            className="flex items-center gap-1 font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Change {channel === 'phone' ? 'Phone' : 'Email'}</span>
          </Link>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || resending}
            className="flex items-center gap-1 font-medium text-blue-600 hover:text-blue-500 disabled:text-neutral-400 dark:text-blue-400 dark:disabled:text-neutral-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
