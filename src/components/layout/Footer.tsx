import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Shield, Sparkles, MessageSquare, BookOpen, ImageIcon, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#080809] text-[#A5A5AD]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <BrandLogo size="md" withText={true} href="/" glow={true} />
            <p className="max-w-md text-sm text-[#A5A5AD] leading-relaxed">
              Sandy&apos;s Gaming is an esports and gaming entertainment hub. Delivering exclusive articles, artwork galleries, and competitive tournament coverage with dedicated 24/7 staff support.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F7F8]">
              Platform Navigation
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/blog" className="flex items-center gap-1.5 hover:text-[#D71932] transition-colors">
                  <BookOpen className="h-3.5 w-3.5 text-[#D71932]" />
                  <span>Esports Blogs</span>
                </Link>
              </li>
              <li>
                <Link href="/posts" className="flex items-center gap-1.5 hover:text-[#D71932] transition-colors">
                  <ImageIcon className="h-3.5 w-3.5 text-[#D71932]" />
                  <span>Art &amp; Posters Gallery</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="flex items-center gap-1.5 hover:text-[#D71932] transition-colors">
                  <Mail className="h-3.5 w-3.5 text-[#D71932]" />
                  <span>Contact Inquiries</span>
                </Link>
              </li>
              <li>
                <Link href="/chat" className="flex items-center gap-1.5 hover:text-[#D71932] transition-colors">
                  <MessageSquare className="h-3.5 w-3.5 text-[#D71932]" />
                  <span>Customer Live Chat</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Staff Access & Security */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7F7F8]">
              Staff &amp; Operations
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/login" className="hover:text-[#D71932] transition-colors">
                  Sign In Portal
                </Link>
              </li>
              <li>
                <Link href="/admin" className="flex items-center gap-1.5 hover:text-[#D71932] transition-colors">
                  <Shield className="h-3.5 w-3.5 text-[#D71932]" />
                  <span>Staff Workspace</span>
                </Link>
              </li>
              <li>
                <Link href="/super-admin" className="flex items-center gap-1.5 hover:text-[#D71932] transition-colors">
                  <Sparkles className="h-3.5 w-3.5 text-[#D71932]" />
                  <span>Super Admin Controls</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs text-[#A5A5AD]/80 gap-4">
          <p>&copy; 2026 SANDY&apos;S GAMING. All rights reserved.</p>
          <p className="font-mono text-[11px]">Designed &bull; Engineered for Competitive Performance</p>
        </div>
      </div>
    </footer>
  );
}
