'use client';

import Image from 'next/image';
import Link from 'next/link';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  glow?: boolean;
  withText?: boolean;
  href?: string;
  className?: string;
}

const SIZES = {
  sm: { width: 36, height: 36, text: 'text-sm' },
  md: { width: 48, height: 48, text: 'text-base' },
  lg: { width: 64, height: 64, text: 'text-lg' },
  xl: { width: 96, height: 96, text: 'text-2xl' },
  hero: { width: 220, height: 220, text: 'text-3xl' },
};

export function BrandLogo({
  size = 'md',
  glow = false,
  withText = false,
  href,
  className = '',
}: BrandLogoProps) {
  const config = SIZES[size] || SIZES.md;

  const content = (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div className={`relative flex items-center justify-center shrink-0`}>
        {glow && (
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-60 bg-[#D71932] animate-pulse pointer-events-none"
            aria-hidden="true"
          />
        )}
        <Image
          src="/brand/sandys-gaming-logo.png"
          alt="SANDY'S GAMING"
          width={config.width}
          height={config.height}
          priority={size === 'hero' || size === 'md'}
          className="relative z-10 object-contain drop-shadow-[0_4px_12px_rgba(215,25,50,0.3)] transition-transform duration-300 hover:scale-105"
        />
      </div>

      {withText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-wider text-[#F7F7F8] uppercase ${config.text}`}>
            SANDY&apos;S
          </span>
          <span className="text-[10px] font-bold tracking-[0.25em] text-[#D71932] uppercase">
            GAMING
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D71932] rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
