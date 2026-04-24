// popup.js — DartVoice extension popup
var DEMO_LIMIT_MS = 10 * 60 * 1000;

// ── DOM refs ─────────────────────────────────────────────────────────────────
var viewNormal      = document.getElementById('view-normal');
var viewLockout     = document.getElementById('view-lockout');
var acctSignedOut   = document.getElementById('acct-signed-out');
var acctSignedIn    = document.getElementById('acct-signed-in');
var acctEmail       = document.getElementById('acct-email');
var acctSub         = document.getElementById('acct-sub');
var demoSection     = document.getElementById('demo-section');
var demoFill        = document.getElementById('demo-fill');
var demoRemaining   = document.getElementById('demo-remaining');
var micSelect       = document.getElementById('mic-select');
var btnLaunch       = document.getElementById('btn-launch');
var btnSignIn       = document.getElementById('btn-sign-in');
var btnSignOut      = document.getElementById('btn-sign-out');
var btnLockoutSignin = document.getElementById('btn-lockout-signin');
var btnLockoutPlans  = document.getElementById('btn-lockout-plans');

function formatTime(ms) {
    var totalSec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// ── State ────────────────────────────────────────────────────────────────────
function getState() {
    return new Promise(function (resolve) {
        chrome.runtime.sendMessage({ type: 'DV_GET_STATE' }, function (resp) {
            resolve(resp || { email: null, sub: null, demoUsedMs: 0, demoLimitMs: DEMO_LIMIT_MS, micDeviceId: null });
        });
    });
}

// ── Mic enumeration ──────────────────────────────────────────────────────────
async function loadMics() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        var devices = await navigator.mediaDevices.enumerateDevices();
        var mics = devices.filter(function (d) { return d.kind === 'audioinput'; });
        micSelect.innerHTML = '';

        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'System Default';
        micSelect.appendChild(defaultOpt);

        mics.forEach(function (mic) {
            var opt = document.createElement('option');
            opt.value = mic.deviceId;
            opt.textContent = mic.label || ('Microphone ' + mic.deviceId.slice(0, 8));
            micSelect.appendChild(opt);
        });

        var state = await getState();
        if (state.micDeviceId) micSelect.value = state.micDeviceId;
    } catch (e) {
        micSelect.innerHTML = '<option value="">Mic access needed</option>';
    }
}

micSelect.addEventListener('change', function () {
    chrome.runtime.sendMessage({ type: 'DV_SET_MIC', deviceId: micSelect.value });
});

// ── Render UI ────────────────────────────────────────────────────────────────
async function render() {
    var state = await getState();
    var hasSub = state.sub === 'active' || state.sub === 'trialing';
    var demoExpired = !hasSub && state.demoUsedMs >= DEMO_LIMIT_MS;

    if (demoExpired && !state.email) {
        viewNormal.classList.add('hidden');
        viewLockout.classList.remove('hidden');
        return;
    }

    viewNormal.classList.remove('hidden');
    viewLockout.classList.add('hidden');

    // Account
    if (state.email) {
        acctSignedOut.classList.add('hidden');
        acctSignedIn.classList.remove('hidden');
        acctEmail.textContent = state.email;
        if (state.sub === 'active') {
            acctSub.textContent = '✓ Active subscription';
            acctSub.className = 'account-sub sub-active';
        } else if (state.sub === 'trialing') {
            acctSub.textContent = '✓ Free trial active';
            acctSub.className = 'account-sub sub-trial';
        } else {
            acctSub.textContent = 'No active subscription';
            acctSub.className = 'account-sub sub-none';
        }
        demoSection.classList.toggle('hidden', hasSub);
    } else {
        acctSignedOut.classList.remove('hidden');
        acctSignedIn.classList.add('hidden');
        demoSection.classList.remove('hidden');
    }

    // Demo timer
    if (!hasSub) {
        var used = state.demoUsedMs || 0;
        var remaining = Math.max(0, DEMO_LIMIT_MS - used);
        var pct = Math.min(100, (used / DEMO_LIMIT_MS) * 100);
        demoFill.style.width = pct + '%';
        demoRemaining.textContent = formatTime(remaining);
        if (remaining <= 0) {
            demoFill.classList.add('expired');
            btnLaunch.disabled = true;
        }
    }
}

// ── Launch overlay ───────────────────────────────────────────────────────────
btnLaunch.addEventListener('click', async function () {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    if (!tab) return;

    var state = await getState();
    var config = {
        type: 'DV_INIT_CONFIG',
        micDeviceId: micSelect.value || null,
        email: state.email || null,
        sub: state.sub || null,
        demoUsedMs: state.demoUsedMs || 0,
        demoLimitMs: DEMO_LIMIT_MS
    };

    // Try sending config to an already-running content script first
    chrome.tabs.sendMessage(tab.id, config, function (response) {
        if (chrome.runtime.lastError || !response || !response.ok) {
            // Content script not loaded — inject it, then send config
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            }, function () {
                setTimeout(function () {
                    chrome.tabs.sendMessage(tab.id, config);
                    window.close();
                }, 250);
            });
        } else {
            window.close();
        }
    });
});

