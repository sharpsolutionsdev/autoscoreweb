// auth-bridge.js — runs on dartvoice.app, relays Supabase session to extension
(function () {
    var SB_STORAGE_KEY = 'sb-poyjykgqsvgimssbhsuz-auth-token';
    var _lastJson = '';

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
