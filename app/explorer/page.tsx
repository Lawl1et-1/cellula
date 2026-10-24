import type { Metadata } from 'next';
import { Experience } from '@/ui/Experience';

export const metadata: Metadata = { title: 'Explorer — Cellula' };

export default function ExplorerPage() {
  return <Experience intro={false} />;
}
