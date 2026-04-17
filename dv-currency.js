/* DartVoice currency widget — display-only FX.
   Stripe still bills GBP (toggle Adaptive Pricing in Stripe for local billing).
   Wrap any GBP amount in HTML like:
     <span class="dv-price" data-gbp="6.99"></span>
*/
(function () {
    'use strict';

    const CURRENCIES = [
        { code: 'GBP', symbol: '\u00A3',    flag: '\uD83C\uDDEC\uD83C\uDDE7', name: 'British Pound',     rate: 1.00,   dp: 2 },
        { code: 'USD', symbol: '$',         flag: '\uD83C\uDDFA\uD83C\uDDF8', name: 'US Dollar',         rate: 1.27,   dp: 2 },
        { code: 'EUR', symbol: '\u20AC',    flag: '\uD83C\uDDEA\uD83C\uDDFA', name: 'Euro',              rate: 1.17,   dp: 2 },
        { code: 'AUD', symbol: 'A$',        flag: '\uD83C\uDDE6\uD83C\uDDFA', name: 'Australian Dollar', rate: 1.95,   dp: 2 },
        { code: 'CAD', symbol: 'C$',        flag: '\uD83C\uDDE8\uD83C\uDDE6', name: 'Canadian Dollar',   rate: 1.74,   dp: 2 },
        { code: 'NZD', symbol: 'NZ$',       flag: '\uD83C\uDDF3\uD83C\uDDFF', name: 'NZ Dollar',         rate: 2.12,   dp: 2 },
        { code: 'CHF', symbol: 'CHF ',      flag: '\uD83C\uDDE8\uD83C\uDDED', name: 'Swiss Franc',       rate: 1.12,   dp: 2 },
        { code: 'SEK', symbol: 'kr ',       flag: '\uD83C\uDDF8\uD83C\uDDEA', name: 'Swedish Krona',     rate: 13.50,  dp: 0 },
        { code: 'NOK', symbol: 'kr ',       flag: '\uD83C\uDDF3\uD83C\uDDF4', name: 'Norwegian Krone',   rate: 13.50,  dp: 0 },
        { code: 'DKK', symbol: 'kr ',       flag: '\uD83C\uDDE9\uD83C\uDDF0', name: 'Danish Krone',      rate: 8.70,   dp: 0 },
        { code: 'PLN', symbol: 'z\u0142 ',  flag: '\uD83C\uDDF5\uD83C\uDDF1', name: 'Polish Zloty',      rate: 5.10,   dp: 2 },
        { code: 'CZK', symbol: 'K\u010D ',  flag: '\uD83C\uDDE8\uD83C\uDDFF', name: 'Czech Koruna',      rate: 29.0,   dp: 0 },
        { code: 'JPY', symbol: '\u00A5',    flag: '\uD83C\uDDEF\uD83C\uDDF5', name: 'Japanese Yen',      rate: 190,    dp: 0 },
        { code: 'INR', symbol: '\u20B9',    flag: '\uD83C\uDDEE\uD83C\uDDF3', name: 'Indian Rupee',      rate: 106,    dp: 0 },
        { code: 'ZAR', symbol: 'R ',        flag: '\uD83C\uDDFF\uD83C\uDDE6', name: 'S. African Rand',   rate: 23.0,   dp: 2 },
        { code: 'BRL', symbol: 'R$',        flag: '\uD83C\uDDE7\uD83C\uDDF7', name: 'Brazilian Real',    rate: 7.50,   dp: 2 },
        { code: 'MXN', symbol: 'Mex$',      flag: '\uD83C\uDDF2\uD83C\uDDFD', name: 'Mexican Peso',      rate: 25.0,   dp: 0 },
        { code: 'AED', symbol: 'AED ',      flag: '\uD83C\uDDE6\uD83C\uDDEA', name: 'UAE Dirham',        rate: 4.66,   dp: 2 },
        { code: 'SGD', symbol: 'S$',        flag: '\uD83C\uDDF8\uD83C\uDDEC', name: 'Singapore Dollar',  rate: 1.71,   dp: 2 },
        { code: 'HKD', symbol: 'HK$',       flag: '\uD83C\uDDED\uD83C\uDDF0', name: 'Hong Kong Dollar',  rate: 9.90,   dp: 2 },
    ];

    const COUNTRY_TO_CUR = {
        GB: 'GBP', UK: 'GBP', IE: 'EUR',
        US: 'USD', CA: 'CAD', MX: 'MXN',
        AU: 'AUD', NZ: 'NZD', SG: 'SGD', HK: 'HKD',
        DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', PT: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR',
        CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
        JP: 'JPY', IN: 'INR', ZA: 'ZAR', BR: 'BRL', AE: 'AED',
    };

    const LS_KEY = 'dv-currency';
    const API_CACHE_KEY = 'dv-currency-geo';
    const DEFAULT = 'GBP';

    function getByCode(code) {
        return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
    }

    function formatAmount(gbpAmount, cur) {
        const v = gbpAmount * cur.rate;
        if (cur.dp === 0) return cur.symbol + Math.round(v).toLocaleString();
        return cur.symbol + v.toFixed(cur.dp);
    }

    function renderPrices(code) {
        const cur = getByCode(code);
        document.querySelectorAll('.dv-price').forEach(el => {
            const g = parseFloat(el.getAttribute('data-gbp'));
            if (isNaN(g)) return;
            const dpOverride = el.getAttribute('data-decimals');
            const curEff = dpOverride !== null
                ? Object.assign({}, cur, { dp: parseInt(dpOverride, 10) })
                : cur;
            const suffix = el.getAttribute('data-suffix') || '';
            el.textContent = formatAmount(g, curEff) + suffix;
            el.setAttribute('data-current-currency', cur.code);
        });
        document.querySelectorAll('.dv-currency-badge-flag').forEach(el => el.textContent = cur.flag);
        document.querySelectorAll('.dv-currency-badge-code').forEach(el => el.textContent = cur.code);
    }

    function setCurrency(code, persist) {
        const cur = getByCode(code);
        if (persist !== false) localStorage.setItem(LS_KEY, cur.code);
        renderPrices(cur.code);
        document.dispatchEvent(new CustomEvent('dv-currency-changed', { detail: { code: cur.code } }));
    }

    async function autoDetect() {
        const cached = localStorage.getItem(API_CACHE_KEY);
        if (cached) {
            try { return JSON.parse(cached).currency; } catch (e) {}
        }
        try {
            const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
            if (!res.ok) return null;
            const data = await res.json();
            const country = (data && data.country_code) ? data.country_code.toUpperCase() : null;
            const direct = (data && data.currency) ? data.currency.toUpperCase() : null;
            let code = null;
            if (direct && CURRENCIES.some(c => c.code === direct)) code = direct;
            else if (country && COUNTRY_TO_CUR[country]) code = COUNTRY_TO_CUR[country];
            if (code) {
                localStorage.setItem(API_CACHE_KEY, JSON.stringify({ currency: code, ts: Date.now() }));
                return code;
            }
        } catch (e) { /* offline or blocked */ }
        return null;
    }

    function buildPicker(mountEl) {
        if (!mountEl || mountEl.dataset.dvCurrencyMounted) return;
        mountEl.dataset.dvCurrencyMounted = '1';
        mountEl.classList.add('dv-currency-picker');
        while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dv-currency-btn';
        btn.setAttribute('aria-label', 'Change currency');
        btn.setAttribute('aria-expanded', 'false');
        const flagSpan = document.createElement('span');
        flagSpan.className = 'dv-currency-badge-flag';
        flagSpan.textContent = '\uD83C\uDDEC\uD83C\uDDE7';
        const codeSpan = document.createElement('span');
        codeSpan.className = 'dv-currency-badge-code';
        codeSpan.textContent = 'GBP';
        const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        caret.setAttribute('width', '10'); caret.setAttribute('height', '10');
        caret.setAttribute('viewBox', '0 0 20 20'); caret.setAttribute('fill', 'currentColor');
        caret.setAttribute('aria-hidden', 'true');
        const caretPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        caretPath.setAttribute('d', 'M5 8l5 5 5-5z');
        caret.appendChild(caretPath);
        btn.appendChild(flagSpan); btn.appendChild(codeSpan); btn.appendChild(caret);

        const menu = document.createElement('div');
        menu.className = 'dv-currency-menu';
        menu.setAttribute('role', 'menu');
        CURRENCIES.forEach(c => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'dv-currency-item';
            item.setAttribute('role', 'menuitem');
            [
                ['dv-currency-item-flag', c.flag],
                ['dv-currency-item-code', c.code],
                ['dv-currency-item-sym', c.symbol.trim()],
                ['dv-currency-item-name', c.name],
            ].forEach(([cls, txt]) => {
                const s = document.createElement('span');
                s.className = cls; s.textContent = txt;
                item.appendChild(s);
            });
            item.addEventListener('click', () => {
                setCurrency(c.code, true);
                menu.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
            });
            menu.appendChild(item);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = menu.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', (e) => {
            if (!mountEl.contains(e.target)) { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
        });

        mountEl.appendChild(btn);
        mountEl.appendChild(menu);
    }

    function injectStyles() {
        if (document.getElementById('dv-currency-styles')) return;
        const s = document.createElement('style');
        s.id = 'dv-currency-styles';
        s.textContent = [
            '.dv-currency-picker { position: relative; display: inline-block; }',
            '.dv-currency-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #d4d4d8; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; cursor: pointer; transition: all .2s ease; }',
            '.dv-currency-btn:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(204,11,32,0.4); }',
            '.dv-currency-btn svg { opacity: 0.6; transition: transform .2s ease; }',
            '.dv-currency-btn[aria-expanded="true"] svg { transform: rotate(180deg); }',
            '.dv-currency-badge-flag { font-size: 14px; line-height: 1; }',
            '.dv-currency-menu { position: absolute; top: calc(100% + 8px); right: 0; min-width: 240px; max-height: 360px; overflow-y: auto; background: rgba(10,10,14,0.98); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,0.6); padding: 6px; z-index: 100; opacity: 0; transform: translateY(-6px) scale(0.98); pointer-events: none; transition: opacity .18s ease, transform .18s ease; }',
            '.dv-currency-menu.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }',
            '.dv-currency-item { width: 100%; display: grid; grid-template-columns: 24px 44px 40px 1fr; align-items: center; gap: 8px; background: transparent; border: none; color: #d4d4d8; cursor: pointer; padding: 8px 10px; border-radius: 8px; text-align: left; font-size: 12px; font-weight: 600; transition: background .15s ease, color .15s ease; }',
            '.dv-currency-item:hover { background: rgba(204,11,32,0.15); color: #fff; }',
            '.dv-currency-item-flag { font-size: 16px; }',
            '.dv-currency-item-code { font-weight: 800; letter-spacing: 0.05em; color: #fff; }',
            '.dv-currency-item-sym { color: var(--brand, #CC0B20); font-weight: 700; text-align: center; font-size: 11px; }',
            '.dv-currency-item-name { color: #9ca3af; font-weight: 500; font-size: 11px; }',
            '.dv-currency-menu::-webkit-scrollbar { width: 6px; }',
            '.dv-currency-menu::-webkit-scrollbar-thumb { background: #252530; border-radius: 6px; }',
        ].join('\n');
        document.head.appendChild(s);
    }

    async function init() {
        injectStyles();
        const stored = localStorage.getItem(LS_KEY);
        const initial = stored || DEFAULT;
        renderPrices(initial);

        document.querySelectorAll('[data-dv-currency-mount]').forEach(buildPicker);

        if (!stored) {
            const detected = await autoDetect();
            if (detected && detected !== initial) setCurrency(detected, true);
        }
    }

    window.DVCurrency = {
        list: CURRENCIES,
        set: (code) => setCurrency(code, true),
        get: () => localStorage.getItem(LS_KEY) || DEFAULT,
        refresh: () => renderPrices(localStorage.getItem(LS_KEY) || DEFAULT),
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
