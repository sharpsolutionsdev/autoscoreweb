// Builds extra Flow ingredients on top of the base screenshots:
//   - UI region crops (hero band, feature band) per key page
//   - Device mockups (phone frame around screenshots)
//   - Mood board composites (palette + type + product per theme)
//
// Run: node scripts/capture-flow-extras.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT_CROPS    = path.join(ROOT, 'flow-ingredients', 'crops');
const OUT_MOCKUPS  = path.join(ROOT, 'flow-ingredients', 'mockups');
const OUT_MOOD     = path.join(ROOT, 'flow-ingredients', 'moodboards');

const KEY_PAGES = [
  'index.html',
  'web-app.html',
  'dartvoice-dashboard.html',
  'ranked.html',
  'rankings.html',
  'competitions.html',
  'how-it-works.html',
];

const MIME = {
  '.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon',
  '.json':'application/json',
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
    // 1. UI region crops via clip rectangles
    const ctxDesk = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2, colorScheme: 'dark',
    });
    const pageDesk = await ctxDesk.newPage();

    for (const p of KEY_PAGES) {
      const stem = p.replace('.html','');
      try {
        await pageDesk.goto(`${base}/${p}`, { waitUntil: 'networkidle', timeout: 20000 });
        await pageDesk.waitForTimeout(700);

        // Hero band: top 1080px
        await pageDesk.screenshot({
          path: path.join(OUT_CROPS, `${stem}__crop-hero.png`),
          clip: { x: 0, y: 0, width: 1920, height: 1080 },
        });

        // Hero center: 1200x800 centered around top-center
        await pageDesk.screenshot({
          path: path.join(OUT_CROPS, `${stem}__crop-hero-center.png`),
          clip: { x: 360, y: 80, width: 1200, height: 800 },
        });

        // Feature mid-band: y=1100-1900
        await pageDesk.screenshot({
          path: path.join(OUT_CROPS, `${stem}__crop-features.png`),
          clip: { x: 0, y: 1100, width: 1920, height: 800 },
        }).catch(()=>{}); // page may be shorter than 1900; ignore

        // Square 1:1 hero crop for IG
        await pageDesk.screenshot({
          path: path.join(OUT_CROPS, `${stem}__crop-square.png`),
          clip: { x: 460, y: 100, width: 1000, height: 1000 },
        });

        console.log(`[crop] ${p}`);
      } catch (e) {
        console.log(`[err]  ${p}  ${e.message}`);
      }
    }
    await ctxDesk.close();

    // 2. Device mockups (phone frame around mobile screenshots)
    const ctxComp = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 2, colorScheme: 'dark',
    });
    const pComp = await ctxComp.newPage();

    const mobileShots = [
      'index', 'web-app-mobile', 'dartvoice-dashboard',
      'ranked', 'rankings', 'competitions', 'how-it-works', 'login',
    ];
    for (const stem of mobileShots) {
      const shotUrl = `${base}/flow-ingredients/screenshots/${stem}__mobile__hero.png`;
      await pComp.setContent(deviceMockupHTML(shotUrl));
      await pComp.waitForLoadState('networkidle').catch(()=>{});
      await pComp.waitForTimeout(300);
      await pComp.screenshot({
        path: path.join(OUT_MOCKUPS, `${stem}__phone.png`),
        omitBackground: false,
      });
      console.log(`[mock] ${stem}`);
    }

    // Hero phone trio composite
    await pComp.setContent(phoneTrioHTML(base));
    await pComp.waitForLoadState('networkidle').catch(()=>{});
    await pComp.waitForTimeout(400);
    await pComp.screenshot({ path: path.join(OUT_MOCKUPS, 'hero-phone-trio.png') });
    console.log(`[mock] hero-phone-trio`);

    // Laptop mockup (desktop hero)
    await pComp.setContent(laptopMockupHTML(base, 'index'));
    await pComp.waitForLoadState('networkidle').catch(()=>{});
    await pComp.waitForTimeout(400);
    await pComp.screenshot({ path: path.join(OUT_MOCKUPS, 'index__laptop.png') });
    console.log(`[mock] laptop`);

    // 3. Mood boards (palette + type + product per theme)
    const themes = [
      { name: 'gameplay',  shot: 'web-app',                  eyebrow: 'Voice scoring',     headline: 'SAY IT.\nSCORE IT.' },
      { name: 'stats',     shot: 'dartvoice-dashboard',      eyebrow: 'Track everything',  headline: 'BETTER\nWITH DATA.' },
      { name: 'compete',   shot: 'ranked',                   eyebrow: 'Ranked play',       headline: 'CLIMB\nTHE BOARD.' },
      { name: 'events',    shot: 'competitions',             eyebrow: 'Compete',           headline: 'WIN\nPRIZES.' },
      { name: 'onboard',   shot: 'how-it-works',             eyebrow: 'How it works',      headline: 'THIRTY\nSECONDS.' },
      { name: 'brand',     shot: 'index',                    eyebrow: 'DartVoice',         headline: 'MADE FOR\nDARTS.' },
    ];
    for (const t of themes) {
      await pComp.setContent(moodBoardHTML(base, t));
      await pComp.waitForLoadState('networkidle').catch(()=>{});
      await pComp.waitForTimeout(400);
      await pComp.screenshot({ path: path.join(OUT_MOOD, `mood-${t.name}.png`) });
      console.log(`[mood] ${t.name}`);
    }

    await ctxComp.close();
  } finally {
    await browser.close();
    server.close();
  }
})();

