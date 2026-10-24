/**
 * GPU profiling on the local machine's real GPU (headless Edge/Chrome, 1920×1080).
 *   npm run perf -- [baseUrl]        (default http://localhost:3000)
 * Prints GPU ms per quality preset for a few viewpoints, with and without post-processing,
 * and per organelle group (time saved when the group is hidden).
 */
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const VIEWS = {
  dehors: '170,70,235,0,0,0',
  dedans: '55,25,60,-6,2,-4',
};
const PRESETS = [
  ['Bas', 'low'],
  ['Moyen', 'medium'],
  ['Élevé', 'high'],
  ['Ultra', 'ultra'],
] as const;
const ONLY = process.env.PERF_PRESETS?.split(',');
const SKIP_GROUPS = !!process.env.PERF_SKIP_GROUPS;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    channel: process.env.PERF_CHANNEL ?? 'msedge',
    headless: true,
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const gpuMs = () => page.evaluate(() => (window as unknown as { __cellulaGpuMs?: number }).__cellulaGpuMs ?? NaN);
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'inconnu';
  });
  console.log(`GPU : ${gpu}\n`);

  for (const [name, cam] of Object.entries(VIEWS)) {
    for (const fx of [true, false]) {
      const row: string[] = [];
      for (const [label, q] of PRESETS) {
        if (ONLY && !ONLY.includes(q)) continue;
        // A fresh page per preset: no leftovers from live switching.
        await page.goto(`${base}/explorer?cam=${cam}&q=${q}&stats${fx ? '' : '&nofx'}`);
        await page.waitForFunction(() => (window as unknown as { __cellulaReady?: boolean }).__cellulaReady, null, { timeout: 120000 });
        await wait(7000);
        row.push(`${label} ${(await gpuMs()).toFixed(1)}`);
      }
      console.log(`${name.padEnd(7)} ${fx ? 'avec FX' : 'sans FX'} | ${row.join(' · ')} ms`);
    }
  }

  if (SKIP_GROUPS) return browser.close();
  // Cost of each group on the default preset, inside the cell.
  await page.goto(`${base}/explorer?cam=${VIEWS.dedans}&q=high&stats`);
  await wait(9000);
  const all = await gpuMs();
  console.log(`\nCoût par groupe (Élevé, dedans) — total ${all.toFixed(1)} ms`);
  const names = await page.evaluate(() =>
    (window as unknown as { __cellulaScene: { children: { name: string; isPoints?: boolean }[] } }).__cellulaScene.children
      .filter((c) => c.name || c.isPoints)
      .map((c) => c.name || 'particles'),
  );
  for (const n of names) {
    const toggle = (v: boolean) =>
      page.evaluate(
        ([name, vis]) => {
          const s = (window as unknown as { __cellulaScene: { children: { name: string; isPoints?: boolean; visible: boolean }[] } })
            .__cellulaScene;
          const o = s.children.find((c) => (c.name || (c.isPoints ? 'particles' : '')) === name);
          if (o) o.visible = vis as boolean;
        },
        [n, v] as const,
      );
    await toggle(false);
    await wait(3000);
    const without = await gpuMs();
    await toggle(true);
    await wait(3000);
    console.log(`  ${n.padEnd(18)} ${(all - without).toFixed(1)} ms`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
