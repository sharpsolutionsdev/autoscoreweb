// auth-bridge.js — runs on dartvoice.app, relays Supabase session to extension
// AND announces extension presence + version to the page so the web app can
// show an "update available" banner if the user is on an outdated build.
(function () {
    var SB_STORAGE_KEY = 'sb-poyjykgqsvgimssbhsuz-auth-token';
    var _lastJson = '';

    // Tell the page we're alive + which version we are. The page can compare
    // against /extension-min-version.json and show a banner if outdated.
    try {
        var v = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || null;
        window.postMessage({ type: 'DV_EXT_PRESENT', version: v }, location.origin);
    } catch (_) {}

    // Ask the service worker to poke the Chrome Web Store for any pending
    // extension update (throttled inside background.js). Helps users stuck
    // on stale builds when they reopen the web app.
    try { chrome.runtime.sendMessage({ type: 'DV_REQUEST_UPDATE_CHECK' }, function(){ void chrome.runtime.lastError; }); } catch (_) {}

    // Re-announce when the page asks (handles SPA-style late listeners).
    window.addEventListener('message', function (ev) {
        if (ev.source !== window) return;
        var d = ev.data;
        if (!d || d.type !== 'DV_EXT_PING') return;
        try {
            var v = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || null;
            window.postMessage({ type: 'DV_EXT_PRESENT', version: v }, location.origin);
        } catch (_) {}
    });

    function relay() {
        try {
            var raw = localStorage.getItem(SB_STORAGE_KEY);
            if (raw === _lastJson) return;
            _lastJson = raw;

            if (raw) {
                var parsed = JSON.parse(raw);
                chrome.runtime.sendMessage({ type: 'DV_AUTH_UPDATE', session: parsed });
            } else {
                chrome.runtime.sendMessage({ type: 'DV_AUTH_UPDATE', session: null });
            }
        } catch (e) {
            // Extension context may be invalidated
        }
    }

    // Relay on load
    relay();

    // Poll for same-tab login changes (storage event only fires in other tabs)
    setInterval(relay, 2000);

    // Listen for cross-tab storage changes
    window.addEventListener('storage', function (e) {
        if (e.key === SB_STORAGE_KEY) relay();
    });
})();