function deviceMockupHTML(shotUrl) {
  return `<!doctype html><html><head><style>
  body{margin:0;background:#08080a;display:flex;align-items:center;justify-content:center;height:1200px;width:1600px;
       background:radial-gradient(900px 600px at 50% 40%, rgba(204,11,32,.18), transparent 65%), #08080a}
  .frame{
    position:relative;width:420px;height:912px;border-radius:54px;
    background:linear-gradient(180deg,#1a1a1f,#0a0a0e);
    box-shadow: 0 40px 120px rgba(0,0,0,.7), 0 0 0 2px #2a2a32, inset 0 0 0 8px #050507;
    padding:14px;overflow:hidden;
  }
  .notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:128px;height:34px;background:#000;border-radius:18px;z-index:2}
  .screen{width:100%;height:100%;border-radius:42px;overflow:hidden;background:#000}
  .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
  .glow{position:absolute;inset:-2px;border-radius:56px;box-shadow:0 0 60px rgba(204,11,32,.25);pointer-events:none}
  </style></head><body>
  <div class="frame"><div class="notch"></div><div class="screen"><img src="${shotUrl}"></div><div class="glow"></div></div>
  </body></html>`;
}

function phoneTrioHTML(base) {
  const phones = ['web-app-mobile','dartvoice-dashboard','ranked'];
  const phoneEl = (stem, rotate) => `
    <div class="frame" style="transform:rotate(${rotate}deg)">
      <div class="notch"></div>
      <div class="screen"><img src="${base}/flow-ingredients/screenshots/${stem}__mobile__hero.png"></div>
    </div>`;
  return `<!doctype html><html><head><style>
  body{margin:0;background:#08080a;display:flex;align-items:center;justify-content:center;gap:-40px;height:1200px;width:1600px;
       background:radial-gradient(900px 600px at 50% 50%, rgba(204,11,32,.22), transparent 65%), #08080a;perspective:2000px}
  .stage{display:flex;align-items:center;justify-content:center;gap:-60px;transform-style:preserve-3d}
  .frame{position:relative;width:340px;height:740px;border-radius:46px;background:linear-gradient(180deg,#1a1a1f,#0a0a0e);
         box-shadow:0 30px 100px rgba(0,0,0,.7),0 0 0 2px #2a2a32,inset 0 0 0 6px #050507;padding:10px;overflow:hidden;margin:0 -30px}
  .frame:nth-child(2){transform:translateY(-30px) scale(1.08);z-index:2;box-shadow:0 40px 120px rgba(204,11,32,.35),0 0 0 2px #2a2a32}
  .notch{position:absolute;top:10px;left:50%;transform:translateX(-50%);width:108px;height:28px;background:#000;border-radius:14px;z-index:2}
  .screen{width:100%;height:100%;border-radius:36px;overflow:hidden;background:#000}
  .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
  </style></head><body>
  <div class="stage">${phoneEl(phones[0],-8)}${phoneEl(phones[1],0)}${phoneEl(phones[2],8)}</div>
  </body></html>`;
}

