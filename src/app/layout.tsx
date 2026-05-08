
import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseProvider } from "@/components/providers/firebase-provider";
import { CookieBanner } from "@/components/ui/cookie-banner";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'HumangoBot | Automated Compliance & Security Auditing',
  description: 'HumangoBot is a specialized security crawler designed to identify technical vulnerabilities and monitor GDPR compliance across global web infrastructure.',
  keywords: 'security crawler, web auditing, GDPR compliance, vulnerability scanner, bot transparency',
  metadataBase: new URL('https://humango.app'),
  alternates: {
    canonical: 'https://humango.app',
  },
  icons: {
    icon: [
      { url: '/logo.png?v=4', type: 'image/png' },
    ],
    shortcut: { url: '/logo.png?v=4', type: 'image/png' },
    apple: { url: '/logo.png?v=4', type: 'image/png' },
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
  openGraph: {
    title: 'HumangoBot | Automated Compliance & Security Auditing',
    description: 'HumangoBot is a specialized security crawler designed to identify technical vulnerabilities and monitor GDPR compliance across global web infrastructure.',
    url: 'https://humango.app',
    siteName: 'HumangoBot',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
        alt: 'HumangoBot Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-body antialiased selection:bg-primary/30">
        <FirebaseProvider>
          {children}
          <Toaster />
          <CookieBanner />
        </FirebaseProvider>
      </body>
    </html>
  );
}
