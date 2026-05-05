
import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'bot.humango.app | Official Web Crawler Identity & Compliance',
  description: 'Verified identity and verification portal for HumangoBot. Auditing global infrastructure for GDPR compliance, SSL/TLS security, and data privacy protocols.',
  keywords: 'HumangoBot, web crawler, security audit, GDPR compliance, SSL scanner, Cloudflare verified bot, RFC 9309',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/logo.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'bot.humango.app | Identity Portal',
    description: 'Official crawler specifications, GDPR compliance standards and verified origin data.',
    url: 'https://bot.humango.app',
    siteName: 'HumangoBot Compliance',
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
