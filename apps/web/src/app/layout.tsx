import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });
const serif = Instrument_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400' });

export const metadata: Metadata = {
  title: 'Rokan Terminal',
  description:
    "Do it once. Now it's a tool. Now every agent can call it. A terminal where what you and your agent compose — across sites and your machine — becomes a live WebMCP tool, born at runtime, kept, callable by any agent.",
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
