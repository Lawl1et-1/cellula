import type { Metadata } from 'next';
import { explorerContent } from '@/content/bundle';
import { fr } from '@/i18n/fr';
import { DiseasesPage } from '@/ui/DiseasePages';

export const metadata: Metadata = {
  title: fr.meta.diseases,
  description: fr.meta.diseasesDescription,
};

export default function Page() {
  return <DiseasesPage diseases={explorerContent().diseases} />;
}
