import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: 'Pe — FHIR API Platform',
    template: '%s | Pe',
  },
  description:
    'The developer infrastructure layer for healthcare APIs. Stripe meets Postman — for FHIR.',
  keywords: ['FHIR', 'healthcare API', 'prior authorization', 'CMS-0057', 'developer tools'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`min-h-screen bg-background font-sans antialiased ${inter.variable}`}>{children}</body>
    </html>
  );
}
