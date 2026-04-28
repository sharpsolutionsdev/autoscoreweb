/**
 * dv-extension-check.js — Detects an outdated DartVoice Chrome extension.
 *
 * How it works:
 * 1. The extension's auth-bridge.js (running on dartvoice.app) posts
 *    `{ type: 'DV_EXT_PRESENT', version }` to window on load.
 * 2. We listen, fetch /extension-version.json, and compare.
 * 3. If `version < minSupported` -> hard warn (red, persistent toast w/ link).
 *    If `version < latest`        -> soft nudge (info toast, dismissible).
 * 4. We also re-broadcast a DV_EXT_PING in case the bridge loaded first.
 * 5. After 2.5s with no DV_EXT_PRESENT we assume the extension isn't
 *    installed and stay silent (other surfaces handle install prompts).
 *
 * Drop-in: <script src="/dv-extension-check.js" defer></script>
 * Requires dv-toast.js to be loaded for visible feedback. Falls back to
 * console.warn if dvToast is unavailable.
 */
(function () {
    'use strict';
    if (typeof window === 'undefined') return;
    if (window.__dvExtCheckLoaded) return;
    window.__dvExtCheckLoaded = true;

    var STORAGE_DISMISS_KEY = 'dv-ext-update-dismissed-v';
    var MANIFEST_URL = '/extension-version.json';

    function cmp(a, b) {
        // semver-ish numeric compare: "2.10.0" > "2.9.9"
        var pa = String(a || '0').split('.').map(function (n) { return parseInt(n, 10) || 0; });
        var pb = String(b || '0').split('.').map(function (n) { return parseInt(n, 10) || 0; });
        var len = Math.max(pa.length, pb.length);
        for (var i = 0; i < len; i++) {
            var d = (pa[i] || 0) - (pb[i] || 0);
            if (d !== 0) return d < 0 ? -1 : 1;
        }
        return 0;
    }

    function notify(msg, kind, onClick) {
        try {
            if (typeof window.dvToast === 'function') {
                window.dvToast(msg, kind || 'warn', 8000, onClick);
                return;
            }
        } catch (_) {}
        try { console.warn('[dv-ext-check]', msg); } catch (_) {}
    }

    var seen = false;
    var manifestPromise = null;

    function loadManifest() {
        if (manifestPromise) return manifestPromise;
        manifestPromise = fetch(MANIFEST_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
        return manifestPromise;
    }

    function evaluate(extVersion) {
        if (seen) return;
        seen = true;
        loadManifest().then(function (m) {
            if (!m || !m.version) return;
            var latest = m.version;
            var minSupported = m.minSupported || latest;
            var openStore = function () {
                try { window.open(m.webStoreUrl || 'https://chromewebstore.google.com/detail/dartvoice-launchpad/fnibjbcmgfedeognilhcamankfjlmaep', '_blank', 'noopener'); } catch (_) {}
            };

            // Already up to date — quietly emit an event for any listeners.
            if (cmp(extVersion, latest) >= 0) {
                try { window.dispatchEvent(new CustomEvent('dv:extension-up-to-date', { detail: { version: extVersion } })); } catch (_) {}
                return;
            }

            // Below min supported — hard warning every load.
            if (cmp(extVersion, minSupported) < 0) {
                notify('DartVoice extension v' + extVersion + ' is out of date. Click to update (latest: v' + latest + ').', 'warn', openStore);
                try { window.dispatchEvent(new CustomEvent('dv:extension-outdated', { detail: { version: extVersion, latest: latest, hard: true } })); } catch (_) {}
                return;
            }

            // Soft nudge — show once per latest version.
            try {
                var dismissed = localStorage.getItem(STORAGE_DISMISS_KEY) === latest;
                if (dismissed) return;
            } catch (_) {}
            notify('Extension update available (v' + latest + '). Click to update.', 'info', function () {
                try { localStorage.setItem(STORAGE_DISMISS_KEY, latest); } catch (_) {}
                openStore();
            });
            try { window.dispatchEvent(new CustomEvent('dv:extension-outdated', { detail: { version: extVersion, latest: latest, hard: false } })); } catch (_) {}
        });
    }

    window.addEventListener('message', function (ev) {
        if (!ev || ev.source !== window) return;
        var d = ev.data;
        if (!d || d.type !== 'DV_EXT_PRESENT') return;
        evaluate(d.version || '0.0.0');
    });

    // Ask the bridge to re-announce in case it loaded before us.
    try { window.postMessage({ type: 'DV_EXT_PING' }, location.origin); } catch (_) {}
    // And again after the page is fully ready.
    if (document.readyState !== 'complete') {
        window.addEventListener('load', function () {
            try { window.postMessage({ type: 'DV_EXT_PING' }, location.origin); } catch (_) {}
        }, { once: true });
    }
})();
