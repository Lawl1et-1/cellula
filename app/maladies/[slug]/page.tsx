import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { explorerContent } from '@/content/bundle';
import { DiseasePage } from '@/ui/DiseasePages';

export function generateStaticParams() {
  return explorerContent().diseases.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = explorerContent().diseases.find((x) => x.slug === slug);
  if (!d) return {};
  return { title: `${d.name.fr} — Cellula`, description: d.summary.text.fr };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { diseases, sources } = explorerContent();
  const d = diseases.find((x) => x.slug === slug);
  if (!d) notFound();
  return <DiseasePage disease={d} sources={sources} />;
}
