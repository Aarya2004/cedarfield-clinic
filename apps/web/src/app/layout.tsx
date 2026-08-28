import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Rokan Terminal',
  description:
    'A terminal you and your agent share. Your Enter is the trust boundary. WebMCP tools on the page; nothing executes without a human keypress.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
