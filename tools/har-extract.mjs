// tools/har-extract.mjs
// Extracts every captured asset from a HAR file into tools/dartcounter-dump/.
// Usage: node tools/har-extract.mjs <path-to.har>

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HAR = process.argv[2] || resolve(__dirname, '..', 'dartvoicenetworklogs.har');
const OUT = resolve(__dirname, 'dartcounter-dump');

const EXT_BY_MIME = {
    'application/javascript': '.js',
    'text/javascript': '.js',
    'application/x-javascript': '.js',
    'text/css': '.css',
    'application/json': '.json',
    'text/html': '.html',
    'image/svg+xml': '.svg',
    'application/wasm': '.wasm',
};

function safePath(rawUrl) {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/[^a-z0-9.\-_]/gi, '_');
    let p = u.pathname.replace(/^\/+/, '') || 'index';
    if (u.search) {
        const tag = Buffer.from(u.search).toString('base64url').slice(0, 8);
        p = p.replace(/(\.[a-z0-9]+)?$/i, (m) => `__${tag}${m || ''}`);
    }
    if (p.endsWith('/')) p += 'index';
    return join(host, p);
}

const har = JSON.parse(await readFile(HAR, 'utf8'));
const entries = har.log.entries;
console.log(`HAR: ${entries.length} entries`);

const manifest = [];
let kept = 0, skipped = 0;
for (const e of entries) {
    const url = e.request.url;
    const mime = (e.response.content.mimeType || '').split(';')[0].trim();
    const text = e.response.content.text;
    if (!text) { skipped++; continue; }
    const buf = e.response.content.encoding === 'base64'
        ? Buffer.from(text, 'base64')
        : Buffer.from(text, 'utf8');
    let rel = safePath(url);
    if (!/\.[a-z0-9]{1,6}$/i.test(rel)) rel += (EXT_BY_MIME[mime] || '');
    const abs = join(OUT, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    manifest.push({ url, file: rel.replace(/\\/g, '/'), mime, status: e.response.status, bytes: buf.length });
    kept++;
}
manifest.sort((a, b) => a.url.localeCompare(b.url));
await writeFile(join(OUT, 'manifest.json'), JSON.stringify({
    source_har: HAR,
    extracted_at: new Date().toISOString(),
    count: kept,
    skipped_no_body: skipped,
    total_bytes: manifest.reduce((n, r) => n + r.bytes, 0),
    assets: manifest,
}, null, 2));
console.log(`✓ wrote ${kept} files (${skipped} had no body) → ${OUT}`);
