// Renders the store images with headless Chrome:
//   store/screenshot-1-settings.png  (1280x800)
//   store/screenshot-2-popup.png     (1280x800)
//   store/screenshot-3-repo.png      (1280x800, the real example repo on GitHub)
//   store/promo-440x280.png
// The settings and popup shots use the real ui/ pages with a fake `chrome` API (stub.js).
// Run: CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node tools/screens/build.mjs
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../..', import.meta.url));
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = join(root, 'store');
const pages = join(root, 'dist', 'screens');
mkdirSync(out, { recursive: true });
mkdirSync(pages, { recursive: true });

// The real UI pages, with the stub loaded first and paths made absolute.
for (const name of ['options', 'popup']) {
  const html = readFileSync(join(root, 'ui', `${name}.html`), 'utf8')
    .replace('href="style.css"', 'href="/ui/style.css"')
    .replace(`src="${name}.js"`, `src="/ui/${name}.js"`)
    .replace('<script type="module"', '<script src="/tools/screens/stub.js"></script>\n<script type="module"');
  writeFileSync(join(pages, `${name}.html`), html);
}
for (const name of ['frame', 'promo']) writeFileSync(join(pages, `${name}.html`), readFileSync(join(root, 'tools', 'screens', `${name}.html`)));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.startsWith('/screens/')) path = `/dist${path}`;
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = mkdtempSync(join(tmpdir(), 'ac-commit-shots-'));

// Async, so this process can keep serving pages while Chrome loads them.
async function shot(url, file, [w, h], scheme = 'light') {
  await promisify(execFile)(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    '--virtual-time-budget=6000', `--blink-settings=preferredColorScheme=${scheme === 'dark' ? 0 : 1}`,
    `--screenshot=${join(out, file)}`, url,
  ], { timeout: 60000 });
  console.log(`store/${file}`);
}

try {
  await shot(`${base}/screens/options.html#checked`, 'screenshot-1-settings.png', [1280, 800]);
  await shot(`${base}/screens/frame.html`, 'screenshot-2-popup.png', [1280, 800]);
  // GitHub's page is captured tall, then cropped to the README by a page that offsets the image.
  await shot('https://github.com/moon-drakon/cp-solutions', '../dist/screens/repo-tall.png', [1280, 2200]);
  writeFileSync(join(pages, 'crop.html'), '<!doctype html><body style="margin:0;width:1280px;height:800px;background:#0d1117 url(/screens/repo-tall.png) 0 -465px no-repeat"></body>');
  await shot(`${base}/screens/crop.html`, 'screenshot-3-repo.png', [1280, 800]);
  await shot(`${base}/screens/promo.html`, 'promo-440x280.png', [440, 280]);
} finally {
  server.close();
}
