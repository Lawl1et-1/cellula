import type { Metadata } from 'next';
import { explorerContent } from '@/content/bundle';
import { Experience } from '@/ui/Experience';

export const metadata: Metadata = { title: 'Explorer — Cellula' };

export default function ExplorerPage() {
  return <Experience intro={false} content={explorerContent()} />;
}
