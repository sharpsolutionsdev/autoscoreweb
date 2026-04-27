/**
 * dv-toast.js — Site-wide toast notifications.
 *
 * Drop-in: <script defer src="/dv-toast.js"></script>
 *
 * Exports a single global: window.dvToast(msg, kind?, duration?, onClick?)
 *   - kind:     'success' | 'warn' | 'info' (default: neutral)
 *   - duration: ms before auto-dismiss (default 2200, min 800)
 *   - onClick:  optional callback; toast becomes clickable and dismisses on click
 *
 * Behaviour notes:
 * - Idempotent: re-loading the script does NOT clobber an existing dvToast
 *   if web-app.html (or any other page) has already defined one. This keeps
 *   the in-app toast (which has tight bindings to keyboard shortcuts) intact
 *   while still giving plain marketing pages access to the same API.
 * - Self-injects its host node and CSS on first call; safe to call from any
 *   point in the page lifecycle (before DOMContentLoaded too).
 * - Polite to ARIA: host has role="status" aria-live="polite" so screen
 *   readers announce confirmations.
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;
    if (typeof window.dvToast === 'function') return; // respect existing defs

    var STYLE_ID = 'dv-toast-style';
    var HOST_ID = 'dv-toast-host';

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = [
            '#' + HOST_ID + ' { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 100000; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: calc(100vw - 32px); }',
            '.dv-toast { background: rgba(17,17,20,0.95); color: #fff; border: 1px solid #252530; border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 600; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: 0 8px 32px rgba(0,0,0,.5); pointer-events: auto; font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif; max-width: 92vw; text-align: center; animation: dvToastIn .25s ease both; }',
            '.dv-toast.dv-toast-out { animation: dvToastOut .25s ease forwards; }',
            '.dv-toast.success { border-color: rgba(34,197,94,.4); color: #bbf7d0; }',
            '.dv-toast.warn    { border-color: rgba(234,179,8,.4); color: #fde68a; }',
            '.dv-toast.info    { border-color: rgba(59,130,246,.4); color: #bfdbfe; }',
            '@keyframes dvToastIn  { from { opacity: 0; transform: translateY(8px);} to { opacity: 1; transform: translateY(0);} }',
            '@keyframes dvToastOut { to { opacity: 0; transform: translateY(8px);} }'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    }

    function ensureHost() {
        var h = document.getElementById(HOST_ID);
        if (h) return h;
        h = document.createElement('div');
        h.id = HOST_ID;
        h.setAttribute('role', 'status');
        h.setAttribute('aria-live', 'polite');
        (document.body || document.documentElement).appendChild(h);
        return h;
    }

    window.dvToast = function (msg, kind, duration, onClick) {
        try {
            ensureStyle();
            // body may not exist yet if called from <head>; defer until ready.
            if (!document.body) {
                document.addEventListener('DOMContentLoaded', function () {
                    window.dvToast(msg, kind, duration, onClick);
                }, { once: true });
                return;
            }
            var host = ensureHost();
            var t = document.createElement('div');
            t.className = 'dv-toast' + (kind ? ' ' + kind : '');
            t.textContent = String(msg == null ? '' : msg);
            if (typeof onClick === 'function') {
                t.style.cursor = 'pointer';
                t.addEventListener('click', function () {
                    try { onClick(); } catch (_) {}
                    t.remove();
                });
            }
            host.appendChild(t);
            var dur = Math.max(800, (duration | 0) || 2200);
            setTimeout(function () {
                t.classList.add('dv-toast-out');
                setTimeout(function () { try { t.remove(); } catch (_) {} }, 260);
            }, dur);
        } catch (_) { /* swallow — toasts must never crash the host page */ }
    };
})();
