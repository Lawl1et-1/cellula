import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
});
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'Cellula — Explorer une cellule humaine en 3D',
  description:
    'Voyagez au cœur d’une cellule humaine vivante, comprenez ses organites et observez les effets des maladies, à partir de sources scientifiques citées.',
};

export const viewport: Viewport = {
  themeColor: '#03060c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${instrument.variable} ${geist.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
