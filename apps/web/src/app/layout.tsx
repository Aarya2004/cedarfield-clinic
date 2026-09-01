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
    default: 'Cedarfield Clinic — appointments released in waves',
    template: '%s',
  },
  description:
    'Your agent can hold an appointment. Only you can take it: booking is gated on one act by the person, and no tool can perform it.',
  openGraph: {
    title: 'Your agent can hold it. Only you can take it.',
    description:
      'A clinic drop your agent can watch, search and hold — and a booking only a human keypress can make. A fictional clinic; nothing real is booked.',
    images: ['/og.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your agent can hold it. Only you can take it.',
    description: 'A clinic drop your agent can watch, search and hold — and a booking only a human keypress can make.',
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
