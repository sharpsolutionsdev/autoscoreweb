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

  const isDartVoiceParent = window.location.href.includes('web-app') || window.location.href.includes('dartvoice-dashboard');
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
      <a href="https://dartvoice.app/login" target="_blank">Sign In →</a>
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

    // Don't run voice on the DartVoice parent page - web-app handles it
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

  function _isVisible(el) {
    return !!el && !!el.offsetParent;
  }

  function _clickLikeUser(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
    try { el.click(); } catch (e) {}
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch (e) {}
    return true;
  }

  function _setInputValueFrameworkSafe(input, value) {
    if (!input) return false;
    const val = String(value);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    try { input.focus(); input.click(); } catch (e) {}
    if (setter && setter.set) {
      setter.set.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      setter.set.call(input, val);
    } else {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = val;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function _findModalSaveButton(dialog) {
    if (!dialog) return null;
    const buttons = Array.from(dialog.querySelectorAll('button, [role="button"], span'));
    for (const el of buttons) {
      if (!_isVisible(el)) continue;
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute && (el.getAttribute('aria-label') || '') || '').toLowerCase();
      if (t === 'save' || aria.includes('save')) {
        return el.closest('button') || el;
      }
    }
    return null;
  }

  function _openDartCounterEditUI() {
    // Strategy:
    //   1) Prefer the LATEST score-history row's edit affordance (matches user
    //      intent "edit the most recent score").
    //   2) Fall back to scoreboard pencils, iterated LAST→FIRST so we don't
    //      hit a stale/older player row.
    //
    // Returns true if a click was dispatched.

    // 1) Score-history row first.
    try {
      const rows = document.querySelectorAll(
        'app-score-list app-score-list-item, ' +
        'app-score-history app-score-history-item, ' +
        'app-match-history li, ' +
        '[class*="score-list"] [class*="row"], ' +
        '[class*="history"] [class*="row"]'
      );
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (!_isVisible(r)) continue;
        const trig = r.querySelector(
          'button[aria-label*="edit" i], button[title*="edit" i], dc-icon, ' +
          'ion-icon[name*="pencil" i], ion-icon[name*="create" i], ' +
          'svg[class*="pencil" i], svg[class*="edit" i]'
        );
        const target = trig && (trig.closest('button') || trig.closest('[role="button"]') || trig);
        if (target && _isVisible(target)) {
          _clickLikeUser(target);
          logTrace('AUTO-EDIT: clicked latest score-history edit trigger');
          return true;
        }
      }
    } catch(_){}

    // 2) Scoreboard pencil fallbacks.
    const candidates = [
      ...document.querySelectorAll(
        'button[aria-label*="edit" i], button[title*="edit" i], .edit-score-button, [data-testid*="edit" i], app-match-team-score button, div.pl-4 > div.relative'
      ),
      ...document.querySelectorAll('div.pl-4 > div.relative svg, app-match-team-score dc-icon svg')
    ];
    try {
      const teamScores = document.querySelectorAll('app-match-team-score, app-remaining-score');
      teamScores.forEach(ts => {
        const root = ts.parentElement || ts;
        const icons = root.querySelectorAll(
          'dc-icon, ion-icon[name*="pencil" i], ion-icon[name*="create" i], svg[class*="pencil" i], svg[class*="edit" i]'
        );
        icons.forEach(ic => candidates.push(ic));
      });
    } catch(_){}

    // Iterate LAST→FIRST: most recently rendered/scoring row wins.
    for (let i = candidates.length - 1; i >= 0; i--) {
      const raw = candidates[i];
      const el = raw && raw.closest ? (raw.closest('button') || raw.closest('[role="button"]') || raw) : raw;
      if (_isVisible(el)) {
        _clickLikeUser(el);
        logTrace('AUTO-EDIT: clicked DartCounter edit trigger (most-recent)');
        return true;
      }
    }
    return false;
  }

  function _tryDartCounterModalEdit(score, attempt, onDone) {
    const maxAttempts = 15;
    const dialog =
      document.querySelector('[id^="ion-overlay-"] app-edit-match-scores-dialog') ||
      document.querySelector('app-edit-match-scores-dialog') ||
      // New 2026 DartCounter shell: dialog is rendered as a generic overlay
      // with no app-* tag. Detect by the presence of accordion-header rows
      // (each turn is a collapsible row) inside any visible overlay.
      (function(){
        const overlays = document.querySelectorAll(
          '[id^="ion-overlay-"], [class*="cdk-overlay"], [role="dialog"], dialog'
        );
        for (const o of overlays) {
          if (_isVisible(o) && o.querySelector('[accordion-header]')) return o;
        }
        return null;
      })();

    if (dialog && _isVisible(dialog)) {
      // Locate every "turn" row. Newer DartCounter exposes a
      // `[accordion-header]` element nested inside a clickable parent. We
      // pick the element-with-input-when-expanded by walking from the
      // header up to its expandable container.
      let accordions = Array.from(dialog.querySelectorAll('app-accordion'));
      if (!accordions.length) {
        const headers = Array.from(dialog.querySelectorAll('[accordion-header]'));
        accordions = headers.map(h => {
          // Walk up to the nearest container that holds both the header and
          // its expandable body. The clickable parent has class "cursor-pointer".
          return (
            h.closest('[dctypography]') ||
            h.closest('.cursor-pointer') ||
            h.parentElement ||
            h
          );
        });
      }
      const lastAccordion = accordions.length > 0 ? accordions[accordions.length - 1] : null;

      if (lastAccordion) {
        // Look for the input both inside the accordion AND in its next-sibling
        // (the expanded body is sometimes rendered as a sibling, not a child).
        const inputIn = (root) => root && (
          root.querySelector('input[aria-label="ENTER_NEW_VALUE"]') ||
          root.querySelector('input[inputmode="numeric"]') ||
          root.querySelector('input[type="number"]') ||
          root.querySelector('input[type="text"]') ||
          root.querySelector('input')
        );
        let input = inputIn(lastAccordion) || inputIn(lastAccordion.nextElementSibling) || inputIn(lastAccordion.parentElement);
        if (input && _isVisible(input)) {
          _setInputValueFrameworkSafe(input, score);
          // Save button (new shell): `<button dcbutton dcbgcolor="oche-orange">`
          // with a child <span>Save</span>. Older shells used aria-label.
          const findSave = (root) => {
            if (!root) return null;
            // Prefer dcbutton with "oche-orange" colour (used for primary CTA).
            const orange = root.querySelector('button[dcbutton][dcbgcolor="oche-orange"]');
            if (orange && _isVisible(orange)) return orange;
            // Match by inner text "Save".
            const buttons = root.querySelectorAll('button[dcbutton], button');
            for (const b of buttons) {
              if (!_isVisible(b)) continue;
              const t = (b.textContent || '').trim().toLowerCase();
              if (t === 'save' || t.startsWith('save')) return b;
            }
            return root.querySelector('button[aria-label="Save" i]');
          };
          const saveBtn =
            findSave(dialog) ||
            _findModalSaveButton(dialog) ||
            lastAccordion.querySelector('button');
          if (saveBtn && _isVisible(saveBtn)) {
            setTimeout(() => {
              _clickLikeUser(saveBtn);
              logTrace(`AUTO-EDIT: save clicked with score ${score}`);
              onDone(true);
            }, 150);
            return;
          }
        } else if (attempt <= 4) {
          // Accordion not expanded — click the clickable header row.
          const header = lastAccordion.querySelector('[accordion-header]') || lastAccordion;
          const clickTarget =
            header.closest('button') ||
            header.closest('[role="button"]') ||
            // The wrapper div carries `cursor-pointer` and is the actual click
            // target in the new DartCounter shell.
            (header.classList && header.classList.contains('cursor-pointer') ? header : null) ||
            lastAccordion.querySelector('.cursor-pointer') ||
            lastAccordion;
          if (clickTarget && _isVisible(clickTarget)) {
            _clickLikeUser(clickTarget);
            logTrace('AUTO-EDIT: expanded last accordion (turn row)');
          }
        }
      } else {
        // No accordions found — try direct input approach as a last resort,
        // but ONLY if the dialog has a single input (otherwise we'd risk
        // editing the wrong turn).
        const inputs = Array.from(dialog.querySelectorAll('input')).filter(_isVisible);
        if (inputs.length === 1) {
          const input = inputs[0];
          _setInputValueFrameworkSafe(input, score);
          const saveBtn = _findModalSaveButton(dialog);
          if (saveBtn) {
            _clickLikeUser(saveBtn);
            logTrace(`AUTO-EDIT: direct save with score ${score}`);
            onDone(true);
            return;
          }
        }
      }
    } else if (attempt === 0) {
      _openDartCounterEditUI();
    }

    if (attempt < maxAttempts) {
      setTimeout(() => _tryDartCounterModalEdit(score, attempt + 1, onDone), 250);
      return;
    }
    onDone(false);
  }

  function _fallbackAutoEdit(score) {
    // Last-resort path preserves old behavior for unknown UI shapes.
    logTrace(`AUTO-EDIT fallback: undo + reinject ${score}`);
    triggerUndo();
    setTimeout(() => {
      simulateScoreEntry(score);
    }, 400);
  }

  function triggerAutoEdit(score) {
    const parsed = parseInt(String(score), 10);
    const cleanScore = (!isNaN(parsed) && parsed >= 0 && parsed <= 180) ? String(parsed) : String(score);

    // Re-entry guard: rapid double-fire (e.g. duplicate postMessage from
    // two listeners, or accidental repeat from voice mis-trigger) was
    // opening the edit modal twice. Coalesce to a single in-flight pass.
    //
    // Two layers:
    //   1) __dvAutoEditBusy — true from start until 1.5s after settle, blocks
    //      ANY new trigger including identical scores.
    //   2) __dvAutoEditLastKey — same {score} within 2.5s is ignored even if
    //      the busy flag has cleared (covers the case where voice + the host
    //      postMessage arrive separated by a brief window).
    const now = Date.now();
    const key = `s:${cleanScore}`;
    if (window.__dvAutoEditBusy) {
      logTrace(`AUTO-EDIT: ignored duplicate trigger for ${cleanScore} (in-flight)`);
      return;
    }
    if (window.__dvAutoEditLastKey === key && (now - (window.__dvAutoEditLastAt || 0)) < 2500) {
      logTrace(`AUTO-EDIT: ignored duplicate trigger for ${cleanScore} (within debounce)`);
      return;
    }
    window.__dvAutoEditBusy = true;
    window.__dvAutoEditLastKey = key;
    window.__dvAutoEditLastAt = now;
    logTrace(`Executing AUTO-EDIT (DartCounter modal first) for ${cleanScore}`);

    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (!ok) _fallbackAutoEdit(cleanScore);
      // Release the busy flag after a longer cooldown so the *second* of two
      // racing triggers (voice + host postMessage) is reliably swallowed.
      setTimeout(() => { window.__dvAutoEditBusy = false; }, 1500);
    };

    _tryDartCounterModalEdit(cleanScore, 0, finish);

    // Guard timeout: if the modal pathway hangs, force fallback.
    setTimeout(() => finish(false), 4500);
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
      // Strongest signal: cricket-specific Angular components in the DOM
      try {
        if (document.querySelector('app-cricket-tactics-keyboard, app-cricket-tactics-team-score, app-cricket-tactics-online-gameplay, app-cricket-tactics-score-input')) return 'cricket';
      } catch {}
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

    function normalizeSpace(v) {
      return String(v || '').replace(/\s+/g, ' ').trim();
    }

    function firstText(selectors) {
      for (const s of selectors) {
        try {
          const nodes = document.querySelectorAll(s);
          for (const el of nodes) {
            if (!_isVisible(el)) continue;
            const t = normalizeSpace(el.textContent);
            if (t) return t;
          }
        } catch {}
      }
      return '';
    }

    function pickRemainingFromText(text, mode) {
      const clean = normalizeSpace(text);
      if (!clean) return null;
      const nums = (clean.match(/\d{1,4}/g) || [])
        .map((n) => parseInt(n, 10))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 999);
      if (!nums.length) return null;

      const modeNum = parseInt(String(mode || ''), 10);
      const capped = nums.filter((n) => n <= 701);
      if (!capped.length) return null;

      if (!isNaN(modeNum) && modeNum > 0) {
        const withinMode = capped.filter((n) => n <= modeNum);
        if (withinMode.length) {
          const exact = withinMode.find((n) => n === modeNum);
          return String(typeof exact === 'number' ? exact : withinMode[withinMode.length - 1]);
        }
      }
      return String(capped[capped.length - 1]);
    }

    function splitPlayerAndRemaining(rawPlayer, rawRemaining, mode) {
      let player = normalizeSpace(rawPlayer);
      let remaining = normalizeSpace(rawRemaining);

      if (remaining) {
        const rem = pickRemainingFromText(remaining, mode);
        remaining = rem || remaining;
      }
      if (!remaining && player) {
        remaining = pickRemainingFromText(player, mode);
      }

      if (player) {
        if (remaining) {
          const esc = remaining.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          player = normalizeSpace(
            player
              .replace(new RegExp(`\\b${esc}\\b`, 'g'), ' ')
              .replace(new RegExp(`${esc}(?=\\D|$)`, 'g'), ' ')
          );
        }
        player = normalizeSpace(
          player
            .replace(/\b(player|remaining|score|points?|turn)\b/gi, ' ')
            .replace(/[|:()[\]{}]+/g, ' ')
        );
        if (!/[a-z]/i.test(player)) player = '';
      }

      return {
        player: player || null,
        remaining: remaining || null
      };
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

    // --- DartCounter DOM-aware structured scraper ---
    // Uses actual DC Angular component selectors for reliable extraction.
    function scrapePlayerColumn(col) {
      if (!col) return null;
      const result = { name: null, remaining: null, avg: null, last: null, darts: null, checkout: null, first9: null, bestLeg: null, count180: null, count140: null, count100: null, checkoutPercent: null };
      try {
        // Player name: div[appingameplayername]
        const nameEl = col.querySelector('div[appingameplayername], [appingameplayername]');
        if (nameEl) result.name = normalizeSpace(nameEl.textContent);

        // Remaining score: app-remaining-score
        const remEl = col.querySelector('app-remaining-score');
        if (remEl) {
          const remText = normalizeSpace(remEl.textContent);
          const remNum = remText.match(/\d+/);
          if (remNum) result.remaining = remNum[0];
        }

        // Checkout suggestion: app-match-checkout-suggestion
        const coEl = col.querySelector('app-match-checkout-suggestion');
        if (coEl) {
          const coText = normalizeSpace(coEl.textContent);
          if (coText && coText.trim() && !/^\s*$/.test(coText) && coText !== '\u00a0') {
            result.checkout = coText;
          }
        }

        // Stats: app-match-team-stats rows.
        // DartCounter renders stats as <app-in-game-stat-item> rows whose
        // children include a <div appingamestatlabel> and a sibling value
        // <div>. The number of stat rows changes with the layout (collapsed
        // vs expanded sidebar shows 3 vs 6 rows), so we MUST extract by
        // label, never by index.
        const statRows = col.querySelectorAll(
          'app-in-game-stat-item, .in-game-stats-spacing,' +
          ' app-match-team-stats .in-game-stat-items-container > div'
        );
        for (const row of statRows) {
          const labelEl = row.querySelector('[appingamestatlabel], div[appingamestatlabel]');
          if (!labelEl) continue;
          const label = normalizeSpace(labelEl.textContent).toLowerCase();
          // Value is any sibling element that is NOT the label and contains
          // a digit. We try a few strategies because DC's layout differs
          // between collapsed and expanded sidebar states.
          let valText = '';
          // Strategy 1: explicit value attr / data-testid
          const explicit = row.querySelector('[appingamestatvalue], [data-testid*="stat-value" i]');
          if (explicit) valText = normalizeSpace(explicit.textContent);
          // Strategy 2: last direct-child div whose text differs from the label
          if (!valText) {
            const directDivs = row.querySelectorAll(':scope > div');
            for (let i = directDivs.length - 1; i >= 0; i--) {
              const t = normalizeSpace(directDivs[i].textContent);
              if (t && t !== label && /\d/.test(t) && t !== normalizeSpace(labelEl.textContent)) {
                valText = t; break;
              }
            }
          }
          // Strategy 3: any descendant whose text contains digits and isn't the label
          if (!valText) {
            const candidates = row.querySelectorAll('div, span');
            for (const c of candidates) {
              if (c === labelEl || labelEl.contains(c) || c.contains(labelEl)) continue;
              const t = normalizeSpace(c.textContent);
              if (t && /\d/.test(t) && t.length <= 12) { valText = t; break; }
            }
          }
          if (!valText || valText === '-') continue;

          if (/3-dart\s*avg/i.test(label) || (label === '' && !result.avg)) {
            const m = valText.match(/[\d.]+/);
            if (m) result.avg = m[0];
          } else if (/first\s*9/i.test(label)) {
            const m = valText.match(/[\d.]+/);
            if (m) result.first9 = m[0];
          } else if (/last\s*score/i.test(label)) {
            const m = valText.match(/\d+/);
            if (m) result.last = m[0];
          } else if (/darts?\s*thrown/i.test(label)) {
            const m = valText.match(/\d+/);
            if (m) result.darts = m[0];
          } else if (/best\s*leg/i.test(label)) {
            const m = valText.match(/\d+/);
            if (m) result.bestLeg = m[0];
          } else if (/180s?/i.test(label) || label === '180') {
            const m = valText.match(/\d+/);
            if (m) result.count180 = m[0];
          } else if (/140\+/i.test(label)) {
            const m = valText.match(/\d+/);
            if (m) result.count140 = m[0];
          } else if (/100\+/i.test(label)) {
            const m = valText.match(/\d+/);
            if (m) result.count100 = m[0];
          } else if (/checkout\s*%/i.test(label) || label === 'co %') {
            const m = valText.match(/[\d.]+/);
            if (m) result.checkoutPercent = m[0];
          }
        }
      } catch (e) {}
      return result;
    }

    // --- Cricket / Tactics scoreboard scraper ---
    // DartCounter renders the cricket scoreboard inside <app-cricket-tactics-keyboard>.
    // Each row container has classes ".flex.flex-1.flex-row.items-center.rounded-xl"
    // and gains "isClosed" when closed_by_all.
    // Children layout (web, 2 teams): [team0-marks][center-number-buttons][team1-marks]
    // Mark icons: <app-icon icon="tactics_one|tactics_two|tactics_full"> = 1/2/3 closed.
    // Total points: <app-cricket-tactics-team-score> contains a span with bulevar-80 typography.
    function scrapeCricketBoard() {
      try {
        const kb = document.querySelector('app-cricket-tactics-keyboard');
        if (!kb || !kb.offsetParent) return null;
        // Find rows by class signature
        const rows = Array.from(kb.querySelectorAll('div.rounded-xl.flex.flex-row.items-center, div.flex.flex-row.items-center.rounded-xl, div.flex.flex-1.flex-row.items-center.rounded-xl'))
          .filter(el => el.querySelector('button') && el.offsetParent);
        const numbers = [];
        for (const row of rows) {
          const closed = row.classList.contains('isClosed');
          // Extract center label
          let label = null;
          const btns = row.querySelectorAll('button');
          for (const b of btns) {
            const t = (b.textContent || '').replace(/[^0-9A-Za-z]/g, '').trim();
            const m = t.match(/^(\d+|B|Bull)/i);
            if (m) { label = m[1].toUpperCase(); break; }
          }
          if (!label) continue;
          const value = (label === 'B' || /^bull$/i.test(label)) ? 25 : parseInt(label, 10);
          if (!value) continue;
          // Walk row children; team mark cells appear before/after the center button cell.
          const kids = Array.from(row.children).filter(c => c.offsetParent);
          let centerSeen = false;
          const before = []; const after = [];
          for (const c of kids) {
            if (c.querySelector && c.querySelector('button') && (/^\d+|B|Bull/i).test((c.textContent||'').trim())) {
              centerSeen = true; continue;
            }
            (centerSeen ? after : before).push(c);
          }
          function countMarks(cells) {
            let max = 0;
            for (const cell of cells) {
              const ic = cell.querySelector && cell.querySelector('app-icon[icon^="tactics_"]');
              if (!ic) continue;
              const name = ic.getAttribute('icon') || '';
              const ct = name === 'tactics_full' ? 3 : name === 'tactics_two' ? 2 : name === 'tactics_one' ? 1 : 0;
              if (ct > max) max = ct;
            }
            return max;
          }
          const team0Marks = countMarks(before);
          const team1Marks = countMarks(after);
          numbers.push({ value, label: value === 25 ? 'Bull' : String(value), closed, marks: [team0Marks, team1Marks] });
        }
        if (!numbers.length) return null;
        // Sort canonically: 20,19,18,17,16,15,(14..10 if tactics),Bull(25)
        numbers.sort((a, b) => {
          if (a.value === 25) return 1;
          if (b.value === 25) return -1;
          return b.value - a.value;
        });
        // Total points per team from app-cricket-tactics-team-score
        const totals = [];
        const teamScores = Array.from(document.querySelectorAll('app-cricket-tactics-team-score'))
          .filter(el => el.offsetParent);
        for (const ts of teamScores) {
          const txt = (ts.textContent || '').replace(/\s+/g, ' ').trim();
          const m = txt.match(/-?\d+/);
          totals.push(m ? parseInt(m[0], 10) : 0);
        }
        // Active team detection: the keyboard renders a triangle marker
        // (border-t-oche-orange) above the active team's column.
        let activeTeam = null;
        try {
          const triangles = kb.querySelectorAll('[class*="border-t-oche-orange"], [class*="border-t-orange"]');
          if (triangles.length) {
            // Find triangle's nearest row-children to determine which side it sits on.
            const tri = triangles[0];
            const row = tri.closest('div.flex.flex-row.items-center.rounded-xl, div.flex.flex-1.flex-row.items-center.rounded-xl, div.rounded-xl.flex.flex-row.items-center');
            if (row) {
              const kids = Array.from(row.children);
              let triIdx = -1;
              for (let i = 0; i < kids.length; i++) { if (kids[i] === tri || kids[i].contains(tri)) { triIdx = i; break; } }
              const centerIdx = kids.findIndex(c => c.querySelector && c.querySelector('button'));
              if (triIdx >= 0 && centerIdx >= 0) activeTeam = triIdx < centerIdx ? 0 : 1;
            }
          }
        } catch {}
        return { numbers, totals, closedByAll: numbers.filter(n => n.closed).map(n => n.value), activeTeam };
      } catch (e) { return null; }
    }

    function snapshotState() {
      const mode = detectMode();
      const checkout = detectCheckoutModal();

      // --- Primary: DOM-based structured scraping ---
      // DartCounter uses two .current-player-arrow columns (left=P1, right=P2)
      let p1Data = null;
      let p2Data = null;
      let activePlayerIdx = 0;

      try {
        const columns = document.querySelectorAll('.current-player-arrow');
        if (columns.length >= 2) {
          p1Data = scrapePlayerColumn(columns[0]);
          p2Data = scrapePlayerColumn(columns[1]);

          // Detect active player: .show-arrow class or .current-turn inside details
          for (let i = 0; i < columns.length; i++) {
            if (columns[i].classList.contains('show-arrow') ||
                columns[i].querySelector('.current-turn')) {
              activePlayerIdx = i;
              break;
            }
          }
        } else {
          // Fallback: try app-match-team-score components
          const teamScores = document.querySelectorAll('app-match-team-score');
          if (teamScores.length >= 2) {
            p1Data = scrapePlayerColumn(teamScores[0].closest('.current-player-arrow') || teamScores[0].parentElement);
            p2Data = scrapePlayerColumn(teamScores[1].closest('.current-player-arrow') || teamScores[1].parentElement);
          }
        }
      } catch (e) {}

      // --- Fallback: legacy selector-based extraction ---
      if (!p1Data || (!p1Data.remaining && !p1Data.name)) {
        const rawPlayer = firstText([
          '[data-testid="current-player"]',
          '.current-player-name',
          '[class*="current-player" i]',
          'div[appingameplayername]'
        ]);
        const rawRemaining = firstText([
          'app-remaining-score',
          '[data-testid="remaining"]',
          '[class*="remaining-score" i]'
        ]);
        const parsed = splitPlayerAndRemaining(rawPlayer, rawRemaining, mode);
        if (!p1Data) p1Data = { name: null, remaining: null, avg: null, last: null, darts: null, checkout: null };
        if (!p1Data.name && parsed.player) p1Data.name = parsed.player;
        if (!p1Data.remaining && parsed.remaining) p1Data.remaining = parsed.remaining;
      }

      // Build the active player's remaining (for legacy compat)
      const activeData = activePlayerIdx === 0 ? p1Data : p2Data;
      const activeRemaining = activeData ? activeData.remaining : (p1Data ? p1Data.remaining : null);
      const activeName = activeData ? activeData.name : (p1Data ? p1Data.name : null);

      // Checkout suggestion from active player or general
      let checkoutSuggestion = null;
      if (p1Data && p1Data.checkout) checkoutSuggestion = p1Data.checkout;
      if (p2Data && p2Data.checkout && !checkoutSuggestion) checkoutSuggestion = p2Data.checkout;
      if (!checkoutSuggestion) {
        checkoutSuggestion = firstText([
          'app-match-checkout-suggestion',
          '[class*="checkout-suggestion" i]'
        ]) || null;
      }

      return {
        url: location.pathname,
        mode,
        player: activeName,
        remaining: activeRemaining,
        activePlayer: activePlayerIdx,
        p1Name: p1Data ? p1Data.name : null,
        p2Name: p2Data ? p2Data.name : null,
        p1Stats: p1Data ? {
          remaining: p1Data.remaining,
          avg: p1Data.avg,
          last: p1Data.last,
          darts: p1Data.darts,
          checkout: p1Data.checkout,
          first9: p1Data.first9,
          bestLeg: p1Data.bestLeg,
          count180: p1Data.count180,
          count140: p1Data.count140,
          count100: p1Data.count100,
          checkoutPercent: p1Data.checkoutPercent
        } : null,
        p2Stats: p2Data ? {
          remaining: p2Data.remaining,
          avg: p2Data.avg,
          last: p2Data.last,
          darts: p2Data.darts,
          checkout: p2Data.checkout,
          first9: p2Data.first9,
          bestLeg: p2Data.bestLeg,
          count180: p2Data.count180,
          count140: p2Data.count140,
          count100: p2Data.count100,
          checkoutPercent: p2Data.checkoutPercent
        } : null,
        checkoutSuggestion,
        checkoutPrompt: checkout.visible ? checkout.text : null,
        cricketState: (function(){
          // Detect cricket presence robustly via DOM, not just URL/text.
          if (!document.querySelector('app-cricket-tactics-keyboard, app-cricket-tactics-team-score, app-cricket-tactics-online-gameplay, app-cricket-tactics-score-input')) return null;
          const cs = scrapeCricketBoard();
          // Surface cricket active team into top-level activePlayer when X01 detection didn't find one.
          if (cs && (cs.activeTeam === 0 || cs.activeTeam === 1)) {
            try { /* mutate outer object after-the-fact via closure */ } catch {}
          }
          return cs;
        })(),
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

      // Fill DartCounter chat input with a referral message from the parent.
      // Sent by web-app.html's "Paste in DartCounter chat" button.
      // We try several known DartCounter chat selectors, fall back to any
      // visible textarea/input matching common chat patterns. The message is
      // also already on the user's clipboard, so failure is recoverable.
      if (event.data.type === "DV_FILL_CHAT") {
        const text = String(event.data.text || '');
        if (!text) return;
        try {
          const candidates = [
            'app-chat textarea', 'app-chat input',
            'textarea[placeholder*="message" i]',
            'input[placeholder*="message" i]',
            'textarea[placeholder*="chat" i]',
            'input[placeholder*="chat" i]',
            '.chat-input textarea', '.chat-input input',
            '[data-test*="chat"] textarea', '[data-test*="chat"] input'
          ];
          let target = null;
          for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) { target = el; break; }
          }
          if (target) {
            const setter = Object.getOwnPropertyDescriptor(target.__proto__, 'value')?.set;
            setter ? setter.call(target, text) : (target.value = text);
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            target.focus();
            logTrace('DV_FILL_CHAT: filled chat input');
          } else {
            logTrace('DV_FILL_CHAT: no chat input found — clipboard fallback');
          }
        } catch (e) { logTrace('DV_FILL_CHAT failed: ' + e.message); }
        return;
      }

      // Volume control from parent dashboard. We persist the desired volume
      // and apply it to any newly-created media elements as well — DartCounter
      // creates <audio> elements on demand for celebration sounds.
      if (event.data.type === "dv-set-volume") {
        const vol = Math.max(0, Math.min(1, parseFloat(event.data.volume) || 1));
        try { window.__dvDesiredVolume = vol; } catch(e){}
        const apply = (el) => { try { el.volume = vol; el.muted = vol === 0; } catch(e){} };
        document.querySelectorAll('audio, video').forEach(apply);
        if (!window.__dvVolumeObserver) {
          try {
            const mo = new MutationObserver((mutations) => {
              const v = window.__dvDesiredVolume;
              if (v == null) return;
              for (const m of mutations) {
                m.addedNodes && m.addedNodes.forEach(n => {
                  if (!(n instanceof Element)) return;
                  if (n.tagName === 'AUDIO' || n.tagName === 'VIDEO') {
                    try { n.volume = v; n.muted = v === 0; } catch(e){}
                    n.addEventListener('loadedmetadata', () => { try { n.volume = window.__dvDesiredVolume; n.muted = window.__dvDesiredVolume === 0; } catch(e){} });
                    n.addEventListener('play', () => { try { n.volume = window.__dvDesiredVolume; n.muted = window.__dvDesiredVolume === 0; } catch(e){} });
                  } else if (n.querySelectorAll) {
                    n.querySelectorAll('audio, video').forEach(el => { try { el.volume = v; el.muted = v === 0; } catch(e){} });
                  }
                });
              }
            });
            mo.observe(document.documentElement, { childList: true, subtree: true });
            window.__dvVolumeObserver = mo;
            // Patch HTMLMediaElement.play so even media that bypasses DOM mutation gets it
            try {
              const origPlay = HTMLMediaElement.prototype.play;
              HTMLMediaElement.prototype.play = function() {
                try {
                  if (window.__dvDesiredVolume != null) {
                    this.volume = window.__dvDesiredVolume;
                    this.muted = window.__dvDesiredVolume === 0;
                  }
                } catch(e){}
                return origPlay.apply(this, arguments);
              };
            } catch(e){}
          } catch(e){}
        }
        logTrace('Volume set to ' + Math.round(vol * 100) + '% (persistent)');
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

      // --- AUTO-ADD A DARTCOUNTER FRIEND ---
      // Parent posts { type:'DV_ADD_DC_FRIEND', username:'<dc handle>' }.
      // We navigate the iframe to /friends, type the username into the
      // search/add-by-username input, and click the "Add" / submit button.
      // Best-effort heuristics — DartCounter's UI may shift, so we try a
      // generous selector list and abort gracefully on miss.
      if (event.data.type === "DV_ADD_DC_FRIEND" && isIframe) {
        const usernameRaw = String(event.data.username || '').trim();
        const replyOrigin = event.origin;
        const replySource = event.source;
        const reply = (ok, msg) => {
          try { replySource && replySource.postMessage({ type: 'DV_ADD_DC_FRIEND_ACK', ok, msg }, replyOrigin); } catch(_){}
        };
        if (!usernameRaw) { reply(false, 'no_username'); return; }
        logTrace(`DV_ADD_DC_FRIEND → @${usernameRaw}`);

        // Navigate to /friends if not already there.
        try {
          if (!/\/friends/.test(location.pathname)) {
            history.pushState({}, '', '/friends');
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
          }
        } catch(_){}

        // Poll for the input field, then type + submit.
        const deadline = Date.now() + 5000;
        const tryFill = () => {
          // Heuristic: any visible text/search input on the friends page.
          const inputs = Array.from(document.querySelectorAll(
            'input[type="text"], input[type="search"], input:not([type]),' +
            ' input[placeholder*="username" i], input[placeholder*="friend" i],' +
            ' input[placeholder*="name" i], input[aria-label*="username" i],' +
            ' input[aria-label*="friend" i]'
          )).filter(el => el.offsetParent !== null);
          const input = inputs[0];
          if (!input) {
            if (Date.now() < deadline) return setTimeout(tryFill, 200);
            reply(false, 'no_input_found');
            return;
          }
          // Set value via the native setter so Angular sees the change.
          try {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, usernameRaw);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.focus();
          } catch (e) { logTrace('add-friend: input fill failed: ' + e.message); }

          // Submit: press Enter, then look for an Add button.
          setTimeout(() => {
            try {
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            } catch(_){}
            // Try to click an explicit "Add" button if present.
            const btns = Array.from(document.querySelectorAll('button, ion-button, [role="button"]'));
            const addBtn = btns.find(b => {
              const t = ((b.getAttribute('aria-label')||'') + ' ' + (b.textContent||'')).toLowerCase();
              return /\b(add|invite|send request|add friend)\b/.test(t) && b.offsetParent !== null;
            });
            if (addBtn) { try { addBtn.click(); } catch(_){} }
            reply(true, addBtn ? 'submitted' : 'enter_only');
          }, 220);
        };
        setTimeout(tryFill, 250);
      }

      // Simple action relay (e.g. open camera setup). Best-effort — finds a matching
      // clickable element by href/testid. Does NOT reload the iframe either way.
      if (event.data.type === "DV_ACTION" && isIframe) {
        const action = event.data.action;
        // Frame guard: only respond in the FIRST-LEVEL dartcounter frame
        // (the one whose parent is our host web-app). Deeper nested iframes
        // (intercom, auth, etc.) also receive the bubbled postMessage but
        // must not act on it — that's what was causing camera-2x.
        try {
          if (window.parent !== window.top) {
            // We're in a nested sub-iframe inside dartcounter — ignore.
            return;
          }
        } catch (e) { /* cross-origin throw → we're definitely not the top */ return; }
        // Dedupe (safety net for touch+click double-fires from the host button).
        try {
          window.__dvLastAction = window.__dvLastAction || {};
          const now = Date.now();
          const last = window.__dvLastAction[action] || 0;
          if (now - last < 800) {
            logTrace('DV_ACTION ' + action + ': suppressed duplicate (' + (now - last) + 'ms)');
            return;
          }
          window.__dvLastAction[action] = now;
        } catch (e) {}
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
              // IMPORTANT: do NOT shotgun-fire pointer + click + inner.click().
              // DartCounter’s recent build registers handlers on multiple
              // ancestors, which means a synthetic burst opens the camera
              // dialog 4-5 times. A single trusted click() bubbles correctly
              // through Angular’s zone and is enough.
              try { el.click(); }
              catch (e) {
                // Fallback path only if .click() threw (extremely rare on
                // detached / non-Element nodes).
                try {
                  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                } catch (_) {}
              }
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

          // --- START BREAK ---
          if (action === 'break') {
            logTrace('DV_ACTION break: Starting break sequence...');
            const findMoreMenu = () => {
              let el = document.querySelector('app-control-more-icon, [data-testid*="more" i], button[aria-label*="more" i]');
              if (!el) {
                const candidates = document.querySelectorAll('button, div[role="button"], ion-button, [role="button"]');
                for (const c of candidates) {
                  if (!c.offsetParent) continue;
                  const label = ((c.getAttribute('aria-label') || '') + ' ' + (c.title || '') + ' ' + (c.textContent || '')).toLowerCase();
                  if (/\bmore\b|\bmenu\b/.test(label)) { el = c; break; }
                  if (c.querySelector('ion-icon[name*="ellipsis" i], ion-icon[name*="more" i]')) { el = c; break; }
                }
              }
              return el;
            };
            const moreBtn = findMoreMenu();
            if (moreBtn) {
              moreBtn.click();
              moreBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
              moreBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
              moreBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              logTrace('DV_ACTION break: clicked more menu');
              let breakDone = false;
              const findBreakBtn = () => {
                const dlgs = document.querySelectorAll('app-add-break-dialog, [role="dialog"], .mat-mdc-dialog-container, ion-modal');
                for (const d of dlgs) {
                  if (!d.offsetParent && !d.closest('ion-modal')) continue;
                  const btns = d.querySelectorAll('button, [role="button"]');
                  for (const b of btns) {
                    const txt = (b.textContent || '').toLowerCase().trim();
                    if (/\bbreak\b|\bpause\b|\bstart\s*break\b/.test(txt)) return b;
                  }
                  const actionBtns = Array.from(btns).filter(b => b.offsetParent);
                  if (actionBtns.length > 0) return actionBtns[0];
                }
                return null;
              };
              const bmo = new MutationObserver(() => {
                if (breakDone) return;
                const btn = findBreakBtn();
                if (btn) {
                  breakDone = true;
                  bmo.disconnect();
                  setTimeout(() => {
                    btn.click();
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    logTrace('DV_ACTION break: clicked break button');
                  }, 200);
                }
              });
              bmo.observe(document.body || document.documentElement, { childList: true, subtree: true });
              setTimeout(() => { if (!breakDone) { bmo.disconnect(); logTrace('DV_ACTION break: dialog observer timed out (4s)'); } }, 4000);
            } else {
              logTrace('DV_ACTION break: more menu button not found');
            }
          }

          // --- EDIT LAST SCORE ---
          // Clicks the pencil "edit" button, then expands the LAST turn in the
          // resulting "EDIT SCORE" modal (most recent score = bottom of the list).
          // The total-score input then receives focus, ready for the next spoken score.
          if (action === 'edit') {
            logTrace('DV_ACTION edit: Starting edit-score sequence...');

            const findEditBtn = () => {
              // Primary: dartcounter's <dc-icon icon="edit"> wrapped in a <button>.
              const icons = document.querySelectorAll('dc-icon[icon="edit"]');
              for (const ic of icons) {
                if (!ic.offsetParent) continue;
                const btn = ic.closest('button, [role="button"], ion-button, a');
                if (btn) return btn;
              }
              // Fallback: anything with edit-ish label/icon.
              const cands = document.querySelectorAll('button, ion-button, [role="button"]');
              for (const c of cands) {
                if (!c.offsetParent) continue;
                const label = ((c.getAttribute('aria-label') || '') + ' ' + (c.title || '') + ' ' + (c.textContent || '')).toLowerCase().trim();
                if (/^edit$|\bedit\s*score\b|\bedit\s*last\b/.test(label)) return c;
                if (c.querySelector('use[href*="#edit"], use[xlink\\:href*="#edit"], ion-icon[name*="create" i], ion-icon[name*="edit" i]')) return c;
              }
              return null;
            };

            const fireClick = (el) => {
              try { el.click(); } catch(_){}
              try {
                el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, cancelable: true }));
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              } catch(_){}
            };

            // Click the LAST accordion in the edit modal (most recent turn).
            // After it expands, focus the input field so subsequent typing lands there.
            const expandLastTurn = () => {
              const accordions = Array.from(document.querySelectorAll('app-accordion')).filter(a => a.offsetParent);
              if (!accordions.length) return false;
              const last = accordions[accordions.length - 1];
              const header = last.querySelector('[accordion-header], .cursor-pointer, button, [role="button"]') || last.firstElementChild || last;
              fireClick(header);
              logTrace('DV_ACTION edit: expanded last turn (#' + accordions.length + ')');
              setTimeout(() => {
                const input = last.querySelector('input[type="number"], input[type="text"], input') ||
                              document.querySelector('app-fullscreen-dialog input, [role="dialog"] input');
                if (input) {
                  try { input.focus(); input.select && input.select(); } catch(_){}
                  logTrace('DV_ACTION edit: focused input ' + (input.id || input.name || 'unnamed'));
                }
              }, 250);
              return true;
            };

            const editBtn = findEditBtn();
            if (editBtn) {
              fireClick(editBtn);
              logTrace('DV_ACTION edit: clicked edit button');
              // Wait for the modal accordions to render (Angular animation ~150-300ms).
              let editDone = false;
              const emo = new MutationObserver(() => {
                if (editDone) return;
                if (expandLastTurn()) { editDone = true; emo.disconnect(); }
              });
              emo.observe(document.body || document.documentElement, { childList: true, subtree: true });
              // Initial poll fallback in case the modal was already mounted.
              setTimeout(() => { if (!editDone && expandLastTurn()) { editDone = true; emo.disconnect(); } }, 350);
              setTimeout(() => { if (!editDone) { emo.disconnect(); logTrace('DV_ACTION edit: accordion observer timed out (4s)'); } }, 4000);
            } else {
              logTrace('DV_ACTION edit: edit button not found');
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
