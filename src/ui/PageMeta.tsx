'use client';

import { useEffect } from 'react';
import type { LocalizedText } from '@/content/schema/common';
import { DICTIONARIES, pick, useLocale } from '@/i18n/locale';

function setMeta(selector: string, value: string) {
  document.querySelector(selector)?.setAttribute('content', value);
}

/**
 * Keeps the document language, title and description in step with the interface language. The server
 * renders the French metadata; crawlers index that version.
 */
export function PageMeta({ title, description }: { title?: LocalizedText; description?: LocalizedText }) {
  const locale = useLocale();
  useEffect(() => {
    const t = DICTIONARIES[locale];
    document.documentElement.lang = locale;
    const pageTitle = title ? pick(title, locale) : t.meta.title;
    const pageDescription = description ? pick(description, locale) : t.meta.description;
    const apply = () => {
      document.title = pageTitle;
      setMeta('meta[name="description"]', pageDescription);
      setMeta('meta[property="og:title"]', pageTitle);
      setMeta('meta[property="og:description"]', pageDescription);
      setMeta('meta[property="og:locale"]', t.meta.ogLocale);
      setMeta('meta[name="twitter:title"]', pageTitle);
      setMeta('meta[name="twitter:description"]', pageDescription);
    };
    apply();
    // Next.js streams the server metadata in after hydration: re-apply when it lands.
    const observer = new MutationObserver(() => {
      if (document.title !== pageTitle) apply();
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale, title?.fr, title?.en, description?.fr, description?.en]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
