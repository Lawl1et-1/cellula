import { chromium } from 'playwright-core';
(async () => {
  const out = process.env.TEMP + '/shots';
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  p.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 200)));
  await p.goto('http://localhost:3100/explorer?cam=170,70,235,0,0,0&q=medium');
  await p.waitForFunction(() => (window as any).__cellulaReady, null, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 4000));
  await p.getByRole('button', { name: 'Appareil de Golgi' }).first().click(); await new Promise((r) => setTimeout(r, 4000));
  await p.screenshot({ path: out + '/ui-hover.png' });
  await p.mouse.click(700, 400); await new Promise((r) => setTimeout(r, 3500));
  await p.screenshot({ path: out + '/ui-click.png' });
  await p.getByRole('button', { name: 'Mitochondrie' }).first().click(); await new Promise((r) => setTimeout(r, 4000));
  await p.screenshot({ path: out + '/ui-mito.png' });
  await b.close();
})();
