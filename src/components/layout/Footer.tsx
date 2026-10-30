import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Shield, Sparkles, MessageSquare, BookOpen, ImageIcon, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[var(--background)]">
      <div className="w-full max-w-[1920px] 2xl:max-w-none mx-auto px-4 py-14 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <BrandLogo size="md" withText={true} href="/" glow={false} />
            <p className="max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
              Sandy&apos;s Gaming is an esports and gaming entertainment hub. Delivering exclusive articles, artwork galleries, and competitive tournament coverage with dedicated 24/7 staff support.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
              Navigation
            </h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { href: '/blog', label: 'Esports Blogs', icon: BookOpen },
                { href: '/posts', label: 'Art & Posters', icon: ImageIcon },
                { href: '/contact', label: 'Contact', icon: Mail },
                { href: '/chat', label: 'Live Chat', icon: MessageSquare },
              ].map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300">
                    <Icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Staff Access */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
              Staff &amp; Operations
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/login" className="text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/admin" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300">
                  <Shield className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>Staff Workspace</span>
                </Link>
              </li>
              <li>
                <Link href="/super-admin" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>Super Admin</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--text-muted)] gap-4">
          <p>&copy; 2026 Sandy&apos;s Gaming. All rights reserved.</p>
          <p className="font-mono text-[11px]">Built for competitive performance</p>
        </div>
      </div>
    </footer>
  );
}
