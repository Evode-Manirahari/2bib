import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { PostHogProvider } from '@/providers/posthog';
import './globals.css';

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

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
      <body className={`min-h-screen bg-background font-sans antialiased ${ibmPlexMono.variable} ${ibmPlexSans.variable}`}>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
