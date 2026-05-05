// DartVoice — MAIN-world camera patch for app.dartcounter.net.
// Wraps navigator.mediaDevices.getUserMedia so any video stream
// that DartCounter (or its peer-connected players) capture is
// transformed in real time according to the user's zoom / pan
// settings. This is what makes the "Cam Zoom" slider in
// dartvoice.app actually alter the footage going OUT to opponents,
// rather than just zooming our local preview.
//
// Strategy:
//   1. Try track.applyConstraints({ advanced:[{ zoom:N }] }) first —
//      that's true hardware zoom on Android Chrome / supported lenses.
//   2. If unsupported (most laptops, USB webcams, iOS Safari), pipe
//      the original video through a hidden <video>+<canvas>+rAF and
//      return a canvas.captureStream() wrapped MediaStream. The
//      canvas crops a centered (panX, panY)-offset window of size
//      1/zoom and upscales it to the original dimensions, so peers
//      see a zoomed-in, lossy-but-acceptable feed.
//   3. Audio tracks pass through unchanged.
//
// Settings come from postMessage({ type:'dv-cam-config', ... })
// (sent by web-app.html's Board Zoom slider through the iframe) and
// from localStorage.__dv_cam_zoom for cold-boot persistence.

(function(){
    if (window.__dvCameraPatchInstalled) return;
    window.__dvCameraPatchInstalled = true;

    const STORAGE_KEY = '__dv_cam_zoom';
    const STATE = {
        zoom:  1,    // 1.0 .. 5.0
        panX:  0.5,  // 0..1, centre by default
        panY:  0.5,
        smooth: true // animate slider changes
    };

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object') Object.assign(STATE, obj);
        }
    } catch(_){}

    const persist = () => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); } catch(_){}
    };

    // Track every active wrapper so config changes propagate live.
    const wrappers = new Set();

    function applyToAll(){
        wrappers.forEach(w => { try { w.update(STATE); } catch(_){} });
    }

    // ── postMessage bridge from dartvoice.app's web-app.html ──
    // Accept messages from any frame on the same opener tree — we trust
    // that only DartVoice ever posts the dv-cam-config protocol.
    window.addEventListener('message', (ev) => {
        const d = ev && ev.data;
        if (!d || typeof d !== 'object') return;
        if (d.type !== 'dv-cam-config' && d.type !== 'dv-cam-zoom') return;
        let changed = false;
        if (typeof d.zoom === 'number' && isFinite(d.zoom) && d.zoom >= 1 && d.zoom <= 8) {
            STATE.zoom = d.zoom; changed = true;
        }
        if (typeof d.panX === 'number' && d.panX >= 0 && d.panX <= 1) {
            STATE.panX = d.panX; changed = true;
        }
        if (typeof d.panY === 'number' && d.panY >= 0 && d.panY <= 1) {
            STATE.panY = d.panY; changed = true;
        }
        if (changed) { persist(); applyToAll(); }
    });

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getUserMedia = async function(constraints){
        const stream = await origGUM(constraints);
        // Only wrap when the request actually asked for video.
        if (!constraints || !constraints.video) return stream;
        try {
            return wrap(stream);
        } catch(err){
            console.warn('[dv-cam] wrap failed, returning original stream', err);
            return stream;
        }
    };

    // ── Wrap a MediaStream so its video tracks become zoom-controllable. ──
    function wrap(srcStream){
        const vTracks = srcStream.getVideoTracks();
        if (!vTracks.length) return srcStream;

        // Try true hardware zoom first — preferred when available.
        const t = vTracks[0];
        let nativeZoomCaps = null;
        try { nativeZoomCaps = (t.getCapabilities && t.getCapabilities()) || null; } catch(_){}
        const hasNativeZoom = !!(nativeZoomCaps && 'zoom' in nativeZoomCaps);

        // Hidden video element drives the canvas pipeline.
        const v = document.createElement('video');
        v.autoplay = true; v.muted = true; v.playsInline = true;
        v.srcObject = srcStream;
        // play() can throw if not user-gesture; ignore — DartCounter
        // already gated us behind one, so it virtually always succeeds.
        v.play().catch(()=>{});

        // Canvas dimensions follow the source resolution.
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d', { alpha: false, desynchronized: true });

        let raf = 0;
        let cur = { zoom: STATE.zoom, panX: STATE.panX, panY: STATE.panY };
        // Smoothing: lerp current → target each frame for buttery zoom.
        let tgt = { ...cur };

        const draw = () => {
            const sw = v.videoWidth, sh = v.videoHeight;
            if (sw && sh) {
                if (c.width !== sw)  c.width  = sw;
                if (c.height !== sh) c.height = sh;
                // Smooth toward target.
                const k = STATE.smooth ? 0.18 : 1;
                cur.zoom += (tgt.zoom - cur.zoom) * k;
                cur.panX += (tgt.panX - cur.panX) * k;
                cur.panY += (tgt.panY - cur.panY) * k;
                const z = Math.max(1, cur.zoom);
                const cw = sw / z, ch = sh / z;
                const cx = (sw - cw) * cur.panX;
                const cy = (sh - ch) * cur.panY;
                try {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(v, cx, cy, cw, ch, 0, 0, sw, sh);
                } catch(_){}
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);

        // captureStream is widely supported on Chromium.
        const outVideo = c.captureStream(30);
        const out = new MediaStream();
        outVideo.getVideoTracks().forEach(tr => out.addTrack(tr));
        // Forward audio tracks unchanged.
        srcStream.getAudioTracks().forEach(tr => out.addTrack(tr));

        // Stopping the wrapped track must propagate to origin tracks.
        out.getVideoTracks().forEach(tr => {
            const origStop = tr.stop.bind(tr);
            tr.stop = function(){
                try { srcStream.getTracks().forEach(s => s.stop()); } catch(_){}
                try { cancelAnimationFrame(raf); } catch(_){}
                wrappers.delete(handle);
                return origStop();
            };
        });

        // Live updater.
        const handle = {
            update(s){
                tgt.zoom = s.zoom; tgt.panX = s.panX; tgt.panY = s.panY;
                if (hasNativeZoom) {
                    // Hardware zoom is real optical/digital zoom on the lens
                    // itself — much better quality than canvas crop. Apply it
                    // to the source track and let the canvas just centre-pan.
                    try {
                        const min = nativeZoomCaps.zoom.min || 1;
                        const max = nativeZoomCaps.zoom.max || 1;
                        const target = Math.min(max, Math.max(min, s.zoom));
                        t.applyConstraints({ advanced: [{ zoom: target }] }).catch(()=>{});
                        // Once hardware applied, neutralise the canvas crop so
                        // we don't double-zoom.
                        tgt.zoom = 1;
                    } catch(_){}
                }
            }
        };
        wrappers.add(handle);
        handle.update(STATE);
        return out;
    }

    // Tell the host page (via postMessage to parent) we're alive — useful
    // for the dartvoice.app slider to know it can drive a live zoom.
    try {
        window.parent && window.parent !== window &&
        window.parent.postMessage({ type: 'dv-cam-patch-ready', version: 1 }, '*');
    } catch(_){}
})();
