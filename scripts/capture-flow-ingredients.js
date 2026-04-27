// Captures screenshots of every customer-facing page at desktop + mobile
// viewports for use as Google Flow ingredient references.
//
// Run: node scripts/capture-flow-ingredients.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'flow-ingredients', 'screenshots');
const BRAND_OUT = path.join(ROOT, 'flow-ingredients', 'brand');

const PAGES = [
  'index.html',
  'how-it-works.html',
  'pricing.html',
  'guide.html',
  'login.html',
  'dartvoice-dashboard.html',
  'ranked.html',
  'rankings.html',
  'competitions.html',
  'competition.html',
  'referral.html',
  'thanks.html',
  'contact.html',
  'welcome.html',
  'web-app.html',
  'web-app-mobile.html',
  'checkout-cancelled.html',
  'terms.html',
  'privacy.html',
];

const VIEWPORTS = [
  { name: 'desktop', w: 1920, h: 1080 },
  { name: 'mobile',  w: 390,  h: 844  },
];

const MIME = {
  '.html':'text/html',  '.css':'text/css',  '.js':'application/javascript',
  '.png':'image/png',   '.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon',
  '.woff':'font/woff',  '.woff2':'font/woff2','.json':'application/json',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const fp = path.join(ROOT, urlPath);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.stat(fp, (err, stat) => {
        if (err || !stat.isFile()) { res.writeHead(404); return res.end(); }
        const ext = path.extname(fp).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

(async () => {
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  console.log(`[serve] ${base}`);

  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 2,
        colorScheme: 'dark',
      });
      const page = await ctx.newPage();
      for (const p of PAGES) {
        const url = `${base}/${p}`;
        const stem = p.replace('.html','');
        const aboveFold = path.join(OUT, `${stem}__${vp.name}__hero.png`);
        const fullPage  = path.join(OUT, `${stem}__${vp.name}__full.png`);
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
          // Let custom fonts + animations settle
          await page.waitForTimeout(800);
          await page.screenshot({ path: aboveFold, fullPage: false });
          await page.screenshot({ path: fullPage,  fullPage: true });
          console.log(`[ok]  ${vp.name}  ${p}`);
        } catch (e) {
          console.log(`[err] ${vp.name}  ${p}  ${e.message}`);
        }
      }
      await ctx.close();
    }

    // Brand palette swatch
    const palette = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    const pp = await palette.newPage();
    await pp.setContent(paletteHTML());
    await pp.waitForTimeout(300);
    await pp.screenshot({ path: path.join(BRAND_OUT, 'palette.png'), fullPage: false });

    // Typography specimen
    await pp.setContent(typeHTML());
    await pp.waitForTimeout(400);
    await pp.screenshot({ path: path.join(BRAND_OUT, 'typography.png'), fullPage: false });

    // Logo on dark + light cards
    await pp.setContent(logoHTML(base));
    await pp.waitForLoadState('networkidle');
    await pp.waitForTimeout(300);
    await pp.screenshot({ path: path.join(BRAND_OUT, 'logo-cards.png'), fullPage: false });

    await palette.close();
  } finally {
    await browser.close();
    server.close();
  }
})();

function paletteHTML() {
  const swatches = [
    ['Brand Red',   '#CC0B20', '#fff'],
    ['Brand Red 2', '#E60D24', '#fff'],
    ['Brand Light', '#FF3B47', '#0a0a0a'],
    ['Ink',         '#08080A', '#f0f0f5'],
    ['Surface',     '#0D0D10', '#f0f0f5'],
    ['Line',        '#1A1A1F', '#f0f0f5'],
    ['Text',        '#F0F0F5', '#0a0a0a'],
    ['Muted',       '#9E9EB0', '#0a0a0a'],
  ];
  return `<!doctype html><html><head><style>
  body{margin:0;background:#08080a;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#f0f0f5;padding:60px}
  h1{font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:900;font-size:64px;letter-spacing:-.01em;margin:0 0 8px}
  h1 em{color:#CC0B20;font-style:italic}
  p{color:#9E9EB0;margin:0 0 40px;letter-spacing:.06em}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
  .sw{aspect-ratio:1;border-radius:18px;padding:22px;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid rgba(255,255,255,.06);box-shadow:0 30px 80px rgba(0,0,0,.55)}
  .sw .n{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;letter-spacing:.04em}
  .sw .h{font-family:'Plus Jakarta Sans';font-size:13px;opacity:.85;letter-spacing:.1em}
  </style><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,900;1,900&family=Plus+Jakarta+Sans:wght@500;700&display=swap" rel="stylesheet"></head>
  <body><h1>DartVoice <em>Palette</em></h1><p>Brand color tokens — use as Flow reference</p>
  <div class="grid">${swatches.map(([n,h,fg])=>`<div class="sw" style="background:${h};color:${fg}"><div class="n">${n}</div><div class="h">${h}</div></div>`).join('')}</div>
  </body></html>`;
}

function typeHTML() {
  return `<!doctype html><html><head>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
  body{margin:0;background:#08080a;color:#f0f0f5;font-family:'Plus Jakarta Sans',sans-serif;padding:60px}
  .display{font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:900;font-size:140px;line-height:.95;letter-spacing:-.01em}
  .display em{color:#CC0B20;font-style:italic}
  .eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.22em;font-size:14px;color:#CC0B20;text-transform:uppercase;margin-bottom:20px}
  .body{font-size:20px;line-height:1.5;color:#c8c8d0;max-width:780px;margin-top:40px}
  .meta{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:40px;border-top:1px solid #1a1a1f;padding-top:30px}
  .meta h3{font-family:'Barlow Condensed',sans-serif;font-weight:900;letter-spacing:.05em;font-size:24px;margin:0 0 8px}
  .meta p{margin:0;color:#9E9EB0;font-size:14px}
  </style></head>
  <body>
  <div class="eyebrow">DartVoice / Typography</div>
  <div class="display">Say it.<br><em>Score it.</em></div>
  <p class="body">DartVoice automatically scores your darts games using voice recognition. Just call your scores — DartVoice handles the rest.</p>
  <div class="meta">
    <div><h3>BARLOW CONDENSED</h3><p>Display · 900 Italic · uppercase headlines, scoreboards, eyebrows</p></div>
    <div><h3>Plus Jakarta Sans</h3><p>Body · 400/500/700 · paragraphs, UI labels, microcopy</p></div>
  </div>
  </body></html>`;
}

function logoHTML(base) {
  return `<!doctype html><html><head><style>
  body{margin:0;background:#08080a;display:grid;grid-template-columns:1fr 1fr;height:100vh;font-family:system-ui}
  .card{display:flex;align-items:center;justify-content:center}
  .dark{background:#08080a}
  .light{background:#f5f5f7}
  img{max-width:60%;max-height:50%;object-fit:contain}
  </style></head><body>
  <div class="card dark"><img src="${base}/logo-transparent.png" alt="logo"></div>
  <div class="card light"><img src="${base}/logo-transparent.png" alt="logo"></div>
  </body></html>`;
}
