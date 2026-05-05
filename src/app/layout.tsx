import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'HumangoBot | Official Web Crawler Identity & Compliance',
  description: 'Verified identity and verification portal for HumangoBot. Auditing global infrastructure for GDPR compliance, SSL/TLS security, and data privacy protocols.',
  keywords: 'HumangoBot, web crawler, security audit, GDPR compliance, SSL scanner, Cloudflare verified bot, RFC 9309',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22 fill=%22none%22><rect width=%22100%22 height=%22100%22 fill=%22black%22/><path d=%22M15 15h20v70H15V15zm20 25h30v15H35V40zm10-25h40v15H45V15zm25 10h15v50H45V60h30V25z%22 fill=%22%235EEAD4%22/></svg>',
  },
  openGraph: {
    title: 'HumangoBot | Identity Portal',
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
