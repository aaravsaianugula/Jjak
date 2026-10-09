#!/usr/bin/env node
/**
 * Build a single, self-contained HTML file of the web build (fonts, CSS and JS
 * inlined) for sharing a playable demo. Output: dist-demo/jjak.html
 *   node scripts/build-demo.mjs
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist-demo/tmp';
await build({
  logLevel: 'warn',
  build: { outDir: out, emptyOutDir: true, assetsInlineLimit: 0, rollupOptions: { output: { codeSplitting: false } } },
});
const assets = join(out, 'assets');
const files = readdirSync(assets);
let css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');
css = css.replace(/url\(\.\/([^)]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(join(assets, f)).toString('base64')})`);
// The entry is whichever script index.html loads; other .js files are workers.
const entry = readFileSync(join(out, 'index.html'), 'utf8').match(/src="\.\/assets\/([^"]+\.js)"/)[1];
let js = readFileSync(join(assets, entry), 'utf8');
// Workers ride along as blob URLs. If a host refuses blob workers, the endless road falls back to the main thread.
for (const f of files.filter((f) => f.endsWith('.js') && f !== entry)) {
  const code = readFileSync(join(assets, f), 'utf8');
  const ref = new RegExp(`new URL\\(new URL\\(\`${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`,import\\.meta\\.url\\)\\.href,\`\`\\+import\\.meta\\.url\\)|new URL\\(\`[^\`]*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`,import\\.meta\\.url\\)`, 'g');
  const before = js;
  js = js.replace(ref, () => `URL.createObjectURL(new Blob([${JSON.stringify(code)}],{type:'text/javascript'}))`);
  if (js === before) throw new Error(`build-demo: no reference to ${f} found in ${entry}`);
}
js = js.replace(/<\/script/gi, '<\\/script');
const html = `<meta charset="utf-8">
<title>Jjak</title>
<meta name="theme-color" content="#f3ecdf">
<style>${css}</style>
<div id="app" aria-live="polite"></div>
<script type="module">${js}</script>
`;
mkdirSync('dist-demo', { recursive: true });
writeFileSync('dist-demo/jjak.html', html);
console.log(`dist-demo/jjak.html  ${(html.length / 1024 / 1024).toFixed(2)} MB`);
