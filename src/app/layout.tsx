import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/layout/Footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sandys-gaming.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SANDY'S GAMING — Elite Esports Hub, Artwork & Live Support",
    template: "%s | Sandy's Gaming",
  },
  description:
    "Dominate the competitive arena with Sandy's Gaming. In-depth esports tournament breakdowns, gaming meta guides, exclusive 4K wallpaper posters, and 24/7 dedicated live chat support.",
  keywords: [
    "Sandy's Gaming",
    'esports arena',
    'gaming news',
    'competitive esports',
    'valorant guides',
    'cs2 retake tactics',
    'gaming wallpapers',
    'esports posters',
    'live chat gaming support',
    'gaming tournaments',
  ],
  authors: [{ name: "Sandy's Gaming", url: siteUrl }],
  creator: "Sandy's Gaming HQ",
  publisher: "Sandy's Gaming",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: "Sandy's Gaming",
    title: "SANDY'S GAMING — Elite Esports Hub, Artwork & Live Support",
    description:
      "Dominate the competitive arena with Sandy's Gaming. In-depth esports tournament breakdowns, gaming meta guides, exclusive 4K wallpaper posters, and 24/7 dedicated live chat support.",
    images: [
      {
        url: '/brand/sandys-gaming-logo.png',
        width: 1200,
        height: 630,
        alt: "Sandy's Gaming Official Banner",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "SANDY'S GAMING — Elite Esports Hub, Artwork & Live Support",
    description:
      "Dominate the competitive arena with Sandy's Gaming. In-depth esports tournament breakdowns, gaming meta guides, and live support.",
    images: ['/brand/sandys-gaming-logo.png'],
    creator: '@sandysgaming',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/brand/sandys-gaming-logo.webp',
    apple: '/brand/sandys-gaming-logo.webp',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: "Sandy's Gaming",
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/brand/sandys-gaming-logo.png`,
        },
        description: "Premier esports community, editorial publications, visual posters, and live gaming support.",
        sameAs: [],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        url: siteUrl,
        name: "Sandy's Gaming",
        publisher: {
          '@id': `${siteUrl}#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/blog?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]"
        suppressHydrationWarning
      >
        {/* Pre-hydration cleanup script to strip browser-extension injected attributes (Bitdefender bis_skin_checked, etc.) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{function c(n){if(n&&n.nodeType===1){if(n.hasAttribute('bis_skin_checked'))n.removeAttribute('bis_skin_checked');var a=n.attributes;for(var i=a.length-1;i>=0;i--){var nm=a[i].name;if(nm.indexOf('__processed_')===0||nm==='bis_skin_checked'||nm==='cz-shortcut-listen'){n.removeAttribute(nm)}}var ch=n.querySelectorAll('[bis_skin_checked],[cz-shortcut-listen]');for(var j=0;j<ch.length;j++){ch[j].removeAttribute('bis_skin_checked');ch[j].removeAttribute('cz-shortcut-listen')}}}c(document.documentElement);var o=new MutationObserver(function(m){for(var i=0;i<m.length;i++){var t=m[i];if(t.type==='attributes'){var an=t.attributeName;if(an==='bis_skin_checked'||(an&&an.indexOf('__processed_')===0)||an==='cz-shortcut-listen'){t.target.removeAttribute(an)}}else if(t.addedNodes){for(var j=0;j<t.addedNodes.length;j++)c(t.addedNodes[j])}}});o.observe(document.documentElement,{attributes:true,childList:true,subtree:true})}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Suspense fallback={<header className="h-16 w-full bg-[var(--background)]/80" />}>
          <Navbar />
        </Suspense>
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
