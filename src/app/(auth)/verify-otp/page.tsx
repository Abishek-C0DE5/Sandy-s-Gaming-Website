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
      <div className="w-full max-w-md space-y-8 rounded-3xl glass-elevated p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl glass text-[var(--brand-primary)] animate-float">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
            Enter Verification Code
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            We sent a 6-digit passcode to <br />
            <strong className="text-white">
              {target || (channel === 'phone' ? 'your phone' : 'your email')}
            </strong>
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6">
          <div>
            <label htmlFor="token" className="block text-xs font-semibold text-[var(--text-secondary)] text-center mb-2">
              Enter 6-Digit Passcode
            </label>
            <input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••"
              className="block w-full tracking-[0.4em] text-center text-3xl font-mono rounded-2xl border border-white/[0.08] bg-[var(--surface-secondary)] py-4 text-white placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]/50 focus:ring-1 focus:ring-[var(--brand-primary)]/30 focus:outline-none transition-all duration-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 transition-all duration-300"
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

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-6 text-xs">
          <Link
            href="/login"
            className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Change {channel === 'phone' ? 'Phone' : 'Email'}</span>
          </Link>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || resending}
            className="flex items-center gap-1.5 font-semibold text-[var(--brand-primary)] hover:underline disabled:text-[var(--text-muted)] disabled:no-underline transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] animate-spin" />
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
