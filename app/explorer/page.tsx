import type { Metadata } from 'next';
import { explorerContent } from '@/content/bundle';
import { Experience } from '@/ui/Experience';
import { fr } from '@/i18n/fr';

export const metadata: Metadata = { title: fr.meta.explorer };

export default function ExplorerPage() {
  return <Experience intro={false} content={explorerContent()} />;
}
