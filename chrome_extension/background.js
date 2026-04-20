// background.js — DartVoice extension service worker

// First-install onboarding: open the welcome page on our site
try {
    chrome.runtime.onInstalled.addListener(function (details) {
        if (details && details.reason === 'install') {
            chrome.tabs.create({ url: 'https://dartvoice.app/welcome.html?src=ext_install' });
        } else if (details && details.reason === 'update') {
            // Optional: flag that an update happened so the web app can show a "what's new" toast
            chrome.storage.local.set({ dv_last_update_at: Date.now(), dv_last_version: chrome.runtime.getManifest().version });
        }
    });
} catch (e) { /* service worker may re-init; listener survives */ }

var SB_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';
var DEMO_LIMIT_MS = 10 * 60 * 1000;

// ── Token refresh ────────────────────────────────────────────────────────────
async function refreshToken() {
    var data = await chrome.storage.local.get(['dv_refresh_token']);
    if (!data.dv_refresh_token) return false;
    try {
        var resp = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: data.dv_refresh_token })
        });
        if (!resp.ok) {
            await chrome.storage.local.remove(['dv_access_token', 'dv_refresh_token', 'dv_user_id', 'dv_user_email', 'dv_sub_status']);
            return false;
        }
        var json = await resp.json();
        await chrome.storage.local.set({
            dv_access_token: json.access_token,
            dv_refresh_token: json.refresh_token,
            dv_user_id: json.user.id,
            dv_user_email: json.user.email
        });
        return true;
    } catch (e) {
        return false;
    }
}

// ── Subscription check via Supabase REST ─────────────────────────────────────
async function checkSubscription(retried) {
    var data = await chrome.storage.local.get(['dv_access_token', 'dv_user_id']);
    if (!data.dv_access_token || !data.dv_user_id) return { status: null, signed_in: false };
    try {
        var resp = await fetch(
            SB_URL + '/rest/v1/dartvoice_subscriptions?user_id=eq.' + data.dv_user_id + '&select=status',
            {
                headers: {
                    'apikey': SB_KEY,
                    'Authorization': 'Bearer ' + data.dv_access_token,
                    'Accept': 'application/json'
                }
            }
        );
        if (!resp.ok) {
            if (!retried) {
                var refreshed = await refreshToken();
                if (refreshed) return checkSubscription(true);
            }
            return { status: null, signed_in: false };
        }
        var rows = await resp.json();
        var sub = rows.length > 0 ? rows[0].status : null;
        await chrome.storage.local.set({ dv_sub_status: sub, dv_sub_checked_at: Date.now() });
        return { status: sub, signed_in: true };
    } catch (e) {
        return { status: null, signed_in: false };
    }
}

// ── Message handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {

    // Auth update from auth-bridge.js on dartvoice.app
    if (msg.type === 'DV_AUTH_UPDATE') {
        var session = msg.session;
        if (session && session.access_token) {
            chrome.storage.local.set({
                dv_access_token: session.access_token,
                dv_refresh_token: session.refresh_token,
                dv_user_id: session.user.id,
                dv_user_email: session.user.email
            }).then(function () {
                checkSubscription();
            });
        } else {
            chrome.storage.local.remove(['dv_access_token', 'dv_refresh_token', 'dv_user_id', 'dv_user_email', 'dv_sub_status']);
        }
        sendResponse({ ok: true });
        return false;
    }

    // Subscription check request
    if (msg.type === 'DV_CHECK_SUB') {
        checkSubscription().then(function (result) { sendResponse(result); });
        return true;
    }

    // Get full state
    if (msg.type === 'DV_GET_STATE') {
        chrome.storage.local.get(['dv_user_email', 'dv_sub_status', 'dv_demo_used_ms', 'dv_mic_device_id']).then(function (data) {
            sendResponse({
                email: data.dv_user_email || null,
                sub: data.dv_sub_status || null,
                demoUsedMs: data.dv_demo_used_ms || 0,
                demoLimitMs: DEMO_LIMIT_MS,
                micDeviceId: data.dv_mic_device_id || null
            });
        });
        return true;
    }

    // Sign out
    if (msg.type === 'DV_SIGN_OUT') {
        chrome.storage.local.remove([
            'dv_access_token', 'dv_refresh_token', 'dv_user_id',
            'dv_user_email', 'dv_sub_status'
        ]).then(function () { sendResponse({ ok: true }); });
        return true;
    }

    // Save mic preference
    if (msg.type === 'DV_SET_MIC') {
        chrome.storage.local.set({ dv_mic_device_id: msg.deviceId }).then(function () { sendResponse({ ok: true }); });
        return true;
    }

    // Update demo timer
    if (msg.type === 'DV_UPDATE_DEMO_TIME') {
        chrome.storage.local.set({ dv_demo_used_ms: msg.ms }).then(function () { sendResponse({ ok: true }); });
        return true;
    }
});
