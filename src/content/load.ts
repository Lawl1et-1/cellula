import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { Disease, Organelle, Source } from './schema';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export interface LoadIssue {
  file: string;
  message: string;
}

function readJsonFiles(dir: string): { file: string; data: unknown }[] {
  const abs = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(abs)) return [];
  const entries = fs.readdirSync(abs, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => {
      const file = path.join(e.parentPath, e.name);
      return { file: path.relative(process.cwd(), file), data: JSON.parse(fs.readFileSync(file, 'utf8')) };
    });
}

function parseAll<T extends z.ZodType>(dir: string, schema: T, issues: LoadIssue[]): z.infer<T>[] {
  const out: z.infer<T>[] = [];
  for (const { file, data } of readJsonFiles(dir)) {
    const res = schema.safeParse(data);
    if (res.success) out.push(res.data);
    else for (const i of res.error.issues) issues.push({ file, message: `${i.path.join('.')}: ${i.message}` });
  }
  return out;
}

export interface ContentBundle {
  sources: Source[];
  organelles: Organelle[];
  diseases: Disease[];
}

/** Loads and schema-validates all content. Server/build-time only. */
export function loadContent(): { content: ContentBundle; issues: LoadIssue[] } {
  const issues: LoadIssue[] = [];
  const content = {
    sources: parseAll('sources', Source, issues),
    organelles: parseAll('organelles', Organelle, issues),
    diseases: parseAll('diseases', Disease, issues),
  };
  return { content, issues };
}

/** Collects every source id referenced anywhere inside a value. */
export function collectSourceRefs(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => collectSourceRefs(v, acc));
  else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.sources)) {
      for (const s of obj.sources) if (s && typeof s === 'object' && 'id' in s) acc.push(String(s.id));
    }
    for (const [k, v] of Object.entries(obj)) if (k !== 'sources') collectSourceRefs(v, acc);
  }
  return acc;
}

/** Cross-file checks the schemas cannot express. */
export function checkIntegrity({ sources, organelles, diseases }: ContentBundle): LoadIssue[] {
  const issues: LoadIssue[] = [];
  const sourceIds = new Set(sources.map((s) => s.id));
  const dup = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

  for (const id of dup(sources.map((s) => s.id))) issues.push({ file: 'sources', message: `id dupliqué : ${id}` });
  for (const id of dup(organelles.map((o) => o.id)))
    issues.push({ file: 'organelles', message: `id dupliqué : ${id}` });
  for (const id of dup(diseases.map((d) => d.slug))) issues.push({ file: 'diseases', message: `slug dupliqué : ${id}` });

  const check = (owner: string, value: unknown) => {
    for (const ref of collectSourceRefs(value))
      if (!sourceIds.has(ref)) issues.push({ file: owner, message: `source inconnue : ${ref}` });
  };
  organelles.forEach((o) => check(`organelle ${o.id}`, o));

  for (const d of diseases) {
    check(`maladie ${d.id}`, d);
    const stages = [...d.stages].sort((a, b) => a.range[0] - b.range[0]);
    if (stages[0]?.range[0] !== 0 || stages.at(-1)?.range[1] !== 1)
      issues.push({ file: `maladie ${d.id}`, message: 'les stades doivent couvrir [0, 1]' });
    stages.forEach((s, i) => {
      const next = stages[i + 1];
      if (s.range[0] >= s.range[1]) issues.push({ file: `maladie ${d.id}`, message: `stade ${s.id} : intervalle vide` });
      if (next && Math.abs(next.range[0] - s.range[1]) > 1e-6)
        issues.push({ file: `maladie ${d.id}`, message: `trou ou chevauchement entre ${s.id} et ${next.id}` });
    });
  }
  return issues;
}
