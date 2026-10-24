/**
 * Renders reference viewpoints to PNG with headless Edge/Chrome on the local GPU.
 *   npm run shots -- [baseUrl] [outDir] [quality]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const out = process.argv[3] ?? 'docs/reviews/img';
const quality = process.argv[4] ?? 'high';

export const VIEWS: Record<string, string> = {
  intro: '/',
  cellule: '/explorer?cam=170,70,235,0,0,0',
  interieur: '/explorer?cam=55,25,60,-6,2,-4',
  mitochondrie: '/explorer?cam=28,66,17,18,57.5,7.2',
  noyau: '/explorer?cam=-19,36,10,-14.7,27.5,3.8',
};

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.PERF_CHANNEL ?? 'msedge',
    headless: true,
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  for (const [name, url] of Object.entries(VIEWS)) {
    const sep = url.includes('?') ? '&' : '?';
    await page.goto(`${base}${url}${sep}q=${quality}`);
    await page.waitForFunction(() => (window as unknown as { __cellulaReady?: boolean }).__cellulaReady, null, { timeout: 120000 });
    await new Promise((r) => setTimeout(r, 9000));
    const file = path.join(out, `${name}-${quality}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
