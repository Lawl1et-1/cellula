import type { MetadataRoute } from 'next';
import { explorerContent } from '@/content/bundle';
import { SITE_URL } from '@/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const { diseases } = explorerContent();
  return [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/explorer`, priority: 0.9 },
    { url: `${SITE_URL}/maladies`, priority: 0.8 },
    ...diseases.map((d) => ({ url: `${SITE_URL}/maladies/${d.slug}`, priority: 0.6 })),
  ];
}
