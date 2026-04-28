// dv-presence.js — lightweight live-user presence via Supabase Realtime.
// Every page that includes this file joins a public presence channel so admins
// can count "online now" users. No PII is broadcast — just a session id, a
// coarse page label, and (if signed in) the user's id.
//
// Usage: <script defer src="/dv-presence.js"></script>  — must load AFTER
// supabase-js and after the page creates its sb client on window.sb.

(function(){
    'use strict';
    if (window.__dvPresenceInit) return;
    window.__dvPresenceInit = true;

    function pickClient(){
        return window.sb
            || (window.supabase && window.__dvSbFallback)
            || null;
    }

    var sessId = 'ss-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    var CHANNEL_NAME = 'dv-site-presence';
    var ch = null;
    var joined = false;

    function pageLabel(){
        try {
            var p = (location.pathname || '/').replace(/\.html$/i, '').replace(/\/$/, '') || '/';
            return p.slice(0, 40);
        } catch(_) { return '/'; }
    }

    function join(){
        var sb = pickClient();
        if (!sb || typeof sb.channel !== 'function') {
            setTimeout(join, 500); return;
        }
        try { if (ch) { sb.removeChannel(ch); ch = null; } } catch(_){}
        ch = sb.channel(CHANNEL_NAME, { config: { presence: { key: sessId } } });
        ch.subscribe(function(status){
            if (status === 'SUBSCRIBED') {
                joined = true;
                var userId = null;
                try { userId = (sb.auth && sb.auth.getSession) ? null : null; } catch(_){}
                // Track after subscribe
                sb.auth.getSession().then(function(r){
                    var uid = r && r.data && r.data.session && r.data.session.user ? r.data.session.user.id : null;
                    try {
                        ch.track({
                            session_id: sessId,
                            user_id: uid || null,
                            page: pageLabel(),
                            joined_at: Date.now()
                        });
                    } catch(_){}
                }).catch(function(){
                    try { ch.track({ session_id: sessId, user_id: null, page: pageLabel(), joined_at: Date.now() }); } catch(_){}
                });
            }
        });
    }

    // Expose a helper for admin: returns current online members
    window.dvPresenceList = function(){
        try {
            if (!ch || typeof ch.presenceState !== 'function') return [];
            var state = ch.presenceState();
            var out = [];
            Object.keys(state).forEach(function(k){
                var arr = state[k] || [];
                arr.forEach(function(m){ out.push(m); });
            });
            return out;
        } catch(_) { return []; }
    };

    window.dvPresenceChannel = function(){ return ch; };
    window.dvPresenceSessionId = sessId;

    // Start once DOM is ready so sb client has a chance to be created
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){ setTimeout(join, 200); });
    } else {
        setTimeout(join, 200);
    }

    // Gracefully untrack on unload
    window.addEventListener('beforeunload', function(){
        try { if (ch && joined) ch.untrack(); } catch(_){}
    });
})();
