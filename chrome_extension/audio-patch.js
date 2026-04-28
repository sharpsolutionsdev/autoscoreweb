// DartVoice — MAIN-world audio patch for app.dartcounter.net.
// DartCounter plays celebration / dart sounds through the Web Audio API
// (AudioContext + AudioBuffer source nodes), not via <audio> elements,
// so the volume slider in dartvoice.app couldn't reach them from the
// isolated content world. This file runs in the page's MAIN world via
// manifest world:"MAIN" and inserts a master GainNode between every
// AudioContext and its destination so we can scale all output.
(function(){
    if (window.__dvAudioPatchInstalled) return;
    window.__dvAudioPatchInstalled = true;

    const STORAGE_KEY = '__dv_master_gain';
    let desired = 1; // 0..1
    try {
        const fromLs = parseFloat(localStorage.getItem(STORAGE_KEY));
        if (!isNaN(fromLs) && fromLs >= 0 && fromLs <= 1) desired = fromLs;
    } catch(_) {}

    const patchedContexts = new WeakSet();
    const masterGains = new WeakMap();

    function attachMaster(ctx) {
        if (!ctx || patchedContexts.has(ctx)) return masterGains.get(ctx);
        try {
            const gain = ctx.createGain();
            gain.gain.value = desired;
            gain.connect(ctx.destination);
            patchedContexts.add(ctx);
            masterGains.set(ctx, gain);
            // Override .destination so all new connect() calls land on our gain.
            try {
                Object.defineProperty(ctx, 'destination', {
                    configurable: true,
                    get() { return gain; }
                });
            } catch(_) {}
            return gain;
        } catch(_) { return null; }
    }

    function applyAll(v) {
        desired = Math.max(0, Math.min(1, v));
        try { localStorage.setItem(STORAGE_KEY, String(desired)); } catch(_){}
        // Walk all known gains.
        // (WeakMap can't be iterated; we keep a parallel WeakRef list.)
        for (const ref of liveContexts) {
            const ctx = ref.deref && ref.deref();
            const g = ctx && masterGains.get(ctx);
            if (g) {
                try { g.gain.setTargetAtTime(desired, ctx.currentTime, 0.01); } catch(_){
                    try { g.gain.value = desired; } catch(__){}
                }
            }
        }
    }

    const liveContexts = [];
    function track(ctx) {
        if (typeof WeakRef === 'function') liveContexts.push(new WeakRef(ctx));
        attachMaster(ctx);
    }

    // Patch AudioContext + webkitAudioContext constructors.
    ['AudioContext', 'webkitAudioContext'].forEach(name => {
        const Orig = window[name];
        if (!Orig) return;
        function PatchedAudioContext(...args) {
            const ctx = new Orig(...args);
            try { track(ctx); } catch(_){}
            return ctx;
        }
        PatchedAudioContext.prototype = Orig.prototype;
        try {
            Object.setPrototypeOf(PatchedAudioContext, Orig);
            window[name] = PatchedAudioContext;
        } catch(_){}
    });

    // Listen for the same postMessage the isolated-world content script handles.
    window.addEventListener('message', (event) => {
        const data = event && event.data;
        if (!data || data.type !== 'dv-set-volume') return;
        const v = parseFloat(data.volume);
        if (!isNaN(v)) applyAll(v);
    });
})();
