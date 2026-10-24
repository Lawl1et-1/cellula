'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ExplorerContent } from '@/content/bundle';
import type { Organelle, OrganelleId, Source } from '@/content/schema';

interface ContentIndex {
  organelles: Organelle[];
  organelle: (id: OrganelleId) => Organelle | undefined;
  source: (id: string) => Source | undefined;
}

const Ctx = createContext<ContentIndex | null>(null);

export function ContentProvider({ content, children }: { content: ExplorerContent; children: React.ReactNode }) {
  const value = useMemo<ContentIndex>(() => {
    const organelles = new Map(content.organelles.map((o) => [o.id, o]));
    const sources = new Map(content.sources.map((s) => [s.id, s]));
    return {
      organelles: content.organelles,
      organelle: (id) => organelles.get(id),
      source: (id) => sources.get(id),
    };
  }, [content]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useContent outside ContentProvider');
  return ctx;
}
