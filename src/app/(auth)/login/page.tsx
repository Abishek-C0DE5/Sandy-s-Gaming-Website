'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Mail, Phone, Lock, KeyRound, ArrowRight, Shield, AlertCircle, CheckCircle2, Loader2, User } from 'lucide-react';

type ChannelType = 'email' | 'phone';
type AuthMode = 'password' | 'otp';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '';
  const initialError = searchParams.get('error') || null;

  const configuredChannel = (process.env.NEXT_PUBLIC_AUTH_OTP_CHANNEL || 'email').toLowerCase();
  const allowBoth = configuredChannel === 'both';
  const defaultMode: ChannelType = configuredChannel === 'sms' ? 'phone' : 'email';

  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [activeChannel, setActiveChannel] = useState<ChannelType>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper to autofill test credentials
  const fillTestCredentials = (userEmail: string, userPass: string) => {
    setAuthMode('password');
    setEmail(userEmail);
    setPassword(userPass);
    setErrorMsg(null);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Invalid email or password. Please verify your credentials.');
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('Authentication succeeded but user session could not be established.');
      }

      setSuccessMsg('Signed in successfully! Resolving destination...');

      // Query database profile to check role and status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', data.user.id)
        .single();

      if (profile && profile.account_status === 'suspended') {
        await supabase.auth.signOut();
        window.location.href = '/suspended';
        return;
      }

      const dest = redirectTarget || (
        profile?.role === 'super_admin'
          ? '/super-admin'
          : profile?.role === 'admin'
          ? '/admin/conversations'
          : '/chat'
      );
      window.location.href = dest;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in. Please try again.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = createClient();
    const origin = window.location.origin;
    const callbackUrl = `${origin}/auth/callback${redirectTarget ? `?next=${encodeURIComponent(redirectTarget)}` : ''}`;

    setLoading(true);

    try {
      if (activeChannel === 'email') {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          throw new Error('Please enter a valid email address.');
        }

        const { error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            emailRedirectTo: callbackUrl,
            shouldCreateUser: true,
          },
        });

        if (error) {
          if (error.message.toLowerCase().includes('rate limit')) {
            throw new Error('Rate limit reached. Please wait a minute before requesting another passcode.');
          }
          throw error;
        }

        setSuccessMsg('Passcode sent successfully! Redirecting...');
        setTimeout(() => {
          router.push(
            `/verify-otp?channel=email&target=${encodeURIComponent(cleanEmail)}${redirectTarget ? `&redirect=${encodeURIComponent(redirectTarget)}` : ''}`
          );
        }, 800);
      } else {
        const cleanPhone = phone.trim();
        if (!cleanPhone || cleanPhone.length < 8) {
          throw new Error('Please enter a valid phone number with country code (e.g. +1234567890).');
        }

        const { error } = await supabase.auth.signInWithOtp({
          phone: cleanPhone,
          options: {
            shouldCreateUser: true,
          },
        });

        if (error) {
          if (error.message.toLowerCase().includes('sms provider')) {
            throw new Error('SMS delivery is not configured on this Supabase project. Please use Email OTP.');
          }
          throw error;
        }

        setSuccessMsg('SMS passcode sent! Redirecting...');
        setTimeout(() => {
          router.push(
            `/verify-otp?channel=phone&target=${encodeURIComponent(cleanPhone)}${redirectTarget ? `&redirect=${encodeURIComponent(redirectTarget)}` : ''}`
          );
        }, 800);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP code. Please try again.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/[0.08] bg-[#101012] p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto relative h-16 w-16 rounded-2xl overflow-hidden border border-[#D71932]/40 bg-[#171719] flex items-center justify-center shadow-[0_0_25px_rgba(215,25,50,0.35)] p-2">
            <Image
              src="/brand/sandys-gaming-logo.png"
              alt="Sandy's Gaming"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="mt-4 text-2xl font-black uppercase tracking-wider text-white">
            Sign In to Sandy&apos;s Gaming
          </h1>
          <p className="mt-2 text-sm text-[#A5A5AD]">
            Select your preferred sign in method.
          </p>
        </div>

        {/* Primary Auth Mode Switcher (Password vs OTP) */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#171719] p-1 border border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setErrorMsg(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
              authMode === 'password'
                ? 'bg-[#D71932] text-white shadow-[0_0_12px_rgba(215,25,50,0.35)]'
                : 'text-[#A5A5AD] hover:text-white'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('otp');
              setErrorMsg(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
              authMode === 'otp'
                ? 'bg-[#D71932] text-white shadow-[0_0_12px_rgba(215,25,50,0.35)]'
                : 'text-[#A5A5AD] hover:text-white'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Passcode (OTP)</span>
          </button>
        </div>

        {/* Channel Switcher (if OTP mode & both enabled) */}
        {authMode === 'otp' && allowBoth && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-100/70 p-1 dark:bg-neutral-800/70">
            <button
              type="button"
              onClick={() => {
                setActiveChannel('email');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
                activeChannel === 'email'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Email OTP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveChannel('phone');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
                activeChannel === 'phone'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400'
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              <span>SMS OTP</span>
            </button>
          </div>
        )}

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

        {/* Password Form */}
        {authMode === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Email Address
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In with Password</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* OTP Form */
          <form onSubmit={handleSendOtp} className="space-y-4">
            {activeChannel === 'email' ? (
              <div>
                <label htmlFor="otp-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="otp-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="otp-phone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Phone Number (E.164 with Country Code)
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    id="otp-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="block w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Requesting Passcode...</span>
                </>
              ) : (
                <>
                  <span>Send One-Time Passcode</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Test Accounts Autofill Helper */}
        <div className="rounded-xl border border-white/[0.08] bg-[#171719] p-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#A5A5AD]">
            <User className="h-3.5 w-3.5 text-[#D71932]" />
            <span>Test Personas (Click to autofill):</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => fillTestCredentials('visitor.sandysgaming@gmail.com', 'TestPassword123!')}
              className="rounded-lg border border-white/[0.08] bg-[#101012] px-2 py-1.5 text-center font-bold text-xs text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
            >
              Visitor
            </button>
            <button
              type="button"
              onClick={() => fillTestCredentials('admin.sandysgaming@gmail.com', 'TestPassword123!')}
              className="rounded-lg border border-white/[0.08] bg-[#101012] px-2 py-1.5 text-center font-bold text-xs text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => fillTestCredentials('superadmin.sandysgaming@gmail.com', 'TestPassword123!')}
              className="rounded-lg border border-white/[0.08] bg-[#101012] px-2 py-1.5 text-center font-bold text-xs text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
            >
              Super Admin
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#171719]/50 p-3 text-center text-xs">
          <span className="text-[#A5A5AD]">New to Sandy&apos;s Gaming? </span>
          <Link href="/register" className="font-bold text-[#D71932] hover:underline">
            Create an Account
          </Link>
        </div>

        <div className="border-t border-white/[0.08] pt-4 text-center text-xs text-[#A5A5AD]">
          <p>
            Are you a guest visitor? You don&apos;t need to log in to contact us.{' '}
            <Link href="/contact" className="font-bold text-[#D71932] hover:underline">
              Submit a Guest Inquiry
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
