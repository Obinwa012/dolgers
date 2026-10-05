import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/AuthProvider';
import { BagProvider } from '@/context/BagProvider';
import { WishlistProvider } from '@/context/WishlistProvider';
import { publicEnv } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: 'DOLGERS — Independent labels for men and boys', template: '%s — DOLGERS' },
  description: 'A marketplace of independent labels for men and boys: overcoats, knitwear, denim and boots from makers who build clothes to last.',
  openGraph: { siteName: 'DOLGERS', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#0e0e0e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Jost:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-bodoni: 'Bodoni Moda', Georgia, serif;
            --font-jost: 'Jost', system-ui, sans-serif;
          }
        `}</style>
      </head>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-paper focus:px-4 focus:py-2">
          Skip to content
        </a>
        <AuthProvider>
          <BagProvider>
            <WishlistProvider>{children}</WishlistProvider>
          </BagProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
