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
const js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>Jjak</title>
<meta name="theme-color" content="#f3ecdf">
<style>${css}</style>
<div id="app" aria-live="polite"></div>
<script type="module">${js}</script>
`;
mkdirSync('dist-demo', { recursive: true });
writeFileSync('dist-demo/jjak.html', html);
console.log(`dist-demo/jjak.html  ${(html.length / 1024 / 1024).toFixed(2)} MB`);
