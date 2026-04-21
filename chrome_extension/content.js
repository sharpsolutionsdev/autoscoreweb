(function () {
  // Kill any previous instance's recognition to prevent dual-mic fighting
  if (window.__dartvoiceRecognition) {
    try { window.__dartvoiceRecognition.abort(); } catch(e) {}
    window.__dartvoiceRecognition = null;
  }
  // If already injected and overlay still present, skip re-injection
  if (window.__dartvoiceInjected && document.getElementById('dartvoice-overlay')) return;
  window.__dartvoiceInjected = true;

  // --- DART PARSING LOGIC PORTED FROM PYTHON ---
  const _ONES = {
    'zero': 0, 'oh': 0, 'nought': 0, 'nil': 0, 'naught': 0, 'no': 0,
    'one': 1, 'won': 1, 'wan': 1,
    'two': 2, 'too': 2, 'to': 2, 'tu': 2,
    'three': 3, 'free': 3, 'tree': 3, 'tee': 3,
    'four': 4, 'for': 4, 'fore': 4,
    'five': 5, 'fife': 5, 'fiv': 5,
    'six': 6, 'sicks': 6, 'seeks': 6,
    'seven': 7, 'sebben': 7, 'seben': 7, 'seebin': 7, 'sebin': 7,
    'eight': 8, 'ate': 8, 'ait': 8,
    'nine': 9, 'nein': 9, 'nyne': 9,
    'ten': 10, 'tin': 10,
    'eleven': 11, 'levin': 11, 'levven': 11,
    'twelve': 12, 'twelf': 12,
    'thirteen': 13, 'tirteen': 13, 'turteen': 13,
    'fourteen': 14, 'forteen': 14,
    'fifteen': 15, 'fiftin': 15,
    'sixteen': 16, 'sixtin': 16,
    'seventeen': 17, 'seventin': 17,
    'eighteen': 18, 'eightin': 18, 'atin': 18,
    'nineteen': 19, 'ninetin': 19,
    // Common dart call-outs
    'bull': 50, 'bullseye': 50, 'bulls': 50, 'bull\'s eye': 50, 'bully': 50,
    'outer bull': 25, 'outer': 25, 'single bull': 25, 'half bull': 25,
    'tops': 40, 'double top': 40, 'double tops': 40, 'top': 40,
    'madhouse': 2, 'double one': 2,
    'ton': 100, 'a ton': 100, 'one hundred': 100,
    'low ton': 100, 'high ton': 150
  };
  const _TENS = { 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90 };

  const _CRICKET_MODS = { 'single': 1, 'double': 2, 'treble': 3, 'triple': 3, 'travel': 3, 'trouble': 3, 'tribal': 3, 'tremble': 3, 'trickle': 3, 'doubles': 2, 'singles': 1 };

  const _CRICKET_TARGETS = {
    'twenty': '20', 'twenties': '20', '20': '20', 'plenty': '20',
    'nineteen': '19', 'nineteens': '19', '19': '19',
    'eighteen': '18', 'eighteens': '18', '18': '18',
    'seventeen': '17', 'seventeens': '17', '17': '17',
    'sixteen': '16', 'sixteens': '16', '16': '16',
    'fifteen': '15', 'fifteens': '15', '15': '15',
    'bull': 'b', 'bullseye': 'b', 'bulls': 'b', 'bowl': 'b', 'bold': 'b', 'pull': 'b', 'full': 'b',
    'miss': 'miss', 'zero': 'miss', 'nothing': 'miss', 'none': 'miss', 'missed': 'miss'
  };

  const _SHORTHAND_RE = /^([sdt])(\d{2}|bull?)$/;
  const _SHORTHAND_TARGETS = { '20': '20', '19': '19', '18': '18', '17': '17', '16': '16', '15': '15', 'bul': 'b', 'bull': 'b', 'b': 'b' };

  function parseCricketDarts(text) {
    const words = text.toLowerCase().replace(/-/g, ' ').split(' ');
    let darts = [];
    let currentMod = 's';

    for (const w of words) {
      // Shorthand match (e.g., t20, d16)
      const sh = w.match(_SHORTHAND_RE);
      if (sh) {
        const m = sh[1];
        const tgt = _SHORTHAND_TARGETS[sh[2]];
        if (tgt) {
          darts.push({ tgt: tgt, mod: (tgt === 'b' && m === 't' ? 's' : m) });
          continue;
        }
      }
      // Modifier match
      let numMod = _CRICKET_MODS[w];
      if (numMod) {
        if (numMod === 3) currentMod = 't';
        else if (numMod === 2) currentMod = 'd';
        else currentMod = 's';
      } else if (_CRICKET_TARGETS[w]) {
        // Target match
        const tgt = _CRICKET_TARGETS[w];
        if (tgt === 'miss') {
          darts.push({ tgt: 'miss', mod: 'none' });
        } else {
          darts.push({ tgt: tgt, mod: (tgt === 'b' && currentMod === 't' ? 's' : currentMod) });
        }
        currentMod = 's'; // reset modifier after target
      }
    }
    return darts.slice(0, 3);
  }

  function parseUnder100(t) {
    if (_ONES[t] !== undefined) return _ONES[t];
    if (_TENS[t] !== undefined) return _TENS[t];
    const w = t.split(' ');
    if (w.length === 2 && _TENS[w[0]] !== undefined && _ONES[w[1]] !== undefined) {
      return _TENS[w[0]] + _ONES[w[1]];
    }
    const v = parseInt(t);
    return (!isNaN(v) && v >= 0 && v <= 99) ? v : null;
  }

  function parseScore(text) {
    text = text.toLowerCase().replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Handle "ton" combinations
    if (text.startsWith('ton ')) {
      const rest = text.replace(/^ton\s+/, '').trim();
      const v = parseUnder100(rest);
      if (v !== null && (100 + v) <= 180) return 100 + v;
    }

    // Handle "one eighty", "one forty", etc. without "hundred"
    const parts = text.split(' ');
    if (parts.length === 2 && parts[0] === 'one' && _TENS[parts[1]] !== undefined) {
      const val = 100 + _TENS[parts[1]];
      if (val <= 180) return val;
    }

    // Handle "one hundred" patterns
    if (text.startsWith('one hundred') || text.startsWith('a hundred')) {
      const rest = text.replace(/^(one hundred|a hundred)/, '').trim();
      if (!rest) return 100;
      const sub = parseUnder100(rest);
      if (sub !== null && (100 + sub) <= 180) return 100 + sub;
    }

    // Strip optional "score" or "shot" prefix
    text = text.replace(/^(score|shot)\s+/, '');

    const base = parseUnder100(text);
    return (base !== null && base <= 180) ? base : null;
  }

  function parseSingleDart(text) {
    let t = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (['bull', 'bullseye', 'bulls', 'fifty', 'double bull'].includes(t)) return { val: 50, label: 'Bull' };
    if (['outer bull', 'twenty five', 'twenty-five', 'half bull', 'single bull', 'green bull'].includes(t)) return { val: 25, label: '25' };
    if (['miss', 'missed', 'zero', 'nothing', 'none', 'bounce out', 'bounce'].includes(t)) return { val: 0, label: 'Miss' };

    let words = t.split(' ');
    let mod = 1, pfx = '';

    if (words.length > 0 && _CRICKET_MODS[words[0]] !== undefined) {
      mod = _CRICKET_MODS[words[0]];
      if (mod === 3) pfx = 'T';
      else if (mod === 2) pfx = 'D';
      words = words.slice(1);
    }
    if (words.length === 0) return null;

    let val = parseUnder100(words.join(' '));
    if (val === null) return null;

    if (val >= 1 && val <= 20) {
      return { val: val * mod, label: (pfx ? pfx + val : '' + val) };
    }
    return null;
  }

  // --- STATE ---
  let isListening = false;
  let recognition = null;
  let calibrationMode = false;
  let calibratedCoords = { x: null, y: null };
  
  // Load persisted calibration
  chrome.storage.local.get(['calibratedCoords'], (result) => {
    if (result.calibratedCoords) {
      calibratedCoords = result.calibratedCoords;
      logTrace(`Restored Persisted Calibration: X=${calibratedCoords.x}, Y=${calibratedCoords.y}`);
    }
  });

  // --- SUBSCRIPTION & DEMO STATE ---
  var DEMO_LIMIT_MS = 10 * 60 * 1000;
  var dvAuth = { email: null, sub: null, demoUsedMs: 0, micDeviceId: null };
  var _micStartedAt = null;
  var _demoInterval = null;

  function hasActiveSub() { return dvAuth.sub === 'active' || dvAuth.sub === 'trialing'; }
  function demoTimeRemaining() { return Math.max(0, DEMO_LIMIT_MS - dvAuth.demoUsedMs); }

  // Load auth/demo state from storage
  chrome.storage.local.get(['dv_user_email', 'dv_sub_status', 'dv_demo_used_ms', 'dv_mic_device_id'], (d) => {
    dvAuth.email = d.dv_user_email || null;
    dvAuth.sub = d.dv_sub_status || null;
    dvAuth.demoUsedMs = d.dv_demo_used_ms || 0;
    dvAuth.micDeviceId = d.dv_mic_device_id || null;
  });

  const isDartVoiceParent = window.location.href.includes('web-app.html') || window.location.href.includes('dartvoice-dashboard.html');
  const isIframe = window !== window.top;

  // --- SECURITY GATE: only activate on dartcounter/nakka when framed by dartvoice.app ---
  // Prevents the extension from adding UI / posting state when the user is on
  // dartcounter.net directly (outside our web app). Keeps scope narrow and
  // avoids leaking overlay / state handlers to unrelated tabs.
  try {
    const host = (location.hostname || '').toLowerCase();
    const isScorerHost = /(^|\.)dartcounter\.net$/.test(host) || /(^|\.)nakka\.com$/.test(host);
    if (isScorerHost) {
      const refOk = /^https:\/\/(www\.)?dartvoice\.app(\/|$)/.test(document.referrer || '');
      if (!isIframe || !refOk) {
        // Not embedded by our web app — bail silently. Auth-bridge still runs on dartvoice.app.
        window.__dartvoiceInjected = false;
        return;
      }
    }
  } catch(e) { return; }

  if (isDartVoiceParent) {
      logTrace("Detected DartVoice Dashboard. Disabling internal microphone to avoid conflicts.");
  }

  const frameID = isIframe ? "[IFRAME]" : "[PARENT]";

  // --- UI OVERLAY CONTAINER ---
  const container = document.createElement('div');
  container.id = 'dartvoice-overlay';
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.zIndex = '2147483646';
  // Whether the overlay may be dragged/reordered. Disabled by default —
  // the popup can toggle this to avoid accidental layout changes when
  // interacting with page sliders or UI.
  let overlayReorderEnabled = false;
  // Timer used to auto-disable reorder mode if the popup closes or forgets to turn it off.
  let overlayReorderTimer = null;
  const shadow = container.attachShadow({ mode: 'open' });
  if (document.body) {
    document.body.appendChild(container);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
  }

  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,900;1,700;1,900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    
    .dv-panel {
      background: rgba(8, 8, 10, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #F0F0F5;
      padding: 20px;
      border-radius: 16px;
      width: 280px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      position: relative;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    
    }
    .dv-reorder-active {
      border-style: dashed; border-width: 1px; border-color: rgba(204,11,32,0.28);
      box-shadow: 0 8px 28px rgba(204,11,32,0.06), inset 0 1px 0 rgba(255,255,255,0.02);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 12px;
    }
    
    h3 {
      margin: 0;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 22px;
      font-weight: 900;
      font-style: italic;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: white;
    }
    
    .text-red { color: #CC0B20; }
    
    .close-btn {
      cursor: pointer;
      color: #6E6E82;
      font-size: 16px;
      transition: color 0.2s;
    }
    .close-btn:hover { color: #fff; }
    
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #6E6E82;
    }
    
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #6E6E82; display: inline-block; }
    .status-dot.active { background: #CC0B20; box-shadow: 0 0 10px #CC0B20; }
    
    button {
      background: rgba(37,37,48,0.5);
      color: #F0F0F5;
      border: 1px solid rgba(255,255,255,0.05);
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      margin-bottom: 10px;
      font-weight: 700;
      font-size: 11px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: all 0.2s;
    }
    button:hover { background: rgba(37,37,48,0.8); }
    
    button.primary {
      background: #CC0B20;
      border-color: transparent;
      box-shadow: 0 0 15px rgba(204,11,32,0.3);
    }
    button.primary:hover {
      background: #e60d24;
      box-shadow: 0 0 20px rgba(204,11,32,0.5);
      transform: translateY(-1px);
    }
    button.primary:active { transform: translateY(1px); }
    
    .log {
      font-size: 11px;
      font-weight: 500;
      color: #aaabbb;
      background: #111114;
      padding: 12px;
      border-radius: 8px;
      min-height: 50px;
      margin-top: 16px;
      word-wrap: break-word;
      border: 1px solid rgba(255,255,255,0.03);
      line-height: 1.4;
    }

    button:disabled {
      opacity: 0.4; cursor: not-allowed;
      transform: none !important; box-shadow: none !important;
    }

    .demo-row {
      margin-bottom: 12px; padding: 10px;
      background: rgba(255,255,255,0.03); border-radius: 8px;
    }
    .demo-bar {
      height: 4px; background: rgba(255,255,255,0.06);
      border-radius: 2px; overflow: hidden; margin-bottom: 5px;
    }
    .demo-fill {
      height: 100%; background: linear-gradient(90deg, #CC0B20, #e60d24);
      border-radius: 2px; transition: width 0.3s; width: 0%;
    }
    .demo-fill.expired { background: #6E6E82; }
    .demo-time {
      font-size: 10px; color: #6E6E82; font-weight: 600;
    }
    .demo-time b { color: #F0F0F5; }

    .mic-row { margin-bottom: 10px; }
    .mic-row label {
      display: block; font-size: 9px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      color: #6E6E82; margin-bottom: 5px;
    }
    .mic-row select {
      width: 100%; background: #111114; color: #F0F0F5;
      border: 1px solid rgba(255,255,255,0.07); border-radius: 6px;
      padding: 7px 10px; font-size: 11px;
      font-family: 'Plus Jakarta Sans', sans-serif; outline: none;
    }
    .mic-row select:focus { border-color: #CC0B20; }

    .lockout-overlay {
      position: absolute; inset: 0;
      background: rgba(8,8,10,0.97); border-radius: 16px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px; text-align: center; z-index: 10;
    }
    .lockout-overlay h4 {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 20px; font-weight: 900; font-style: italic;
      text-transform: uppercase; color: white; margin: 0 0 8px;
    }
    .lockout-overlay p {
      font-size: 11px; color: #6E6E82; margin: 0 0 14px;
      line-height: 1.4;
    }
    .lockout-overlay a {
      display: inline-block; background: #CC0B20; color: white;
      text-decoration: none; padding: 10px 20px; border-radius: 8px;
      font-weight: 700; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em; transition: background 0.2s;
    }
    .lockout-overlay a:hover { background: #e60d24; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'dv-panel';
  panel.innerHTML = `
    <div class="header">
      <h3>DART<span class="text-red">VOICE</span> overlay</h3>
      <span class="close-btn" id="dv-close">✖</span>
    </div>
    <div class="status-row">
      <span id="dv-status-text">Microphone Idle</span>
      <div class="status-dot" id="dv-status-dot"></div>
    </div>
    <div class="demo-row" id="dv-demo-row">
      <div class="demo-bar"><div class="demo-fill" id="dv-demo-fill"></div></div>
      <span class="demo-time" id="dv-demo-time"><b>10:00</b> remaining</span>
    </div>
    <div class="mic-row" id="dv-mic-row">
      <label>Microphone</label>
      <select id="dv-mic-select"><option value="">System Default</option></select>
    </div>
    <button id="dv-toggle-mic" class="primary">Start Listening</button>
    <button id="dv-calibrate">Calibrate Grid</button>
    <div class="log" id="dv-log">Awaiting voice commands...</div>
    <div class="lockout-overlay" id="dv-lockout" style="display:none;">
      <h4>Demo Expired</h4>
      <p>Your 10-minute demo has ended.<br>Sign in &amp; subscribe to continue.</p>
      <a href="https://dartvoice.app/login.html" target="_blank">Sign In →</a>
    </div>
  `;
  shadow.appendChild(panel);

  const statusText = shadow.getElementById('dv-status-text');
  const statusDot = shadow.getElementById('dv-status-dot');
  const toggleMicBtn = shadow.getElementById('dv-toggle-mic');
  const calibrateBtn = shadow.getElementById('dv-calibrate');
  const logDiv = shadow.getElementById('dv-log');
  const closeBtn = shadow.getElementById('dv-close');
  const demoRow = shadow.getElementById('dv-demo-row');
  const demoFill = shadow.getElementById('dv-demo-fill');
  const demoTimeSpan = shadow.getElementById('dv-demo-time');
  const micRow = shadow.getElementById('dv-mic-row');
  const micSelect = shadow.getElementById('dv-mic-select');
  const lockoutDiv = shadow.getElementById('dv-lockout');

  // --- DEMO TIMER HELPERS ---
  function formatDemoTime(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function updateDemoUI(overrideUsed) {
    if (!demoRow) return;
    if (hasActiveSub()) { demoRow.style.display = 'none'; return; }
    demoRow.style.display = '';
    var used = overrideUsed !== undefined ? overrideUsed : dvAuth.demoUsedMs;
    var remaining = Math.max(0, DEMO_LIMIT_MS - used);
    var pct = Math.min(100, (used / DEMO_LIMIT_MS) * 100);
    demoFill.style.width = pct + '%';
    demoTimeSpan.innerHTML = '<b>' + formatDemoTime(remaining) + '</b> remaining';
    if (remaining <= 0) demoFill.classList.add('expired');
  }

  function startDemoTracking() {
    if (hasActiveSub()) return;
    _micStartedAt = Date.now();
    _demoInterval = setInterval(function () {
      var elapsed = Date.now() - _micStartedAt;
      var total = dvAuth.demoUsedMs + elapsed;
      updateDemoUI(total);
      if (total >= DEMO_LIMIT_MS) {
        forceStopMic();
        dvAuth.demoUsedMs = total;
        _micStartedAt = null;
        clearInterval(_demoInterval);
        _demoInterval = null;
        chrome.storage.local.set({ dv_demo_used_ms: dvAuth.demoUsedMs });
        showLockout();
      }
    }, 1000);
  }

  function stopDemoTracking() {
    if (_micStartedAt) {
      dvAuth.demoUsedMs += Date.now() - _micStartedAt;
      _micStartedAt = null;
    }
    if (_demoInterval) { clearInterval(_demoInterval); _demoInterval = null; }
    chrome.storage.local.set({ dv_demo_used_ms: dvAuth.demoUsedMs });
    updateDemoUI();
  }

  function forceStopMic() {
    if (recognition && isListening) {
      toggleMicBtn.dataset.intendedState = 'off';
      recognition.stop();
    }
  }

  function showLockout() {
    if (lockoutDiv) lockoutDiv.style.display = 'flex';
    toggleMicBtn.disabled = true;
  }

  function hideLockout() {
    if (lockoutDiv) lockoutDiv.style.display = 'none';
    toggleMicBtn.disabled = false;
    updateDemoUI();
  }

  // --- MIC DEVICE ENUMERATION ---
  function loadMicDevices() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function (devices) {
      var mics = devices.filter(function (d) { return d.kind === 'audioinput'; });
      if (mics.length === 0) return;
      micSelect.innerHTML = '<option value="">System Default</option>';
      mics.forEach(function (mic) {
        var opt = document.createElement('option');
        opt.value = mic.deviceId;
        opt.textContent = mic.label || ('Microphone ' + mic.deviceId.slice(0, 8));
        micSelect.appendChild(opt);
      });
      if (dvAuth.micDeviceId) micSelect.value = dvAuth.micDeviceId;
    }).catch(function () {});
  }

  micSelect.addEventListener('change', function () {
    dvAuth.micDeviceId = micSelect.value || null;
    chrome.storage.local.set({ dv_mic_device_id: dvAuth.micDeviceId });
  });

  // Init demo UI + mic list (deferred so state loads first)
  setTimeout(function () {
    if (!isIframe && !isDartVoiceParent) {
      updateDemoUI();
      loadMicDevices();
      // If demo already expired on load, lock immediately
      if (!hasActiveSub() && dvAuth.demoUsedMs >= DEMO_LIMIT_MS) showLockout();
    }
  }, 300);

  function logTrace(msg, data) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[DartVoice Bridge ${frameID}]`;
    if (data) console.log(`${prefix} ${msg}`, data);
    else console.log(`${prefix} ${msg}`);
  }

  logTrace("Extension Script Injected and Ready.");

  // --- CALIBRATION OVERLAY ---
  let calibrationOverlay = null;

  function startCalibration() {
    calibrationMode = true;
    logTrace("Calibration Mode activated. Spawning overlay.");
    panel.style.opacity = '0.5';

    // Create the dark overlay
    calibrationOverlay = document.createElement('div');
    calibrationOverlay.style.position = 'fixed';
    calibrationOverlay.style.inset = '0';
    calibrationOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    calibrationOverlay.style.zIndex = '2147483647'; // Max integer to ensure it's on top of everything
    calibrationOverlay.style.display = 'flex';
    calibrationOverlay.style.flexDirection = 'column';
    calibrationOverlay.style.alignItems = 'center';
    calibrationOverlay.style.justifyContent = 'center';
    calibrationOverlay.style.cursor = 'crosshair';
    
    // Add textual instructions
    calibrationOverlay.innerHTML = `
      <div style="text-align: center; color: white; font-family: sans-serif; pointer-events: none;">
        <h1 style="font-size: 32px; font-weight: bold; margin-bottom: 16px; color: #CC0B20; text-transform: uppercase; letter-spacing: 2px;">Calibration Mode</h1>
        <p style="font-size: 18px; color: #F0F0F5;">Click exactly on the DartCounter Score Input Box.</p>
      </div>
    `;

    document.body.appendChild(calibrationOverlay);

    // Listen for the calibration click strictly on the overlay
    calibrationOverlay.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      calibratedCoords = { x: e.clientX, y: e.clientY };
      calibrationMode = false;
      
      // Persist to storage
      chrome.storage.local.set({ calibratedCoords });
      
      logTrace(`Coordinate Calibrated: X=${e.clientX}, Y=${e.clientY}`);
      
      // Destroy the overlay instantly
      document.body.removeChild(calibrationOverlay);
      calibrationOverlay = null;
    }, true);
  }

  calibrateBtn.addEventListener('click', () => {
    startCalibration();
  });

  // --- CLICK SIMULATION ---
  function clickCoordinate(x, y) {
    const el = document.elementFromPoint(x, y);
    if (el) {
      logTrace("Simulating click on target element:", el);
      // Simulate physical click
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      el.focus();
    } else {
      logTrace(`No DOM element found at X=${x}, Y=${y}!`);
    }
  }

  // --- SPEECH RECOGNITION ---
  function initSpeech() {
    // SECURITY: If we are running in the Scorer Studio Iframe, 
    // we MUST NOT use the mic. The Parent Dashboard handles voice.
    if (isIframe) {
        logTrace("Mic initialization blocked in Iframe mode (Ghost Mode).");
        return;
    }

    // Don't run voice on the DartVoice parent page - web-app.html handles it
    if (isDartVoiceParent) {
        logTrace("Mic initialization blocked on DartVoice parent page.");
        return;
    }

    if (!('webkitSpeechRecognition' in window)) {
        logTrace("Your browser does not support SpeechRecognition.");
        return;
    }
    // ... [Speech Init Truncated for Space in Chunk] ...
    recognition = new webkitSpeechRecognition();
    window.__dartvoiceRecognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    var _recStartTime = 0;
    var _rapidRestarts = 0;

    recognition.onstart = () => {
      isListening = true;
      _recStartTime = Date.now();
      statusText.textContent = 'Listening...';
      statusDot.classList.add('active');
      toggleMicBtn.textContent = 'Stop Listening';
      toggleMicBtn.classList.remove('primary');
      logTrace("Microphone natively listening...");
      startDemoTracking();
    };

    recognition.onend = () => {
      isListening = false;
      statusText.textContent = 'Mic Off';
      statusDot.classList.remove('active');
      toggleMicBtn.textContent = 'Start Listening';
      toggleMicBtn.classList.add('primary');
      stopDemoTracking();

      // Auto-restart with exponential backoff to prevent rapid cycling
      if (toggleMicBtn.dataset.intendedState === "on") {
        var uptime = Date.now() - _recStartTime;
        if (uptime < 3000) {
          _rapidRestarts++;
        } else {
          _rapidRestarts = 0;
        }
        if (_rapidRestarts >= 5) {
          logTrace('Recognition restarting too rapidly — stopping. Click Start Listening to retry.');
          toggleMicBtn.dataset.intendedState = 'off';
          _rapidRestarts = 0;
          return;
        }
        var delay = Math.min(1000 * Math.pow(2, _rapidRestarts), 16000);
        logTrace('Auto-restarting recognition in ' + delay + 'ms...');
        setTimeout(() => { if (!isListening) startRecognitionWithMic(); }, delay);
      }
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          logTrace(`Heard: "${transcript}"`);
          processSpeech(transcript);
        }
      }
    };
  }

  function triggerAutoEdit(score) {
    // Attempt 1: Undoing the last throw, then injecting the new one (most robust for last-throw edits)
    logTrace(`Executing AUTO-EDIT... triggering undo then injecting new score: ${score}`);
    triggerUndo();
    
    // Attempt 2: Target an explicit DartCounter 'edit-score' button if it's visible on the screen
    setTimeout(() => {
       const editBtns = document.querySelectorAll('button[aria-label*="edit" i], button[title*="edit" i], .edit-score-button, [data-testid*="edit" i]');
       for (const b of editBtns) {
           if (b.offsetParent) { // Is visible
               logTrace("Found explicit Edit button, clicking it...");
               b.click();
               break;
           }
       }
       
       // Give DartCounter UI a moment to process the undo/modal, then inject
       setTimeout(() => {
           simulateScoreEntry(score);
       }, 400); // 400ms to allow UI transition
    }, 150);
  }

  function processSpeech(transcript) {
    if (!calibratedCoords.x || !calibratedCoords.y) {
      logTrace("Error: Please Calibrate the input box first!");
      return;
    }

    // Check for "edit [score]" or "change to [score]"
    let isEditCommand = false;
    let editTarget = transcript;
    const editMatch = transcript.match(/^(edit|change\s+to|change)\s+(.*)/i);
    if (editMatch) {
      isEditCommand = true;
      editTarget = editMatch[2].trim();
      logTrace(`Detected Edit Command for target: "${editTarget}"`);
    }

    // Try parsing a dart
    const dart = parseSingleDart(editTarget);
    let finalScore = null;

    if (dart) {
      finalScore = dart.val;
    } else {
      // Try raw number fallback
      finalScore = parseScore(editTarget);
    }

    if (finalScore !== null) {
      logTrace(`Matched Score: ${finalScore}. Preparing Injection...`);
      if (isEditCommand) {
        triggerAutoEdit(finalScore);
      } else {
        // Simulate clicking the box, typing the number, and entering
        simulateScoreEntry(finalScore);
      }
    } else {
      logTrace(`Could not parse: "${transcript}"`);
    }
  }

  // --- DIRECT DOM INJECTION (for iframe / Ghost Mode) ---
  function injectScoreDirectDOM(scoreStr) {
    // DartCounter uses: input[type="text"][inputmode="numeric"][placeholder*="score"]
    let el = document.querySelector('input[inputmode="numeric"]')
        || document.querySelector('input[placeholder*="score"]')
        || document.querySelector('input[type="number"]')
        || document.querySelector('input[type="tel"]');

    if (!el) {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent !== null && !inp.disabled
            && inp.type !== 'hidden' && inp.type !== 'checkbox'
            && inp.type !== 'radio' && inp.type !== 'submit') {
          el = inp;
          break;
        }
      }
    }

    if (el) {
      logTrace("Found DartCounter input element:", el);
      el.focus();
      el.click();

      // Clear any existing value first
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, '');
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));

      // Simulate typing each character (Angular change detection needs this)
      for (const char of scoreStr) {
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: char, code: 'Digit' + char }));
        if (nativeSetter && nativeSetter.set) {
          nativeSetter.set.call(el, el.value + char);
        } else {
          el.value += char;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char, code: 'Digit' + char }));
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));

      // Press Enter to submit the score
      const enterOpts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
      el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
      el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
      el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));

      // Fallback: click the Submit button directly (Angular may ignore synthetic keyboard events)
      // setTimeout(() => {
      //   const submitBtn = document.querySelector('button.submit-button');
      //   if (submitBtn) {
      //     logTrace("Clicking Submit button as fallback...  ");
      //     submitBtn.click();
      //   }
      // }, 100);

      logTrace("Score injected via direct DOM: " + scoreStr);
    } else {
      logTrace("CRITICAL: No input element found in DartCounter DOM!");
    }
  }

  // Retry wrapper — DartCounter may briefly hide the input after a submission
  function injectScoreDirectDOMWithRetry(scoreStr, attempt) {
    attempt = attempt || 1;
    let el = document.querySelector('input[inputmode="numeric"]')
        || document.querySelector('input[placeholder*="score"]');
    if (el) {
      injectScoreDirectDOM(scoreStr);
    } else if (attempt <= 6) {
      logTrace(`Input not found (attempt ${attempt}/6), retrying in 300ms...`);
      setTimeout(() => injectScoreDirectDOMWithRetry(scoreStr, attempt + 1), 300);
    } else {
      logTrace('CRITICAL: Input element not found after 6 retries!');
    }
  }

  // --- UNDO / CANCEL ---
  function triggerUndo() {
    // DartCounter uses Backspace key to undo the last score entry
    logTrace('Triggering undo via Backspace key...');
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8 }));
    document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8 }));

    // Fallback: try clicking an undo button if one exists
    setTimeout(() => {
      const undoBtn = document.querySelector('button[aria-label*="undo"], button[aria-label*="Undo"], .undo-button, [data-testid="undo"]');
      if (undoBtn) {
        logTrace('Found undo button, clicking...');
        undoBtn.click();
      }
    }, 200);
  }

  function simulateScoreEntry(score) {
    // If running inside the iframe, use direct DOM access (no calibration needed)
    if (isIframe) {
      injectScoreDirectDOM(String(score));
      return;
    }

    const x = calibratedCoords.x;
    const y = calibratedCoords.y;

    // Click field to focus
    clickCoordinate(x, y);

    setTimeout(() => {
      let el = document.activeElement;
      
      // Fallback: If activeElement is not an input, try to grab the element exactly at the calibrated point
      if (!el || (el.tagName !== 'INPUT' && !el.isContentEditable)) {
          el = document.elementFromPoint(x, y);
      }

      logTrace("Target Element identified for injection:", el);
      
      if (el && (el.tagName === 'INPUT' || el.isContentEditable)) {
        // High-compatibility insertion for React/Vue/Angular
        if (el.tagName === 'INPUT') {
            el.focus();
            el.select();
            document.execCommand('insertText', false, score);
        } else {
            el.textContent = '';
            el.textContent = score;
        }

        // Dispatch events as secondary fallback
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        // Dispatch Enter key to submit
        logTrace("Dispatching ENTER key events...");
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
      } else {
        logTrace("CRITICAL ERROR: Active Element is NOT an Input or ContentEditable!", el);
      }
    }, 150);
  }

  // --- MIC PRIMING + START ---
  async function startRecognitionWithMic() {
    // Prime Chrome to use the selected mic device before starting speech recognition
    if (dvAuth.micDeviceId) {
      try {
        var stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: dvAuth.micDeviceId } }
        });
        stream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {
        logTrace('Mic prime failed: ' + e.message);
      }
    }
    try { recognition.start(); } catch (e) { }
  }

  toggleMicBtn.addEventListener('click', () => {
    // Block if demo expired and no subscription
    if (!hasActiveSub() && dvAuth.demoUsedMs >= DEMO_LIMIT_MS) {
      showLockout();
      return;
    }

    if (!recognition) initSpeech();

    if (isListening) {
      toggleMicBtn.dataset.intendedState = "off";
      recognition.stop();
    } else {
      toggleMicBtn.dataset.intendedState = "on";
      startRecognitionWithMic();
    }
  });

  closeBtn.addEventListener('click', () => {
    if (recognition && isListening) recognition.stop();
    stopDemoTracking();
    container.remove();
    window.__dartvoiceInjected = false;
  });

  // Make draggable (with position memory — LS key scoped per origin + frame role)
  const POS_KEY = 'dv-overlay-pos-' + (isIframe ? 'iframe' : 'top') + '-' + location.host;
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      container.style.right = 'auto';
      container.style.left = Math.max(0, Math.min(window.innerWidth - 60, saved.x)) + 'px';
      container.style.top  = Math.max(0, Math.min(window.innerHeight - 60, saved.y)) + 'px';
    }
  } catch {}

  let isDragging = false, startX, startY, initialX, initialY;
  panel.addEventListener('mousedown', (e) => {
    // Only enter drag/reorder mode when explicitly enabled by the popup.
    if (!overlayReorderEnabled) return;
    if (e.target && (e.target.tagName === 'BUTTON' || (e.target.className && String(e.target.className).indexOf('close-btn') !== -1))) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = container.offsetLeft;
    initialY = container.offsetTop;
    container.style.right = 'auto'; // Disable right anchor
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    container.style.left = (initialX + e.clientX - startX) + 'px';
    container.style.top = (initialY + e.clientY - startY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: container.offsetLeft, y: container.offsetTop })); } catch {}
  });

  // --- COOKIE AUTO-REJECT (iframe only) ---
  // DartCounter shows a "We use cookies" banner on load. We auto-click Reject All
  // so the scorer is usable instantly. Runs on load + via observer for up to 20s.
  if (isIframe) {
    const REJECT_RE = /^(reject all|reject|decline|deny|refuse|reject cookies|decline all)$/i;
    let cookieTries = 0;
    const cookieTimer = setInterval(() => {
      cookieTries++;
      try {
        const isBanner = el => {
          const t = (el.innerText || '').toLowerCase();
          return /cookie|consent|privacy/.test(t) && /accept|reject|decline|manage|preferences/.test(t);
        };
        const roots = Array.from(document.querySelectorAll(
          '[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i],' +
          ' [role="dialog"], [aria-label*="cookie" i], [aria-label*="consent" i]'
        )).filter(el => el.offsetParent && isBanner(el));
        for (const root of roots) {
          const btns = Array.from(root.querySelectorAll('button, a, [role="button"]')).filter(b => b.offsetParent);
          const hit = btns.find(b => REJECT_RE.test((b.innerText || '').trim()));
          if (hit) { hit.click(); logTrace('Cookie banner: Reject clicked.'); clearInterval(cookieTimer); return; }
        }
      } catch {}
      if (cookieTries > 40) clearInterval(cookieTimer); // ~20s @ 500ms
    }, 500);
  }

  // --- GAME-STATE OBSERVER (iframe only) ---
  // Posts DV_GAME_STATE up to the parent dashboard on any visible change.
  // Best-effort selectors — DartCounter may rename classes; we fall back gracefully.
  if (isIframe) {
    const DV_PARENT = 'https://dartvoice.app';
    let _lastStateJson = '';
    let _lastStateTick = 0;

    function detectMode() {
      const p = location.pathname.toLowerCase();
      if (/cricket/.test(p)) return 'cricket';
      if (/tactics/.test(p)) return 'tactics';
      if (/301/.test(p)) return '301';
      if (/501/.test(p)) return '501';
      if (/701/.test(p)) return '701';
      // Scan visible headings for mode keywords
      try {
        const txt = (document.body && document.body.innerText || '').slice(0, 2000).toLowerCase();
        if (/cricket/.test(txt)) return 'cricket';
        if (/tactics/.test(txt)) return 'tactics';
        if (/\b501\b/.test(txt)) return '501';
        if (/\b301\b/.test(txt)) return '301';
      } catch {}
      return 'unknown';
    }

    function firstText(selectors) {
      for (const s of selectors) {
        try {
          const el = document.querySelector(s);
          if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
        } catch {}
      }
      return '';
    }

    function detectCheckoutModal() {
      try {
        const dlgs = document.querySelectorAll('[role="dialog"], .mat-mdc-dialog-container, .modal, [class*="checkout" i], [class*="finish" i]');
        for (const d of dlgs) {
          if (!d || !d.offsetParent) continue;
          const t = (d.innerText || '').toLowerCase();
          const keyword = /(double|finish|checkout|darts?\s*(at|on|to)\s*(double|finish)|how many darts)/.test(t);
          // Fallback: visible dialog with 1/2/3 buttons (checkout prompt layout)
          let btns123 = false;
          try {
            const labels = Array.from(d.querySelectorAll('button, [role="button"]'))
              .filter(b => b.offsetParent)
              .map(b => (b.innerText || '').trim());
            const has = n => labels.some(l => l === String(n) || new RegExp('^' + n + '\\b').test(l));
            btns123 = has(1) && has(2) && has(3);
          } catch {}
          if (keyword || btns123) {
            return { visible: true, text: d.innerText.slice(0, 300) };
          }
        }
      } catch {}
      return { visible: false };
    }

    function snapshotState() {
      const player = firstText([
        '[data-testid="current-player"]',
        '.current-player-name',
        '[class*="current-player" i]',
        '[class*="active-player" i]'
      ]);
      const remaining = firstText([
        '[data-testid="remaining"]',
        '[class*="remaining-score" i]',
        '[class*="player-score" i] [class*="score" i]'
      ]);
      const checkoutSuggestion = firstText([
        '[class*="checkout-suggestion" i]',
        '[class*="finish" i] [class*="suggestion" i]'
      ]);
      const checkout = detectCheckoutModal();
      return {
        url: location.pathname,
        mode: detectMode(),
        player: player || null,
        remaining: remaining || null,
        checkoutSuggestion: checkoutSuggestion || null,
        checkoutPrompt: checkout.visible ? checkout.text : null,
        ts: Date.now()
      };
    }

    function postState() {
      const now = Date.now();
      if (now - _lastStateTick < 250) return; // throttle
      _lastStateTick = now;
      const s = snapshotState();
      const json = JSON.stringify(s);
      if (json === _lastStateJson) return;
      _lastStateJson = json;
      try { window.parent.postMessage({ type: 'DV_GAME_STATE', state: s }, DV_PARENT); } catch {}
      if (s.checkoutPrompt) {
        try { window.parent.postMessage({ type: 'DV_CHECKOUT_PROMPT', text: s.checkoutPrompt }, DV_PARENT); } catch {}
      }
    }

    // Observe DOM for changes — characterData + subtree captures most SPA updates
    const mo = new MutationObserver(() => { postState(); });
    function startObserving() {
      if (!document.body) { setTimeout(startObserving, 300); return; }
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      postState();
    }
    startObserving();

    // Also emit on URL change (Angular route)
    const _pushState = history.pushState;
    history.pushState = function () { _pushState.apply(this, arguments); setTimeout(postState, 50); };
    window.addEventListener('popstate', () => setTimeout(postState, 50));

    // Handler: parent asks us to submit checkout darts (1/2/3) into DC's modal.
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://dartvoice.app' && event.origin !== 'https://www.dartvoice.app') return;
      const d = event.data || {};
      if (d.type !== 'DV_CHECKOUT_REPLY') return;
      const n = parseInt(d.darts, 10);
      if (!(n >= 1 && n <= 3)) return;
      try {
        // Look for a button labelled exactly the number inside a visible dialog
        const dlgs = document.querySelectorAll('[role="dialog"], .mat-mdc-dialog-container, .modal');
        for (const d2 of dlgs) {
          if (!d2.offsetParent) continue;
          const btns = d2.querySelectorAll('button');
          for (const b of btns) {
            const txt = (b.innerText || '').trim();
            if (txt === String(n) || txt.toLowerCase() === (n === 1 ? 'one' : n === 2 ? 'two' : 'three')) {
              b.click();
              logTrace('DV_CHECKOUT_REPLY: clicked darts=' + n);
              return;
            }
          }
        }
        logTrace('DV_CHECKOUT_REPLY: no matching button found for ' + n);
      } catch (e) { logTrace('DV_CHECKOUT_REPLY failed: ' + e.message); }
    });
  }

  // --- WEB APP BRIDGE LISTENER ---
  const _TRUSTED_ORIGINS = ['https://dartvoice.app', 'https://www.dartvoice.app'];
  window.addEventListener('message', (event) => {
    // Only accept control messages from dartvoice origins. Prevent local dartcounter console exploitation.
    if (!_TRUSTED_ORIGINS.includes(event.origin) && event.origin !== window.location.origin) return;

    if (event.data && event.data.type) {
      // Don't log every ping/pong to avoid console spam, but log data for debugging
      if (event.data.type !== "DARTVOICE_PING") {
          logTrace("Received Window Payload:", event.data);
      }

      // Extension detection handshake — reply so the parent knows we're alive
      if (event.data.type === "DARTVOICE_PING") {
        event.source.postMessage({ type: "DARTVOICE_PONG" }, event.origin);
        return;
      }
      
      if (event.data.type === "DARTVOICE_CALIBRATE_START") {
        startCalibration();
      }
      
      if (event.data.type === "DARTVOICE_SCORE_INJECT") {
        // SECURITY: Exploit prevention. Verify auth status locally in extension before allowing ANY score injection
        if (!hasActiveSub() && dvAuth.demoUsedMs >= DEMO_LIMIT_MS) {
            logTrace("CRITICAL SECURITY: Score injection blocked. Demo expired and no active subscription detected in extension storage.");
            showLockout();
            return;
        }

        const score = event.data.score;

        // Handle cancel/undo command
        if (score === '__CANCEL__') {
          logTrace('Cancel/Undo command received');
          triggerUndo();
          return;
        }

        // Handle auto-edit command
        if (typeof score === 'string' && score.startsWith('__EDIT__')) {
            const editVal = score.replace('__EDIT__:', '').replace('__EDIT__', '');
            logTrace(`Auto-Edit command received via postMessage for score: ${editVal}`);
            triggerAutoEdit(editVal);
            return;
        }

        // In iframe mode, use direct DOM injection (no calibration needed)
        if (isIframe) {
          logTrace(`Iframe received score injection via postMessage: ${score}`);
          injectScoreDirectDOMWithRetry(String(score));
          return;
        }

        if (!calibratedCoords.x || !calibratedCoords.y) {
           logTrace(`Web App sent score: ${score}, but we are NOT CALIBRATED. Ignoring injection.`);
           return;
        }
        
        logTrace(`Web App triggered cross-origin score injection: ${score}`);
        simulateScoreEntry(score);
      }

      // --- IN-PLACE IFRAME NAVIGATION ---
      // Parent dashboard asks us to navigate the Angular SPA without reloading
      // (so cameras / websockets inside the iframe stay connected).
      if (event.data.type === "DV_NAVIGATE" && isIframe) {
        const path = String(event.data.path || '/');
        const requestId = event.data.requestId;
        const replyOrigin = event.origin;
        const replySource = event.source;
        try {
          if (location.pathname + location.search + location.hash !== path) {
            history.pushState({}, '', path);
            // Angular Router (and most SPA routers) listen for popstate.
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
          }
          logTrace(`DV_NAVIGATE → ${path} (in-place, no reload)`);
          if (replySource && requestId) {
            replySource.postMessage({ type: 'DV_NAVIGATE_ACK', requestId, path }, replyOrigin);
          }
        } catch (e) {
          logTrace('DV_NAVIGATE failed: ' + e.message);
        }
      }

      // Simple action relay (e.g. open camera setup). Best-effort — finds a matching
      // clickable element by href/testid. Does NOT reload the iframe either way.
      if (event.data.type === "DV_ACTION" && isIframe) {
        const action = event.data.action;
        try {
          if (action === 'camera') {
            // DartCounter renders the activation dialog via <app-activate-camera-dialog>.
            // Trigger may not be in the DOM yet on cold boots — if the first scan misses,
            // MutationObserver watches for up to 3 s and clicks as soon as it appears.
            const findCameraBtn = () => {
              let el = document.querySelector(
                'app-control-camera-icon, app-control-camera-icon span, [data-testid="camera-setup"], [data-testid*="camera" i],' +
                ' a[href*="camera"], button[aria-label*="amera" i], button[title*="amera" i],' +
                ' ion-button[aria-label*="amera" i], button[class*="camera" i], ion-button[class*="camera" i]'
              );
              if (!el) {
                const candidates = document.querySelectorAll('button, a, ion-button, [role="button"]');
                for (const c of candidates) {
                  if (!c.offsetParent) continue;
                  const label = ((c.getAttribute('aria-label') || '') + ' ' + (c.getAttribute('title') || '') + ' ' + (c.textContent || '')).toLowerCase();
                  if (/\bcamera\b/.test(label)) { el = c; break; }
                  if (c.querySelector('app-control-camera-icon, app-control-camera-icon span, ion-icon[name*="videocam" i], ion-icon[name*="camera" i], [class*="videocam" i], [class*="camera-icon" i]')) { el = c; break; }
                }
              }
              return el;
            };
            const clickIt = (el) => {
              try { el.click(); } catch (e) { }
              try {
                const inner = (typeof el.querySelector === 'function') && (el.querySelector('button, a, ion-button, app-icon, span, div') || el.querySelector('*'));
                if (inner && inner !== el) { try { inner.click(); } catch (e) { } }
                try {
                  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
                  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                } catch (e) { }
              } catch (e) { }
              logTrace('DV_ACTION camera: clicked ' + (el.tagName || '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
            };
            let el = findCameraBtn();
            if (el) { clickIt(el); }
            else {
              logTrace('DV_ACTION camera: not in DOM yet, waiting via MutationObserver...');
              let done = false;
              const mo = new MutationObserver(() => {
                if (done) return;
                const found = findCameraBtn();
                if (found) { done = true; mo.disconnect(); clickIt(found); }
              });
              mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
              setTimeout(() => { if (!done) { mo.disconnect(); logTrace('DV_ACTION camera: observer timed out (3s)'); } }, 3000);
            }
          }
        } catch (e) { logTrace('DV_ACTION failed: ' + e.message); }
      }
    }
  });

  // --- SILENT GHOST MODE FOR IFRAME ---
  // If we are running inside the Scorer Studio iframe, we want to be INVISIBLE.
  // The Parent Dashboard handles the UI.
  if (isIframe) {
      container.style.display = 'none';
      logTrace("GHOST MODE ENGAGED: Extension running silently inside iframe.");
  }

  // --- CHROME RUNTIME MESSAGE LISTENER ---
  // Receives config from popup (DV_INIT_CONFIG) when launched manually
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (msg.type === 'DV_INIT_CONFIG') {
        dvAuth.email = msg.email;
        dvAuth.sub = msg.sub;
        dvAuth.demoUsedMs = msg.demoUsedMs || 0;
        dvAuth.micDeviceId = msg.micDeviceId || null;
        if (!isIframe && !isDartVoiceParent) {
          updateDemoUI();
          if (dvAuth.micDeviceId && micSelect) micSelect.value = dvAuth.micDeviceId;
          if (!hasActiveSub() && dvAuth.demoUsedMs >= DEMO_LIMIT_MS) showLockout();
          else hideLockout();
        }
        sendResponse({ ok: true });
        return;
      }
      // Toggle overlay reorder/dragging mode — controlled from popup UI.
      if (msg.type === 'DV_SET_REORDER' || msg.type === 'DV_TOGGLE_REORDER') {
        try {
          overlayReorderEnabled = !!msg.enable;
          container.classList.toggle('dv-reorder-active', overlayReorderEnabled);
          // Clear any existing auto-disable timer
          try { if (overlayReorderTimer) { clearTimeout(overlayReorderTimer); overlayReorderTimer = null; } } catch (e) {}
          // If popup requested a duration, set an auto-disable to avoid leaving reorder on indefinitely
          const duration = (typeof msg.duration === 'number' && msg.duration > 0) ? msg.duration : 0;
          if (overlayReorderEnabled && duration > 0) {
            try {
              overlayReorderTimer = setTimeout(() => {
                overlayReorderEnabled = false;
                try { container.classList.remove('dv-reorder-active'); } catch (e) {}
                overlayReorderTimer = null;
                logTrace('Overlay reorder auto-disabled after timeout');
              }, duration);
            } catch (e) { overlayReorderTimer = null; }
          }
        } catch (e) {}
        try { sendResponse({ ok: true, enabled: overlayReorderEnabled }); } catch (e) {}
        return;
      }
    });
  } catch (e) { }

  // --- LIVE AUTH/SUB UPDATES VIA STORAGE ---
  // When user signs in on dartvoice.app, auth-bridge updates chrome.storage.
  // We listen for those changes and automatically unlock the overlay.
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (changes.dv_sub_status) {
        dvAuth.sub = changes.dv_sub_status.newValue || null;
        if (hasActiveSub()) hideLockout();
      }
      if (changes.dv_user_email) {
        dvAuth.email = changes.dv_user_email.newValue || null;
      }
      if (changes.dv_mic_device_id) {
        dvAuth.micDeviceId = changes.dv_mic_device_id.newValue || null;
        if (micSelect) micSelect.value = dvAuth.micDeviceId || '';
      }
      if (!isIframe && !isDartVoiceParent) updateDemoUI();
    });
  } catch (e) { }

})();
