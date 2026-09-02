import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });
const serif = Instrument_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400' });

export const metadata: Metadata = {
  metadataBase: new URL('https://rokan-terminal.vercel.app'),
  // The clinic is the product and the front door; /terminal carries its own metadata.
  title: {
    default: 'Cedarfield Clinic — book an appointment',
    template: '%s',
  },
  description:
    'Cancelled appointments at Cedarfield Clinic go back on the list at the next release. Book online in a minute, or call 01632 960 118.',
  openGraph: {
    title: 'Cedarfield Clinic — book an appointment',
    description:
      'Cancelled appointments go back on the list at the next release, so nobody has to refresh the page to catch one. Book online, or call 01632 960 118.',
    images: ['/og.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cedarfield Clinic — book an appointment',
    description: 'Cancelled appointments go back on the list at the next release. Book online, or call 01632 960 118.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // dark is the CSS default too (globals.css `:root`), so SSR and the first paint agree and a
  // stored 'light' choice is applied post-hydration by initTheme() — no inline script (nonce CSP).
  return (
    <html lang="en" data-theme="dark">
      <body className={`${sans.variable} ${mono.variable} ${serif.variable} antialiased`}>{children}</body>
    </html>
  );
}
