import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import '../styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || 'https://meet.example.com'),
  title: {
    default: 'Cut Stream',
    template: '%s | Cut Stream',
  },
  description: 'Private review sessions.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Cut Stream',
    description: 'Private review sessions.',
    siteName: 'Cut Stream',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, type: 'image/png' }],
  },
  icons: {
    icon: { rel: 'icon', url: '/favicon.png' },
    apple: [{ rel: 'apple-touch-icon', url: '/images/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0F1B2E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
