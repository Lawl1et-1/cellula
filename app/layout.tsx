import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { SITE_URL } from '@/site';
import { fr } from '@/i18n/fr';
import { en } from '@/i18n/en';
import { STORAGE_KEY } from '@/i18n/config';
import './globals.css';

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
});
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

const { title, description, ogLocale } = fr.meta;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: {
    type: 'website',
    locale: ogLocale,
    alternateLocale: en.meta.ogLocale,
    siteName: 'Cellula',
    title,
    description,
  },
  twitter: { card: 'summary_large_image', title, description },
};

/** Applies the remembered language to <html lang> before the first paint (the text follows on hydration). */
const langScript = `try{var l=localStorage.getItem('${STORAGE_KEY}')||(document.cookie.match(/(?:^|; )${STORAGE_KEY}=(fr|en)/)||[])[1];if(l==='en'||l==='fr')document.documentElement.lang=l}catch(e){}`;

export const viewport: Viewport = {
  themeColor: '#03060c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${instrument.variable} ${geist.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: langScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
