
import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseProvider } from "@/components/providers/firebase-provider";
import { CookieBanner } from "@/components/ui/cookie-banner";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Humango Compliance | Automated Privacy & Security Auditing',
  description: 'Humango Compliance Audit Engine is a specialized privacy scanner designed to identify statutory non-compliance and GDPR liability across global web infrastructure.',
  keywords: 'privacy auditor, web compliance, GDPR audit, vulnerability scanner, digital accountability',
  metadataBase: new URL('https://humango.app'),
  alternates: {
    canonical: 'https://humango.app',
  },
  icons: {
    icon: [
      { url: '/logo.png?v=5', type: 'image/png' },
    ],
    shortcut: { url: '/logo.png?v=5', type: 'image/png' },
    apple: { url: '/logo.png?v=5', type: 'image/png' },
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Humango Compliance | Automated Privacy Auditing',
    description: 'Statutory compliance monitoring and GDPR audit engine.',
    url: 'https://humango.app',
    siteName: 'Humango Compliance',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
        alt: 'Humango Compliance Logo',
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