function laptopMockupHTML(base, stem) {
  const shotUrl = `${base}/flow-ingredients/screenshots/${stem}__desktop__hero.png`;
  return `<!doctype html><html><head><style>
  body{margin:0;background:#08080a;display:flex;align-items:center;justify-content:center;height:1200px;width:1600px;
       background:radial-gradient(1200px 700px at 50% 40%, rgba(204,11,32,.18), transparent 65%), #08080a}
  .lap{width:1200px;background:#1a1a1f;border-radius:24px 24px 6px 6px;padding:24px 24px 20px;box-shadow:0 50px 140px rgba(0,0,0,.75),inset 0 0 0 1px #2a2a32}
  .bar{display:flex;gap:8px;margin-bottom:14px}
  .bar span{width:12px;height:12px;border-radius:50%;background:#2a2a32}
  .bar span:first-child{background:#cc0b20}
  .screen{width:100%;height:660px;border-radius:8px;overflow:hidden;background:#000;border:1px solid #2a2a32}
  .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
  .base{width:1320px;height:18px;background:linear-gradient(180deg,#2a2a32,#1a1a1f);border-radius:0 0 18px 18px;margin:-2px auto 0}
  </style></head><body>
  <div>
    <div class="lap"><div class="bar"><span></span><span></span><span></span></div><div class="screen"><img src="${shotUrl}"></div></div>
    <div class="base"></div>
  </div>
  </body></html>`;
}

function moodBoardHTML(base, t) {
  const shotUrl = `${base}/flow-ingredients/screenshots/${t.shot}__desktop__hero.png`;
  const mobileUrl = `${base}/flow-ingredients/screenshots/${t.shot === 'web-app' ? 'web-app-mobile' : t.shot}__mobile__hero.png`;
  return `<!doctype html><html><head>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Plus+Jakarta+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
  body{margin:0;background:#08080a;color:#f0f0f5;font-family:'Plus Jakarta Sans',sans-serif;width:1600px;height:1200px;padding:48px;box-sizing:border-box;
       background:radial-gradient(900px 600px at 80% 10%, rgba(204,11,32,.16), transparent 60%), #08080a}
  .grid{display:grid;grid-template-columns:1.4fr 1fr 0.6fr;grid-template-rows:auto 1fr 1fr;gap:24px;height:100%}
  .head{grid-column:1/-1;display:flex;justify-content:space-between;align-items:flex-end}
  .eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.22em;font-size:14px;color:#cc0b20;text-transform:uppercase}
  .title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-style:italic;font-size:96px;line-height:.92;letter-spacing:-.01em;white-space:pre-line;margin:6px 0 0}
  .meta{font-family:'Plus Jakarta Sans';color:#9E9EB0;font-size:13px;letter-spacing:.08em;text-align:right}
  .product{grid-row:2/4;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.06);box-shadow:0 30px 80px rgba(0,0,0,.55)}
  .product img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
  .phone{grid-column:2;grid-row:2/4;display:flex;align-items:center;justify-content:center}
  .phone .f{width:280px;height:600px;border-radius:38px;background:linear-gradient(180deg,#1a1a1f,#0a0a0e);box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 2px #2a2a32,inset 0 0 0 6px #050507;padding:8px;overflow:hidden;position:relative}
  .phone .n{position:absolute;top:10px;left:50%;transform:translateX(-50%);width:90px;height:22px;background:#000;border-radius:12px;z-index:2}
  .phone .s{width:100%;height:100%;border-radius:30px;overflow:hidden;background:#000}
  .phone img{width:100%;height:100%;object-fit:cover;object-position:top center}
  .stack{grid-column:3;grid-row:2/4;display:flex;flex-direction:column;gap:12px}
  .swatch{flex:1;border-radius:12px;display:flex;flex-direction:column;justify-content:flex-end;padding:14px;border:1px solid rgba(255,255,255,.06)}
  .swatch .n{font-family:'Barlow Condensed';font-weight:900;font-size:16px;letter-spacing:.04em}
  .swatch .h{font-family:'Plus Jakarta Sans';font-size:11px;opacity:.85;letter-spacing:.1em}
  </style></head><body>
  <div class="grid">
    <div class="head">
      <div><div class="eyebrow">${t.eyebrow}</div><div class="title">${t.headline}</div></div>
      <div class="meta">DARTVOICE / MOOD<br>${t.name.toUpperCase()}</div>
    </div>
    <div class="product"><img src="${shotUrl}"></div>
    <div class="phone"><div class="f"><div class="n"></div><div class="s"><img src="${mobileUrl}"></div></div></div>
    <div class="stack">
      <div class="swatch" style="background:#CC0B20;color:#fff"><div class="n">Brand</div><div class="h">#CC0B20</div></div>
      <div class="swatch" style="background:#08080A;color:#f0f0f5"><div class="n">Ink</div><div class="h">#08080A</div></div>
      <div class="swatch" style="background:#F0F0F5;color:#0a0a0a"><div class="n">Text</div><div class="h">#F0F0F5</div></div>
      <div class="swatch" style="background:#1A1A1F;color:#f0f0f5"><div class="n">Surface</div><div class="h">#1A1A1F</div></div>
    </div>
  </div>
  </body></html>`;
}
