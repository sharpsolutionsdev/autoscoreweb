// tools/dartcounter-dump.mjs
//
// Spawns a Chromium window via Playwright, navigates to the DartCounter web
// app, and saves every JS/CSS/HTML/JSON/source-map asset that the page (and
// its iframes) loads into tools/dartcounter-dump/. Optionally clicks through
// obvious routes to trigger lazy-loaded webpack chunks.
//
// Usage:
//   node tools/dartcounter-dump.mjs                      # default URL, headed
//   node tools/dartcounter-dump.mjs --headless           # background
//   node tools/dartcounter-dump.mjs --url=https://...    # override target
//   node tools/dartcounter-dump.mjs --idle=15000         # extra idle wait ms
//
// Output:
//   tools/dartcounter-dump/<host>/<path>      ← raw bytes per asset
//   tools/dartcounter-dump/manifest.json      ← url → file + headers + size
//
// Notes:
// • Read-only: we never POST or interact with auth surfaces.
// • Same-origin and cross-origin third-party scripts (gstatic, apple, etc.)
//   are all captured under their own host folder.
// • Re-running is safe: existing files are overwritten with the latest copy
//   and the manifest is rebuilt from scratch.

import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'dartcounter-dump');

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, '').split('=');
        return [k, v ?? true];
    })
);

const URL_TARGET = args.url || 'https://app.dartcounter.net/';
const HEADLESS = !!args.headless;
const IDLE_MS = Number(args.idle || 8000);

// MIME → extension fallback for filenames missing one.
const EXT_BY_MIME = {
    'application/javascript': '.js',
    'text/javascript': '.js',
    'text/css': '.css',
    'application/json': '.json',
    'text/html': '.html',
    'image/svg+xml': '.svg',
    'application/wasm': '.wasm',
    'font/woff2': '.woff2',
    'font/woff': '.woff',
};

// Only persist text-y / code-y resources by default. Skip media noise.
const KEEP_TYPES = new Set(['document', 'script', 'stylesheet', 'xhr', 'fetch', 'other']);
const KEEP_MIME_RX = /^(text\/|application\/(javascript|json|xml|wasm|x-javascript)|font\/)/;

function safePath(rawUrl) {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/[^a-z0-9.\-_]/gi, '_');
    let path = u.pathname.replace(/^\/+/, '') || 'index';
    // Strip query string but record a hash if present so distinct ?v= chunks
    // don't overwrite each other.
    if (u.search) {
        const tag = Buffer.from(u.search).toString('base64url').slice(0, 8);
        path = path.replace(/(\.[a-z0-9]+)?$/i, (m) => `__${tag}${m || ''}`);
    }
    if (path.endsWith('/')) path += 'index';
    return join(host, path);
}

function ensureExt(filePath, mime) {
    if (/\.[a-z0-9]{1,6}$/i.test(filePath)) return filePath;
    const ext = EXT_BY_MIME[(mime || '').split(';')[0].trim()] || '';
    return filePath + ext;
}

async function writeAsset(absPath, body) {
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, body);
}

const manifest = [];
const seen = new Set();

async function captureResponse(resp) {
    try {
        const url = resp.url();
        if (seen.has(url)) return;
        const req = resp.request();
        const type = req.resourceType();
        const ct = (resp.headers()['content-type'] || '').toLowerCase();
        if (!KEEP_TYPES.has(type) && !KEEP_MIME_RX.test(ct)) return;
        if (resp.status() >= 400) return;
        if (url.startsWith('data:') || url.startsWith('blob:')) return;
        let body;
        try { body = await resp.body(); }
        catch { return; } // some redirects / preflights have no body
        if (!body || !body.length) return;
        seen.add(url);
        const rel = ensureExt(safePath(url), ct);
        const abs = join(OUT_DIR, rel);
        await writeAsset(abs, body);
        manifest.push({
            url,
            file: rel.replace(/\\/g, '/'),
            type,
            mime: ct || null,
            status: resp.status(),
            bytes: body.length,
            from_iframe: resp.frame() !== null && resp.frame().parentFrame() !== null,
        });
        process.stdout.write(`· ${manifest.length.toString().padStart(4)}  ${body.length.toString().padStart(8)}B  ${url}\n`);
    } catch (e) {
        // Never let a single asset break the dump.
        console.warn('skip', resp.url(), String(e.message || e));
    }
}

async function nudgeRoutes(page) {
    // Click anything that looks like a navigation control to coax lazy chunks.
    const selectors = [
        'a[href]:not([href^="mailto:"]):not([href^="tel:"])',
        '[role="tab"]', '[role="menuitem"]', 'button',
    ];
    for (const sel of selectors) {
        const handles = await page.$$(sel);
        for (const h of handles.slice(0, 12)) { // cap to avoid runaway
            try {
                await h.scrollIntoViewIfNeeded({ timeout: 500 });
                await h.click({ trial: false, timeout: 800, force: true });
                await page.waitForTimeout(150);
            } catch { /* element gone or non-clickable */ }
        }
    }
}

(async () => {
    await mkdir(OUT_DIR, { recursive: true });
    const browser = await chromium.launch({ headless: HEADLESS });
    const ctx = await browser.newContext({
        // Mild UA spoof so the SPA doesn't serve a fallback / blocked page.
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 900 },
    });
    const page = await ctx.newPage();
    page.on('response', captureResponse);
    page.on('pageerror', (e) => console.warn('pageerror:', String(e.message || e)));

    console.log(`→ ${URL_TARGET}`);
    await page.goto(URL_TARGET, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    try { await page.waitForLoadState('networkidle', { timeout: IDLE_MS }); } catch {}

    console.log('· nudging routes to flush lazy chunks…');
    await nudgeRoutes(page).catch(() => {});
    try { await page.waitForLoadState('networkidle', { timeout: IDLE_MS }); } catch {}

    // Final settle.
    await page.waitForTimeout(2000);

    await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({
        captured_at: new Date().toISOString(),
        target: URL_TARGET,
        count: manifest.length,
        total_bytes: manifest.reduce((n, r) => n + r.bytes, 0),
        assets: manifest.sort((a, b) => a.url.localeCompare(b.url)),
    }, null, 2));

    console.log(`\n✓ saved ${manifest.length} assets → ${OUT_DIR}`);
    await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
