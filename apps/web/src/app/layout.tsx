import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif, Public_Sans } from 'next/font/google';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });
const serif = Instrument_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400' });
// The clinic routes set everything — headings, body, times, buttons — in one face. Public Sans is a
// UK public-service face: plain, wide-apertured, and legible at 15px for a patient reading it on a
// phone. It is scoped to `.clinic` through `--clinic-sans`; the rest of the app keeps Geist.
const clinicSans = Public_Sans({ variable: '--font-clinic-sans', subsets: ['latin'], weight: ['400', '600', '700'] });

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
      <body className={`${sans.variable} ${mono.variable} ${serif.variable} ${clinicSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
