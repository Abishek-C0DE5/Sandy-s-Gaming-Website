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
  sm: { width: 32, height: 32, text: 'text-sm' },
  md: { width: 40, height: 40, text: 'text-base' },
  lg: { width: 56, height: 56, text: 'text-lg' },
  xl: { width: 80, height: 80, text: 'text-2xl' },
  hero: { width: 220, height: 220, text: 'text-3xl' },
};

export function BrandLogo({
  size = 'md',
  withText = false,
  href,
  className = '',
}: BrandLogoProps) {
  const config = SIZES[size] || SIZES.md;

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none group ${className}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <Image
          src="/brand/sandys-gaming-logo.png"
          alt="SANDY'S GAMING"
          width={config.width}
          height={config.height}
          priority={size === 'hero' || size === 'md'}
          quality={95}
          className="relative z-10 object-contain transition-transform duration-300 ease-out group-hover:scale-105 drop-shadow-sm"
        />
      </div>

      {withText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight text-white uppercase ${config.text}`}>
            SANDY&apos;S
          </span>
          <span className="text-[10px] font-extrabold tracking-[0.25em] text-[var(--brand-highlight)] uppercase mt-0.5">
            GAMING
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
