(function () {
  if (window.__dartvoiceInjected) return;
  window.__dartvoiceInjected = true;

  // --- DART PARSING LOGIC PORTED FROM PYTHON ---
  const _ONES = { 'zero': 0, 'oh': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19 };
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
    return parseUnder100(text); // Basic integer mapping for MVP X01
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

  // --- SHADOW DOM UI SETUP ---
  const container = document.createElement('div');
  container.id = 'dartvoice-ext-container';
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.zIndex = '999999';
  container.style.fontFamily = 'Arial, sans-serif';
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .dv-panel {
      background: #08080A;
      color: #F0F0F5;
      padding: 16px;
      border-radius: 12px;
      width: 250px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      border: 1px solid #252530;
      position: relative;
    }
    h3 { margin: 0 0 10px 0; font-size: 16px; display: flex; align-items: center; justify-content: space-between; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #6E6E82; display: inline-block; }
    .status-dot.active { background: #CC0B20; box-shadow: 0 0 8px #CC0B20; }
    button {
      background: #18181C;
      color: #F0F0F5;
      border: 1px solid #252530;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      margin-bottom: 8px;
      font-weight: bold;
      transition: all 0.2s;
    }
    button:hover { background: #222228; }
    button.primary { background: #CC0B20; border-color: #CC0B20; }
    button.primary:hover { background: #e01030; }
    .log {
      font-size: 12px;
      color: #6E6E82;
      background: #111114;
      padding: 8px;
      border-radius: 6px;
      min-height: 40px;
      margin-top: 10px;
      word-wrap: break-word;
    }
    .close-btn { cursor: pointer; color: #6E6E82; font-size: 14px; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'dv-panel';
  panel.innerHTML = `
    <h3>DartVoice Web <span class="close-btn" id="dv-close">✖</span></h3>
    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 15px;">
      <span style="font-size:13px;" id="dv-status-text">Mic Off</span>
      <div class="status-dot" id="dv-status-dot"></div>
    </div>
    <button id="dv-toggle-mic" class="primary">Start Listening</button>
    <button id="dv-calibrate">Calibrate Input Box</button>
    <div class="log" id="dv-log">Waiting for speech...</div>
  `;
  shadow.appendChild(panel);

  const statusText = shadow.getElementById('dv-status-text');
  const statusDot = shadow.getElementById('dv-status-dot');
  const toggleMicBtn = shadow.getElementById('dv-toggle-mic');
  const calibrateBtn = shadow.getElementById('dv-calibrate');
  const logDiv = shadow.getElementById('dv-log');
  const closeBtn = shadow.getElementById('dv-close');

  function logAction(msg) {
    logDiv.textContent = msg;
  }

  // --- CALIBRATION ---
  calibrateBtn.addEventListener('click', () => {
    calibrationMode = true;
    logAction("Click the score input box on the page to save its position.");
    panel.style.opacity = '0.5';
  });

  document.addEventListener('click', (e) => {
    if (calibrationMode && !e.composedPath().includes(container)) {
      e.preventDefault();
      e.stopPropagation();
      calibratedCoords = { x: e.clientX, y: e.clientY };
      calibrationMode = false;
      panel.style.opacity = '1';
      logAction(`Calibrated at: ${e.clientX}, ${e.clientY}`);
    }
  }, true);

  // --- CLICK SIMULATION ---
  function clickCoordinate(x, y) {
    const el = document.elementFromPoint(x, y);
    if (el) {
      // Simulate physical click
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      el.focus();
    }
  }

  // --- SPEECH RECOGNITION ---
  function initSpeech() {
    if (!('webkitSpeechRecognition' in window)) {
      logAction("Your browser does not support SpeechRecognition.");
      return;
    }
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      statusText.textContent = 'Listening...';
      statusDot.classList.add('active');
      toggleMicBtn.textContent = 'Stop Listening';
      toggleMicBtn.classList.remove('primary');
    };

    recognition.onend = () => {
      isListening = false;
      statusText.textContent = 'Mic Off';
      statusDot.classList.remove('active');
      toggleMicBtn.textContent = 'Start Listening';
      toggleMicBtn.classList.add('primary');
      // Auto-restart if it was stopped by the browser network timeout
      if (toggleMicBtn.dataset.intendedState === "on") {
        setTimeout(() => { if (!isListening) recognition.start(); }, 1000);
      }
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          logAction(`Heard: "${transcript}"`);
          processSpeech(transcript);
        }
      }
    };
  }

  function processSpeech(transcript) {
    if (!calibratedCoords.x || !calibratedCoords.y) {
      logAction("Error: Please Calibrate the input box first!");
      return;
    }

    // Try parsing a dart
    const dart = parseSingleDart(transcript);
    let finalScore = null;

    if (dart) {
      finalScore = dart.val;
    } else {
      // Try raw number fallback
      finalScore = parseScore(transcript);
    }

    if (finalScore !== null) {
      logAction(`Matched Score: ${finalScore}`);
      // Simulate clicking the box, typing the number, and entering
      simulateScoreEntry(finalScore);
    } else {
      logAction(`Could not parse: "${transcript}"`);
    }
  }

  function simulateScoreEntry(score) {
    const x = calibratedCoords.x;
    const y = calibratedCoords.y;

    // Click field to focus
    clickCoordinate(x, y);

    setTimeout(() => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.isContentEditable)) {
        if (el.tagName === 'INPUT') el.value = score;
        else el.textContent = score;

        // Dispatch input event so React/Vue hooks trigger
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        // Dispatch Enter key to submit
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', keyCode: 13 }));
      }
    }, 50);
  }

  toggleMicBtn.addEventListener('click', () => {
    if (!recognition) initSpeech();

    if (isListening) {
      toggleMicBtn.dataset.intendedState = "off";
      recognition.stop();
    } else {
      toggleMicBtn.dataset.intendedState = "on";
      try { recognition.start(); } catch (e) { }
    }
  });

  closeBtn.addEventListener('click', () => {
    if (recognition && isListening) recognition.stop();
    container.remove();
    window.__dartvoiceInjected = false;
  });

  // Make draggable
  let isDragging = false, startX, startY, initialX, initialY;
  panel.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.className === 'close-btn') return;
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

  document.addEventListener('mouseup', () => { isDragging = false; });

})();