// ── Navigation ───────────────────────────────────────────────────────────────
function openSignIn() {
    chrome.tabs.create({ url: 'https://dartvoice.app/login' });
    window.close();
}

btnSignIn.addEventListener('click', openSignIn);
btnLockoutSignin.addEventListener('click', openSignIn);

btnLockoutPlans.addEventListener('click', function () {
    chrome.tabs.create({ url: 'https://dartvoice.app/#pricing' });
    window.close();
});

btnSignOut.addEventListener('click', async function () {
    await new Promise(function (resolve) {
        chrome.runtime.sendMessage({ type: 'DV_SIGN_OUT' }, resolve);
    });
    render();
});

// ── Init ─────────────────────────────────────────────────────────────────────
loadMics();
render();
chrome.runtime.sendMessage({ type: 'DV_CHECK_SUB' });

// ── Tabs + Live Game + Reorder control ──────────────────────────────────────
const btnReorder = document.getElementById('btn-reorder-layout');
const liveGame = document.getElementById('live-game');
const tabs = document.querySelectorAll('.tab');
const btnLiveCheckout = document.getElementById('btn-live-checkout');

// Reorder timeout + state
const REORDER_DURATION_MS = 30 * 1000;
let reorderTimerId = null;
let reorderIntervalId = null;
let reorderRemaining = 0;
let lastReorderTabId = null;

if (tabs && tabs.length) {
    tabs.forEach(function(t){
        t.addEventListener('click', function(){
            tabs.forEach(function(x){ x.classList.remove('active'); });
            t.classList.add('active');
            const name = t.dataset.tab;
            if (name === 'live') {
                if (viewNormal) viewNormal.classList.add('hidden');
                if (viewLockout) viewLockout.classList.add('hidden');
                if (liveGame) liveGame.classList.remove('hidden');
            } else {
                if (liveGame) liveGame.classList.add('hidden');
                render();
            }
        });
    });
}

if (btnReorder) {
    btnReorder.addEventListener('click', async function(){
        const tabsArr = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabsArr && tabsArr[0]; if (!tab) return;
        const enabling = !btnReorder.classList.contains('active');

        // If enabling, start countdown display and auto-disable; if disabling, cancel timers.
        if (enabling) {
            btnReorder.classList.add('active');
            lastReorderTabId = tab.id;
            reorderRemaining = Math.floor(REORDER_DURATION_MS / 1000);
            btnReorder.textContent = 'Reorder: ON (' + reorderRemaining + 's)';
            try { chrome.tabs.sendMessage(tab.id, { type: 'DV_SET_REORDER', enable: true, duration: REORDER_DURATION_MS }); } catch(e) {}
            // update countdown every second
            reorderIntervalId = setInterval(function(){
                reorderRemaining -= 1;
                if (reorderRemaining <= 0) {
                    btnReorder.textContent = 'Reorder Layout';
                    clearInterval(reorderIntervalId); reorderIntervalId = null;
                } else {
                    btnReorder.textContent = 'Reorder: ON (' + reorderRemaining + 's)';
                }
            }, 1000);
            // auto-disable after duration
            reorderTimerId = setTimeout(function(){
                btnReorder.classList.remove('active');
                btnReorder.textContent = 'Reorder Layout';
                try { if (lastReorderTabId) chrome.tabs.sendMessage(lastReorderTabId, { type: 'DV_SET_REORDER', enable: false }); } catch(e) {}
                if (reorderIntervalId) { clearInterval(reorderIntervalId); reorderIntervalId = null; }
                reorderTimerId = null; lastReorderTabId = null;
            }, REORDER_DURATION_MS);
        } else {
            // manual disable
            btnReorder.classList.remove('active');
            btnReorder.textContent = 'Reorder Layout';
            try { chrome.tabs.sendMessage(tab.id, { type: 'DV_SET_REORDER', enable: false }); } catch(e) {}
            if (reorderTimerId) { clearTimeout(reorderTimerId); reorderTimerId = null; }
            if (reorderIntervalId) { clearInterval(reorderIntervalId); reorderIntervalId = null; }
            lastReorderTabId = null;
        }
    });
}

// Digital clock in popup header
function updateClock() {
    try {
        var el = document.getElementById('ext-clock');
        if (!el) return;
        var now = new Date();
        var hh = String(now.getHours()).padStart(2,'0');
        var mm = String(now.getMinutes()).padStart(2,'0');
        var ss = String(now.getSeconds()).padStart(2,'0');
        el.textContent = hh + ':' + mm + ':' + ss;
    } catch (e) {}
}
updateClock();
setInterval(updateClock, 1000);

if (btnLiveCheckout) {
    btnLiveCheckout.addEventListener('click', function(){
        const b = this; const orig = b.textContent; b.disabled = true; b.textContent = 'Processing…';
        setTimeout(function(){ b.textContent = 'Paid ✓'; b.classList.add('btn-secondary'); }, 900);
        setTimeout(function(){ b.textContent = orig; b.disabled = false; b.classList.remove('btn-secondary'); }, 2800);
    });
}

