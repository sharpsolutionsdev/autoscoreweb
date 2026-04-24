/* DartVoice first-launch welcome popup
   Fires on a user's very first visit (tracked in localStorage). Shows:
   - Web app demo CTA (no account needed)
   - 20% off limited-time mention with live countdown
   - Referral earning teaser
   Self-contained; only depends on being loaded after <body>.
   Skips if: already shown, or on app/account/transactional pages.
*/
(function () {
  'use strict';

  var SEEN_KEY = 'dv-welcome-seen';
  var DELAY_MS = 1200;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var path = (window.location.pathname || '').toLowerCase();
  var skipPaths = ['/web-app', '/web-app-mobile', '/login', '/dartvoice-dashboard', '/admin', '/creator-portal', '/apk-gate', '/welcome', '/thanks', '/checkout-cancelled'];
  for (var i = 0; i < skipPaths.length; i++) {
    if (path === skipPaths[i] || path === skipPaths[i] + '/' || path === skipPaths[i] + '.html') return;
  }

  try { if (localStorage.getItem(SEEN_KEY) === '1') return; } catch (e) {}

  function formatDiscount() {
    var promoEndsAt = (window.DV && window.DV.discount && window.DV.discount.endsAt) || 0;
    if (!promoEndsAt) return null;
    var diff = promoEndsAt - Date.now();
    if (diff <= 0) return null;
    return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000) };
  }

  function svg(paths, viewBox, strokeWidth) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('width', '16'); s.setAttribute('height', '16');
    s.setAttribute('viewBox', viewBox || '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', strokeWidth || '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    paths.forEach(function (p) {
      var el = document.createElementNS(SVG_NS, p.tag);
      Object.keys(p.attrs).forEach(function (k) { el.setAttribute(k, p.attrs[k]); });
      s.appendChild(el);
    });
    return s;
  }

  var ICONS = {
    mic: function () {
      return svg([
        { tag: 'path', attrs: { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z' } },
        { tag: 'path', attrs: { d: 'M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8' } }
      ]);
    },
    people: function () {
      return svg([
        { tag: 'circle', attrs: { cx: '12', cy: '8', r: '4' } },
        { tag: 'path', attrs: { d: 'M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2' } }
      ]);
    },
    star: function () {
      return svg([
        { tag: 'path', attrs: { d: 'M12 2l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1.5z' } }
      ], '0 0 24 24', '2.2');
    }
  };

  function mount() {
    if (document.getElementById('dv-welcome')) return;

    var style = document.createElement('style');
    style.textContent = [
      '#dv-welcome-backdrop{position:fixed;inset:0;z-index:100;background:rgba(4,4,8,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;transition:opacity .4s ease;display:flex;align-items:center;justify-content:center;padding:20px}',
      '#dv-welcome-backdrop.show{opacity:1}',
      '#dv-welcome{position:relative;width:100%;max-width:460px;background:linear-gradient(180deg,#16161B 0%,#0C0C10 100%);border:1px solid rgba(var(--brand-rgb,204,11,32),.3);border-radius:24px;padding:28px 26px 24px;transform:scale(.92) translateY(30px);opacity:0;transition:transform .55s cubic-bezier(.22,1.2,.36,1),opacity .35s ease;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(var(--brand-rgb,204,11,32),.18);font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#F0F0F5}',
      '#dv-welcome-backdrop.show #dv-welcome{transform:scale(1) translateY(0);opacity:1}',
      '#dv-welcome .dv-w-glow{position:absolute;inset:-2px;border-radius:24px;pointer-events:none;background:radial-gradient(60% 40% at 50% 0%,rgba(var(--brand-rgb,204,11,32),.35) 0%,transparent 70%);opacity:.9;animation:dvWGlow 3.5s ease-in-out infinite}',
      '@keyframes dvWGlow{0%,100%{opacity:.6}50%{opacity:1}}',
      '#dv-welcome .dv-w-close{position:absolute;top:12px;right:14px;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#9A9AAE;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;transition:all .15s ease}',
      '#dv-welcome .dv-w-close:hover{background:rgba(255,255,255,.09);color:#fff}',
      '#dv-welcome .dv-w-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:rgba(var(--brand-rgb,204,11,32),.15);border:1px solid rgba(var(--brand-rgb,204,11,32),.4);color:var(--brand-light,#e60d24);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px}',
      '#dv-welcome .dv-w-dot{width:6px;height:6px;border-radius:999px;background:#cc0b20;box-shadow:0 0 8px rgba(204,11,32,.8);animation:dvWDot 1.4s ease-in-out infinite}',
      '@keyframes dvWDot{0%,100%{opacity:1}50%{opacity:.4}}',
      '#dv-welcome h2{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:30px;line-height:1.02;text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px;color:#fff}',
      '#dv-welcome h2 em{color:var(--brand-light,#e60d24);font-style:normal}',
      '#dv-welcome .dv-w-lede{font-size:13.5px;line-height:1.55;color:#C8C8D4;margin-bottom:18px}',
      '#dv-welcome .dv-w-lede b{color:#fff}',
      '#dv-welcome .dv-w-features{display:grid;gap:10px;margin-bottom:20px}',
      '#dv-welcome .dv-w-feat{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)}',
      '#dv-welcome .dv-w-feat-ico{flex-shrink:0;width:30px;height:30px;border-radius:8px;background:rgba(var(--brand-rgb,204,11,32),.15);display:flex;align-items:center;justify-content:center;color:var(--brand-light,#e60d24)}',
      '#dv-welcome .dv-w-feat-text{flex:1;font-size:12.5px;line-height:1.45;color:#C8C8D4}',
      '#dv-welcome .dv-w-feat-text b{color:#fff;display:block;font-size:13px;margin-bottom:2px}',
      '#dv-welcome .dv-w-cta{display:flex;flex-direction:column;gap:8px}',
      '#dv-welcome .dv-w-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 18px;border-radius:12px;font-size:13.5px;font-weight:800;letter-spacing:.02em;text-decoration:none;transition:all .2s ease;cursor:pointer;border:0}',
      '#dv-welcome .dv-w-btn-primary{background:linear-gradient(180deg,#e60d24 0%,#cc0b20 100%);color:#fff;box-shadow:0 4px 18px rgba(204,11,32,.4)}',
      '#dv-welcome .dv-w-btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(204,11,32,.55)}',
      '#dv-welcome .dv-w-btn-ghost{background:rgba(255,255,255,.04);color:#C8C8D4;border:1px solid rgba(255,255,255,.1)}',
      '#dv-welcome .dv-w-btn-ghost:hover{background:rgba(255,255,255,.08);color:#fff}',
      '#dv-welcome .dv-w-fine{text-align:center;font-size:10.5px;color:#6E6E82;margin-top:12px}',
      '#dv-welcome .dv-w-fine b{color:var(--brand-light,#e60d24);font-weight:700}',
      '@media (max-width:480px){#dv-welcome{padding:22px 20px 18px}#dv-welcome h2{font-size:26px}}'
    ].join('\n');
    document.head.appendChild(style);

    var back = document.createElement('div');
    back.id = 'dv-welcome-backdrop';

    var modal = document.createElement('div');
    modal.id = 'dv-welcome';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Welcome to DartVoice');

    var glow = document.createElement('div'); glow.className = 'dv-w-glow'; modal.appendChild(glow);

    var close = document.createElement('button'); close.className = 'dv-w-close'; close.setAttribute('aria-label', 'Close'); close.textContent = '×';
    modal.appendChild(close);

    var promo = formatDiscount();

    if (promo) {
      var badge = document.createElement('div'); badge.className = 'dv-w-badge';
      var dot = document.createElement('span'); dot.className = 'dv-w-dot'; badge.appendChild(dot);
      var bt = document.createElement('span'); bt.textContent = 'Launch Sale — 20% off all plans'; badge.appendChild(bt);
      modal.appendChild(badge);
    }

    var h2 = document.createElement('h2');
    h2.appendChild(document.createTextNode('Score darts with your '));
    var em = document.createElement('em'); em.textContent = 'voice.'; h2.appendChild(em);
    modal.appendChild(h2);

    var lede = document.createElement('p'); lede.className = 'dv-w-lede';
    lede.appendChild(document.createTextNode('No more typing scores between visits. Just call them out — '));
    var b1 = document.createElement('b'); b1.textContent = 'DartVoice adds them up, tracks your checkout, and submits for you.'; lede.appendChild(b1);
    lede.appendChild(document.createTextNode(' Works with any Dart Counter game (501, Cricket, X01).'));
    modal.appendChild(lede);

    var features = [];
    if (promo) {
      features.push({
        ico: ICONS.star,
        title: '20% off all plans — ' + promo.days + 'd ' + promo.hours + 'h left',
        body: 'Locked-in forever while the timer runs. £6.99/mo → £5.59/mo.'
      });
    }
    features.push({
      ico: ICONS.mic,
      title: 'Try it free — no signup',
      body: 'Open the 10-minute web demo, grant mic access, start calling scores.'
    });
    features.push({
      ico: ICONS.people,
      title: 'Refer friends, earn real cash',
      body: '£5 per conversion · 30-day free trial for everyone you bring in.'
    });

    var featWrap = document.createElement('div'); featWrap.className = 'dv-w-features';
    features.forEach(function (f) {
      var row = document.createElement('div'); row.className = 'dv-w-feat';
      var ico = document.createElement('div'); ico.className = 'dv-w-feat-ico';
      ico.appendChild(f.ico());
      row.appendChild(ico);
      var txt = document.createElement('div'); txt.className = 'dv-w-feat-text';
      var tb = document.createElement('b'); tb.textContent = f.title; txt.appendChild(tb);
      txt.appendChild(document.createTextNode(f.body));
      row.appendChild(txt);
      featWrap.appendChild(row);
    });
    modal.appendChild(featWrap);

    var cta = document.createElement('div'); cta.className = 'dv-w-cta';
    var btnPrimary = document.createElement('a'); btnPrimary.className = 'dv-w-btn dv-w-btn-primary';
    btnPrimary.href = '/web-app'; btnPrimary.textContent = 'Try the free demo →';
    cta.appendChild(btnPrimary);
    var btnGhost = document.createElement('a'); btnGhost.className = 'dv-w-btn dv-w-btn-ghost';
    btnGhost.href = '/#pricing'; btnGhost.textContent = 'See plans';
    cta.appendChild(btnGhost);
    modal.appendChild(cta);

    var fine = document.createElement('p'); fine.className = 'dv-w-fine';
    if (promo) {
      fine.appendChild(document.createTextNode('7-day free trial · Cancel anytime · '));
      var fb = document.createElement('b'); fb.textContent = '20% off locked in during sale'; fine.appendChild(fb);
    } else {
      fine.appendChild(document.createTextNode('7-day free trial · No card needed for demo · Cancel anytime'));
    }
    modal.appendChild(fine);

    back.appendChild(modal);

    function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {} }
    function dismiss() {
      markSeen();
      back.classList.remove('show');
      setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 450);
    }
    close.addEventListener('click', dismiss);
    back.addEventListener('click', function (e) { if (e.target === back) dismiss(); });
    btnPrimary.addEventListener('click', markSeen);
    btnGhost.addEventListener('click', markSeen);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', onEsc); }
    });

    document.body.appendChild(back);
    requestAnimationFrame(function () { back.classList.add('show'); });
  }

  function boot() { setTimeout(mount, DELAY_MS); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  window.DV = window.DV || {};
  window.DV.welcome = {
    show: mount,
    reset: function () { try { localStorage.removeItem(SEEN_KEY); } catch (e) {} }
  };
})();
