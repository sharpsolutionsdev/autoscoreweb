/* DartVoice discount system
   - Fixed 10-day 20% off promo (ends 2026-04-28 23:59:59 UTC)
   - Wraps every .dv-price with a slashed original + discounted new price
   - Mounts a live countdown banner at the top of every page
   - Exposes window.DV.discount for programmatic use
   - Cooperates with dv-currency.js via `dv-currency-changed` event
   To disable: set DV_PROMO.active = false or push end date into the past.
*/
(function () {
  'use strict';

  var PROMO = {
    active: true,
    pct: 20,
    endsAt: Date.UTC(2026, 3, 28, 23, 59, 59), // month is 0-indexed → April
    couponId: 'DARTVOICE20', // Stripe coupon/promotion_code id
    label: 'LAUNCH SALE',
    subLabel: '20% OFF ALL PLANS'
  };

  function isLive() {
    return PROMO.active && Date.now() < PROMO.endsAt;
  }

  // ───────────────────────── price slashing ─────────────────────────

  var STYLE_ID = 'dv-discount-style';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.dv-price-wrap{display:inline-flex;align-items:baseline;gap:.4em;flex-wrap:wrap}',
      '.dv-price-wrap .dv-price{color:#6E6E82;text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:rgba(204,11,32,.7);opacity:.75;font-weight:600}',
      '.dv-price-wrap .dv-price-new{color:inherit;font-weight:inherit;font-size:inherit;font-family:inherit}',
      '.dv-price-wrap .dv-price-badge{display:inline-flex;align-items:center;gap:.3em;padding:.18em .5em;border-radius:6px;background:rgba(var(--brand-rgb,204,11,32),.15);border:1px solid rgba(var(--brand-rgb,204,11,32),.4);color:var(--brand-light,#e60d24);font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:.55em;font-weight:800;letter-spacing:.04em;line-height:1;text-transform:uppercase;text-decoration:none;vertical-align:middle}',
      /* countdown banner — fixed at very top, pushes fixed nav down via body padding */
      '#dv-promo-bar{position:fixed;top:0;left:0;right:0;z-index:70;background:linear-gradient(90deg,#cc0b20 0%,#e60d24 50%,#cc0b20 100%);background-size:200% 100%;animation:dvPromoSheen 6s linear infinite;color:#fff;font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:.03em;text-align:center;box-shadow:0 2px 18px rgba(204,11,32,.35);transition:transform .3s ease, opacity .3s ease}',
      'body.dv-has-promo nav.fixed{top:var(--dv-promo-h,36px)!important}',
      'body.dv-has-promo{padding-top:var(--dv-promo-h,36px)}',
      '@keyframes dvPromoSheen{0%{background-position:0 0}100%{background-position:200% 0}}',
      '#dv-promo-bar .dv-promo-inner{display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 40px 8px 16px;flex-wrap:wrap;position:relative}',
      '#dv-promo-bar .dv-promo-badge{background:rgba(0,0,0,.25);padding:2px 8px;border-radius:999px;font-size:10px;letter-spacing:.08em;text-transform:uppercase}',
      '#dv-promo-bar .dv-promo-text{font-weight:800;font-size:13px}',
      '#dv-promo-bar .dv-promo-countdown{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;background:rgba(0,0,0,.28);padding:2px 10px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:.06em}',
      '#dv-promo-bar .dv-promo-countdown b{color:#fff;font-weight:900;min-width:2ch;display:inline-block;text-align:center}',
      '#dv-promo-bar .dv-promo-close{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:6px;background:rgba(0,0,0,.2);border:0;color:#fff;cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;opacity:.7;transition:opacity .15s}',
      '#dv-promo-bar .dv-promo-close:hover{opacity:1;background:rgba(0,0,0,.35)}',
      '#dv-promo-bar.dv-hidden{transform:translateY(-100%);opacity:0;pointer-events:none}',
      '@media (max-width:500px){#dv-promo-bar .dv-promo-inner{padding:7px 36px 7px 10px;gap:6px}#dv-promo-bar .dv-promo-text{font-size:11px}#dv-promo-bar .dv-promo-countdown{font-size:11px;padding:2px 7px}#dv-promo-bar .dv-promo-badge{font-size:9px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // Format an amount in the currently-selected currency by reusing the
  // currency widget if present; else fall back to GBP.
  function formatCurrent(gbpAmount, decimalsOverride) {
    try {
      if (window.DV && window.DV.currency && typeof window.DV.currency.format === 'function') {
        return window.DV.currency.format(gbpAmount, decimalsOverride);
      }
    } catch (e) {}
    var dp = (typeof decimalsOverride === 'number') ? decimalsOverride : 2;
    return '£' + gbpAmount.toFixed(dp);
  }

  function enhancePrices() {
    if (!isLive()) return;
    var nodes = document.querySelectorAll('.dv-price:not([data-discount-processed])');
    nodes.forEach(function (el) {
      // Skip if already inside a wrap (safety)
      if (el.parentNode && el.parentNode.classList && el.parentNode.classList.contains('dv-price-wrap')) {
        el.setAttribute('data-discount-processed', '1');
        return;
      }
      var gbp = parseFloat(el.getAttribute('data-gbp'));
      if (isNaN(gbp)) return;
      var decAttr = el.getAttribute('data-decimals');
      var decimals = decAttr !== null ? parseInt(decAttr, 10) : null;
      var suffix = el.getAttribute('data-suffix') || '';
      var discounted = gbp * (1 - PROMO.pct / 100);

      var wrap = document.createElement('span');
      wrap.className = 'dv-price-wrap';
      var newSpan = document.createElement('span');
      newSpan.className = 'dv-price-new';
      newSpan.setAttribute('data-dv-new-for', gbp.toFixed(4));
      if (decAttr !== null) newSpan.setAttribute('data-decimals', decAttr);
      if (suffix) newSpan.setAttribute('data-suffix', suffix);
      newSpan.setAttribute('data-dv-gbp-new', discounted.toFixed(4));

      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      wrap.appendChild(newSpan);
      el.setAttribute('data-discount-processed', '1');
      renderNewSpan(newSpan);
    });
  }

  function renderNewSpan(newSpan) {
    var gbp = parseFloat(newSpan.getAttribute('data-dv-gbp-new'));
    if (isNaN(gbp)) return;
    var decAttr = newSpan.getAttribute('data-decimals');
    var decimals = decAttr !== null ? parseInt(decAttr, 10) : null;
    var suffix = newSpan.getAttribute('data-suffix') || '';
    newSpan.textContent = formatCurrent(gbp, decimals === null ? undefined : decimals) + suffix;
  }

  function rerenderAllNewSpans() {
    document.querySelectorAll('.dv-price-new').forEach(renderNewSpan);
  }

  // ───────────────────────── countdown banner ─────────────────────────

  var DISMISS_KEY = 'dv-promo-dismissed';
  var BANNER_SKIP = ['/web-app', '/web-app-mobile', '/apk-gate'];
  function mountBanner() {
    if (!isLive()) return;
    if (document.getElementById('dv-promo-bar')) return;
    try { if (sessionStorage.getItem(DISMISS_KEY) === '1') return; } catch (e) {}
    var p = (window.location.pathname || '').toLowerCase();
    for (var i = 0; i < BANNER_SKIP.length; i++) {
      if (p === BANNER_SKIP[i] || p === BANNER_SKIP[i] + '/' || p === BANNER_SKIP[i] + '.html') return;
    }

    var bar = document.createElement('div');
    bar.id = 'dv-promo-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-label', 'Limited-time discount');

    var inner = document.createElement('div');
    inner.className = 'dv-promo-inner';

    var badge = document.createElement('span');
    badge.className = 'dv-promo-badge';
    badge.textContent = PROMO.label;
    inner.appendChild(badge);

    var text = document.createElement('span');
    text.className = 'dv-promo-text';
    text.textContent = PROMO.subLabel;
    inner.appendChild(text);

    var sep = document.createElement('span');
    sep.textContent = '•';
    sep.style.opacity = '.5';
    inner.appendChild(sep);

    var cd = document.createElement('span');
    cd.className = 'dv-promo-countdown';
    cd.setAttribute('aria-live', 'polite');
    var lead = document.createElement('span'); lead.textContent = 'ENDS IN ';
    var dEl = document.createElement('b'); dEl.id = 'dv-cd-d';
    var dLab = document.createElement('span'); dLab.textContent = 'd ';
    var hEl = document.createElement('b'); hEl.id = 'dv-cd-h';
    var hLab = document.createElement('span'); hLab.textContent = 'h ';
    var mEl = document.createElement('b'); mEl.id = 'dv-cd-m';
    var mLab = document.createElement('span'); mLab.textContent = 'm ';
    var sEl = document.createElement('b'); sEl.id = 'dv-cd-s';
    var sLab = document.createElement('span'); sLab.textContent = 's';
    cd.appendChild(lead); cd.appendChild(dEl); cd.appendChild(dLab);
    cd.appendChild(hEl); cd.appendChild(hLab);
    cd.appendChild(mEl); cd.appendChild(mLab);
    cd.appendChild(sEl); cd.appendChild(sLab);
    inner.appendChild(cd);

    var close = document.createElement('button');
    close.className = 'dv-promo-close';
    close.setAttribute('aria-label', 'Dismiss discount banner');
    close.textContent = '×';
    close.addEventListener('click', function () {
      bar.classList.add('dv-hidden');
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
      setTimeout(function () {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
        document.body.classList.remove('dv-has-promo');
        document.documentElement.style.removeProperty('--dv-promo-h');
      }, 400);
    });
    inner.appendChild(close);

    bar.appendChild(inner);

    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('dv-has-promo');
    // Measure actual banner height and expose via CSS var so fixed navs
    // shift down by the right amount on every viewport width.
    requestAnimationFrame(function () {
      var h = bar.offsetHeight || 36;
      document.documentElement.style.setProperty('--dv-promo-h', h + 'px');
    });
    var ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(function () {
      var h = bar.offsetHeight || 36;
      document.documentElement.style.setProperty('--dv-promo-h', h + 'px');
    }) : null;
    if (ro) ro.observe(bar);

    tickCountdown();
    setInterval(tickCountdown, 1000);
  }

  function tickCountdown() {
    var diff = PROMO.endsAt - Date.now();
    if (diff <= 0) {
      var bar = document.getElementById('dv-promo-bar');
      if (bar) bar.classList.add('dv-hidden');
      return;
    }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    setNum('dv-cd-d', d);
    setNum('dv-cd-h', pad2(h));
    setNum('dv-cd-m', pad2(m));
    setNum('dv-cd-s', pad2(s));
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function setNum(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  // ───────────────────────── wiring ─────────────────────────

  function boot() {
    injectStyles();
    if (!isLive()) return;
    enhancePrices();
    mountBanner();
    // Currency change: new-price spans need re-render. dv-currency.js only
    // re-renders .dv-price; our .dv-price-new spans are invisible to it.
    document.addEventListener('dv-currency-changed', rerenderAllNewSpans);
    // Re-scan when pages dynamically inject prices (e.g., dashboard)
    var mo = new MutationObserver(function (muts) {
      var added = false;
      for (var i = 0; i < muts.length; i++) {
        for (var j = 0; j < muts[i].addedNodes.length; j++) {
          var n = muts[i].addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('dv-price') && !n.hasAttribute('data-discount-processed')) { added = true; break; }
          if (n.querySelector && n.querySelector('.dv-price:not([data-discount-processed])')) { added = true; break; }
        }
        if (added) break;
      }
      if (added) enhancePrices();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  // Expose
  window.DV = window.DV || {};
  window.DV.discount = {
    get active() { return isLive(); },
    pct: PROMO.pct,
    endsAt: PROMO.endsAt,
    couponId: PROMO.couponId,
    refresh: function () { enhancePrices(); rerenderAllNewSpans(); },
    /**
     * Append `prefilled_promo_code=DARTVOICE20` to a Stripe Payment Link
     * URL when the promo is live. Idempotent — won't double-add.
     * Use for any `https://buy.stripe.com/...` checkout link in the app.
     */
    applyToCheckoutUrl: function (url) {
      if (!url || !isLive()) return url;
      try {
        var u = new URL(url, window.location.origin);
        if (!u.searchParams.has('prefilled_promo_code')) {
          u.searchParams.set('prefilled_promo_code', PROMO.couponId);
        }
        return u.toString();
      } catch (e) {
        // Fallback for malformed URLs: append manually.
        if (url.indexOf('prefilled_promo_code=') !== -1) return url;
        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'prefilled_promo_code=' + encodeURIComponent(PROMO.couponId);
      }
    }
  };
})();
