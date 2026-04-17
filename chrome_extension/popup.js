// popup.js â€” DartVoice extension popup
var DEMO_LIMIT_MS = 10 * 60 * 1000;

// â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getState() {
    return new Promise(function (resolve) {
        chrome.runtime.sendMessage({ type: 'DV_GET_STATE' }, function (resp) {
            resolve(resp || { email: null, sub: null, demoUsedMs: 0, demoLimitMs: DEMO_LIMIT_MS, micDeviceId: null });
        });
    });
}

// â”€â”€ Mic enumeration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Render UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            acctSub.textContent = 'âœ“ Active subscription';
            acctSub.className = 'account-sub sub-active';
        } else if (state.sub === 'trialing') {
            acctSub.textContent = 'âœ“ Free trial active';
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

// â”€â”€ Launch overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            // Content script not loaded â€” inject it, then send config
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

// â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openSignIn() {
    chrome.tabs.create({ url: 'https://dartvoice.app/html/login.html' });
    window.close();
}

btnSignIn.addEventListener('click', openSignIn);
btnLockoutSignin.addEventListener('click', openSignIn);

btnLockoutPlans.addEventListener('click', function () {
    chrome.tabs.create({ url: 'https://dartvoice.app/html/index.html#pricing' });
    window.close();
});

btnSignOut.addEventListener('click', async function () {
    await new Promise(function (resolve) {
        chrome.runtime.sendMessage({ type: 'DV_SIGN_OUT' }, resolve);
    });
    render();
});

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
loadMics();
render();
chrome.runtime.sendMessage({ type: 'DV_CHECK_SUB' });


