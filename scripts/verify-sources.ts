/**
 * Checks every source against NCBI (E-utilities), so that no reference in Cellula can be invented:
 *  - PubMed sources (pmid): the article exists and its title matches;
 *  - NCBI Bookshelf sources (GeneReviews, StatPearls, textbooks): the chapter/section exists and its
 *    title matches.
 *   npm run verify:sources            report only
 *   npm run verify:sources -- --write record { verified: { on, via } } in each verified file
 * Requires network access; not part of CI (NCBI rate limits), run it when adding sources.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content', 'sources');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const write = process.argv.includes('--write');
const today = new Date().toISOString().slice(0, 10);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json(url: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    await wait(1000 * (attempt + 1));
  }
  throw new Error(`NCBI indisponible : ${url}`);
}

/** Lowercase, no accents, no punctuation: titles are compared loosely (NCBI adds periods, etc.). */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function pubmedTitle(pmid: string) {
  const r = await json(`${EUTILS}esummary.fcgi?db=pubmed&retmode=json&id=${pmid}`);
  return (r.result?.[pmid]?.title as string | undefined) ?? null;
}

async function bookshelfTitle(rid: string) {
  const ids = (await json(`${EUTILS}esearch.fcgi?db=books&retmode=json&term=${encodeURIComponent(`${rid}[rid]`)}`))
    .esearchresult.idlist as string[];
  if (!ids.length) return null;
  await wait(350);
  const r = await json(`${EUTILS}esummary.fcgi?db=books&retmode=json&id=${ids[0]}`);
  return (r.result?.[ids[0]!]?.title as string | undefined) ?? null;
}

/** https://www.ncbi.nlm.nih.gov/books/NBK26932/#A2156 → NBK26932/A2156 */
function bookshelfRid(url: string) {
  const m = url.match(/ncbi\.nlm\.nih\.gov\/books\/(NBK\d+)\/?(?:#(\w+))?/);
  return m ? (m[2] ? `${m[1]}/${m[2]}` : m[1]!) : null;
}

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  let ok = 0;
  const problems: string[] = [];
  const unverifiable: string[] = [];

  for (const file of files) {
    const p = path.join(DIR, file);
    const source = JSON.parse(fs.readFileSync(p, 'utf8'));
    let found: string | null = null;
    let via: 'pubmed' | 'ncbi-bookshelf' | null = null;

    if (source.pmid) {
      found = await pubmedTitle(source.pmid);
      via = 'pubmed';
    } else if (source.url && bookshelfRid(source.url)) {
      found = await bookshelfTitle(bookshelfRid(source.url)!);
      via = 'ncbi-bookshelf';
    } else {
      unverifiable.push(`${file} (ni PMID ni NCBI Bookshelf : à vérifier à la main)`);
      continue;
    }
    await wait(350);

    if (!found) {
      problems.push(`${file} : introuvable sur NCBI`);
    } else if (!norm(found).includes(norm(source.title)) && !norm(source.title).includes(norm(found))) {
      problems.push(`${file} : titre différent\n    fichier : ${source.title}\n    NCBI    : ${found}`);
    } else {
      ok++;
      if (write && via) {
        source.verified = { on: today, via };
        fs.writeFileSync(p, JSON.stringify(source, null, 2) + '\n');
      }
    }
  }

  console.log(`✓ ${ok} source(s) vérifiée(s) sur NCBI`);
  for (const u of unverifiable) console.log(`  ? ${u}`);
  if (problems.length) {
    console.error(`✗ ${problems.length} problème(s) :`);
    for (const pr of problems) console.error(`  ${pr}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
