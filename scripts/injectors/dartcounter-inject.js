// dartcounter-inject.js
// Content script to run inside the DartCounter iframe (injected via extension).
// - auto-posts keyboard/score element bounding rect to the parent as {type:'DV_GAME_ELEMENT_RECT'}
// - accepts parent postMessage commands to simulate keyboard input: {type:'DV_INJECT_CMD', cmd:'simulate', values:[...]} etc.
// - exposes API at window.DVInjector for live console control

(function(){
  if (window.__dv_dartcounter_injector_installed) return;
  window.__dv_dartcounter_injector_installed = true;
  const LOG_PREFIX = '[DV-INJECT]';
  function log(...args){ try { console.log(LOG_PREFIX, ...args); } catch(e){} }

  function findKeyboard(selector) {
    const candidates = [
      selector,
      '#main-content > div.relative.flex.h-full.overflow-hidden.px-safe.pb-safe.ng-tns-c644059705-84.ng-star-inserted > div > div.relative.w-full.flex-auto.overflow-hidden.py-4.pr-4.ng-tns-c644059705-84 > div.flex.h-full.flex-col.ng-tns-c644059705-84 > div.relative.flex.h-full.w-full.overflow-hidden.ng-tns-c644059705-84.ng-star-inserted > div.w-full.ng-tns-c644059705-84.ng-star-inserted > app-cricket-tactics-keyboard > div',
      'app-cricket-tactics-keyboard > div',
      'app-cricket-tactics-keyboard',
      'app-keyboard-score-input',
      'div.keyboard',
      'div.score-keyboard',
      '.keyboard'
    ];
    for (let s of candidates) {
      if (!s) continue;
      try { const el = document.querySelector(s); if (el) return el; } catch(e){}
    }
    return null;
  }

  function postRectToParent(el){
    if (!el) return;
    try {
      const r = el.getBoundingClientRect();
      window.parent.postMessage({
        type: 'DV_GAME_ELEMENT_RECT',
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        source: 'dartcounter-injector'
      }, '*');
      return r;
    } catch(e){ log('postRect error', e); }
  }

  let autoIntervalId = null;
  let ro = null, mo = null;
  let cricketGrid = null; // optional cricket grid JSON: { s20:{x,y}, t15:{x,y}, submit:{x,y} }

  function startAutoPost(selector, intervalMs = 1200){
    stopAutoPost();
    const el = findKeyboard(selector);
    if (!el) { log('startAutoPost: keyboard not found'); return false; }
    postRectToParent(el);
    try { ro = new ResizeObserver(()=>postRectToParent(el)); ro.observe(el); } catch(e){ log('ResizeObserver failed', e); }
    try { mo = new MutationObserver(()=>postRectToParent(el)); mo.observe(el, { attributes:true, childList:true, subtree:true }); } catch(e){ log('MutationObserver failed', e); }
    autoIntervalId = setInterval(()=>{ postRectToParent(el); }, intervalMs);
    log('autoPost started', { intervalMs });
    window.parent.postMessage({ type: 'DV_INJECT_STATUS', status: 'autoPostStarted' }, '*');
    return true;
  }

  function stopAutoPost(){
    if (autoIntervalId) { clearInterval(autoIntervalId); autoIntervalId = null; }
    try { if (ro) { ro.disconnect(); ro = null; } } catch(_){}
    try { if (mo) { mo.disconnect(); mo = null; } } catch(_){}
    log('autoPost stopped');
    window.parent.postMessage({ type: 'DV_INJECT_STATUS', status: 'autoPostStopped' }, '*');
  }

  async function simulateInput(values){
    const container = findKeyboard();
    if (!container) { log('simulateInput: keyboard container not found'); return false; }
    if (!Array.isArray(values)) values = [values];

    // helpers
    function findNumberBtn(n){
      const buttons = Array.from(container.querySelectorAll('button, div[role="button"]')).filter(b => b.offsetParent !== null);
      for (const b of buttons){
        const text = (b.innerText || b.textContent || '').trim();
        if (!text) continue;
        if (text === String(n) || text.startsWith(String(n))) return b;
        const m = text.match(/^(\d{1,3})/);
        if (m && Number(m[1]) === Number(n)) return b;
      }
      for (const b of buttons){
        const al = (b.getAttribute && b.getAttribute('aria-label')) || '';
        if (al && al.includes(String(n))) return b;
      }
      return null;
    }

    function findSubmit(){
      let s = document.querySelector('button.submit-button, button[type="submit"], button[aria-label="Submit"]');
      if (s) return s;
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      for (const b of buttons){
        const t = (b.innerText || b.textContent || '').trim().toLowerCase();
        if (t === 'submit' || t === 'enter' || t === 'ok') return b;
      }
      return null;
    }

    // cricket helpers
    function isCricketTarget(v){
      if (!cricketGrid) return false;
      if (typeof v === 'string') return /^([sdt])?\s*(\d{1,2}|bull|b)$/i.test(v);
      if (v && typeof v === 'object' && (v.t || v.tgt || v.target)) return true;
      return false;
    }

    function clickAt(x, y){
      try {
        const cx = Math.round(x - window.scrollX);
        const cy = Math.round(y - window.scrollY);
        let el = document.elementFromPoint(cx, cy);
        if (el) { el.click(); return true; }
        const evDown = new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:cx, clientY:cy });
        const evUp = new MouseEvent('mouseup', { bubbles:true, cancelable:true, clientX:cx, clientY:cy });
        const evClick = new MouseEvent('click', { bubbles:true, cancelable:true, clientX:cx, clientY:cy });
        (document.elementFromPoint(cx, cy) || document.body).dispatchEvent(evDown);
        (document.elementFromPoint(cx, cy) || document.body).dispatchEvent(evUp);
        (document.elementFromPoint(cx, cy) || document.body).dispatchEvent(evClick);
        return true;
      } catch(e){ log('clickAt error', e); return false; }
    }

    function computeCricketClick(tgt, mod, cfg){
      try {
        const g = cricketGrid;
        if (!g || !g.s20 || !g.t15 || !g.submit) return null;
        const includeBull = (cfg && cfg.cricket_include_bull !== undefined) ? cfg.cricket_include_bull : true;
        const off_x = (cfg && cfg.cricket_offset_x) ? cfg.cricket_offset_x : 0;
        const off_y = (cfg && cfg.cricket_offset_y) ? cfg.cricket_offset_y : 0;
        const containerRect = container.getBoundingClientRect();
        const s20 = g.s20, t15 = g.t15;
        const s20_is_relative = (s20.x <= containerRect.width && s20.y <= containerRect.height);
        let s20x = s20.x, s20y = s20.y, t15x = t15.x, t15y = t15.y;
        if (s20_is_relative){
          s20x = containerRect.left + s20.x; s20y = containerRect.top + s20.y;
          t15x = containerRect.left + t15.x; t15y = containerRect.top + t15.y;
        }
        const dx = (t15x - s20x) / 2.0;
        const dy = (t15y - s20y) / 5.0;
        const rowMap = {'20':0,'19':1,'18':2,'17':3,'16':4,'15':5};
        if (includeBull) rowMap['b'] = 6;
        const colMap = {'s':0,'d':1,'t':2};
        const rowIndex = rowMap[tgt];
        const colIndex = colMap[mod] || 0;
        if (rowIndex === undefined) return null;
        const cx = s20x + colIndex*dx + off_x;
        const cy = s20y + rowIndex*dy + off_y;
        return {x: cx, y: cy};
      } catch(e){ log('computeCricketClick error', e); return null; }
    }

    for (const v of values){
      // Cricket-style input handling
      if (isCricketTarget(v)){
        let tgt = null, mod = 's';
        if (typeof v === 'string'){
          const m = v.match(/^([sdt])\s*(\d{1,2}|bull|b)$/i);
          if (m){ mod = m[1].toLowerCase(); tgt = m[2].toLowerCase(); if (tgt === 'bull') tgt = 'b'; }
          else {
            const sh = (''+v).toLowerCase().replace(/\s+/g,'');
            const m2 = sh.match(/^([sdt])?(\d{1,2}|b|bull)$/);
            if (m2){ mod = (m2[1]||'s'); tgt = m2[2]; if (tgt === 'bull') tgt = 'b'; }
          }
        } else if (v && typeof v === 'object'){
          tgt = v.tgt || v.t || v.target; mod = v.m || v.mod || v.mode || 's';
        }
        if (tgt){
          const pos = computeCricketClick(tgt, mod, window.__dv_injector_cfg || {});
          if (pos){ clickAt(pos.x, pos.y); await new Promise(r=>setTimeout(r, 200)); continue; }
        }
      }
      const btn = findNumberBtn(v);
      if (!btn) { log('simulateInput: number button not found for', v); continue; }
      btn.click();
      await new Promise(r => setTimeout(r, 170));
    }
    const submit = findSubmit();
    if (submit) { submit.click(); log('simulateInput: clicked submit'); }
    else log('simulateInput: submit not found');
    window.parent.postMessage({ type: 'DV_INJECT_STATUS', status: 'simulateComplete', values }, '*');
    return true;
  }

  function onMessage(ev){
    try {
      const m = ev.data || {};
      if (!m || typeof m !== 'object') return;
      if (m.type === 'DV_INJECT_CMD'){
        const cmd = m.cmd;
        if (cmd === 'setCricketGrid'){
          cricketGrid = m.grid || null;
          try { window.__dv_cricket_grid = cricketGrid; } catch(_){}
          log('setCricketGrid', cricketGrid);
          window.parent.postMessage({ type: 'DV_INJECT_STATUS', status: 'cricketGridSet' }, '*');
          return;
        }
        if (cmd === 'setInjectorConfig'){
          try { window.__dv_injector_cfg = m.cfg || {}; } catch(_){}
          log('setInjectorConfig', window.__dv_injector_cfg);
          window.parent.postMessage({ type: 'DV_INJECT_STATUS', status: 'injectorConfigSet' }, '*');
          return;
        }
        if (cmd === 'startAutoPost') startAutoPost(m.selector, m.intervalMs || 1200);
        else if (cmd === 'stopAutoPost') stopAutoPost();
        else if (cmd === 'postRect') { const el = findKeyboard(m.selector); postRectToParent(el); }
        else if (cmd === 'simulate') simulateInput(m.values || m.sequence || []);
        else if (cmd === 'debugOn') { window.__dv_injector_debug = true; log('debug on'); }
        else if (cmd === 'debugOff') { window.__dv_injector_debug = false; log('debug off'); }
      } else if (m.type === 'DV_PARENT_PING'){
        window.parent.postMessage({ type: 'DV_INJECT_STATUS', status: 'alive' }, '*');
      }
    } catch(e){ log('onMessage error', e); }
  }

  window.addEventListener('message', onMessage, false);
  try { const el0 = findKeyboard(); if (el0) postRectToParent(el0); } catch(_){}

  window.DVInjector = { startAutoPost, stopAutoPost, simulateInput, postRectToParent, findKeyboard, setCricketGrid: (g)=>{ cricketGrid = g; try{ window.__dv_cricket_grid = g; }catch(_){} }, setInjectorConfig: (cfg)=>{ try{ window.__dv_injector_cfg = cfg; }catch(_){} } };
  log('injector installed. API: window.DVInjector');
  window.addEventListener('unload', ()=>{ stopAutoPost(); window.removeEventListener('message', onMessage); });
})();
