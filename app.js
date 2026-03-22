// --- 0. CAPTURE REF PARAMS IMMEDIATELY (before Supabase strips the URL) ---
// Supabase's magic link handler does history.replaceState which removes ?query params.
// Read them synchronously right now and persist to sessionStorage as a fallback.
(function () {
    try {
        const p = new URLSearchParams(window.location.search);
        const refU = p.get('ref_username');
        const refC = p.get('ref');
        if (refU) {
            sessionStorage.setItem('ov_ref_username', refU);
            localStorage.setItem('ochevault_ref_username', refU);
        }
        if (refC) {
            sessionStorage.setItem('ov_ref', refC);
            localStorage.setItem('ochevault_ref', refC);
        }
    } catch (e) {}
})();

// --- 1. INITIALIZE SUPABASE ---
const SUPABASE_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';

// Create client attached to window so all pages can use it
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Listen for the SIGNED_IN event — fires once when a new session is established
// (magic link click, OTP verification). Use this to catch referrals the moment
// a new user authenticates, regardless of what happens to the URL afterwards.
window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event !== 'SIGNED_IN' || !session?.user) return;
    const user = session.user;

    // Pull ref from every possible store
    const refUsername = sessionStorage.getItem('ov_ref_username')
        || localStorage.getItem('ochevault_ref_username')
        || new URLSearchParams(window.location.search).get('ref_username');
    const refCode = sessionStorage.getItem('ov_ref')
        || localStorage.getItem('ochevault_ref')
        || new URLSearchParams(window.location.search).get('ref');

    if (!refUsername && !refCode) return;

    // Clear all stores so this only runs once
    sessionStorage.removeItem('ov_ref_username');
    sessionStorage.removeItem('ov_ref');
    localStorage.removeItem('ochevault_ref_username');
    localStorage.removeItem('ochevault_ref');

    try {
        let referrerId = null;

        if (refUsername) {
            const needle = refUsername.trim().toLowerCase();
            let { data: r } = await window.supabaseClient
                .from('profiles').select('id').ilike('referral_code', needle).maybeSingle();
            if (!r) {
                const res = await window.supabaseClient
                    .from('profiles').select('id').ilike('username', needle).maybeSingle();
                r = res.data;
            }
            if (r && r.id !== user.id) referrerId = r.id;
        } else if (refCode) {
            const { data: r } = await window.supabaseClient
                .from('profiles').select('id').ilike('referral_code', refCode.trim()).maybeSingle();
            if (r && r.id !== user.id) referrerId = r.id;
        }

        if (!referrerId) return;

        // Check for duplicate
        const { data: existing } = await window.supabaseClient
            .from('referrals').select('id')
            .eq('referrer_id', referrerId)
            .eq('referred_user_id', user.id)
            .limit(1);

        if (!existing || existing.length === 0) {
            await window.supabaseClient.from('referrals').insert([{
                referrer_id: referrerId,
                referred_email: user.email,
                referred_user_id: user.id,
                status: 'signed_up'
            }]);
        }
    } catch (e) {
        // Referral processing failed — details intentionally not logged client-side
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // --- GLOBAL AUTHENTICATION CHECK ---
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    
    // Find all "Sign In" buttons (desktop + mobile nav)
    const authLinks = document.querySelectorAll('.auth-link, .auth-link-mobile');
    
    if (user) {
        const [{ data: profile }, { data: tickets }] = await Promise.all([
            window.supabaseClient.from('profiles').select('username, avatar_url').eq('id', user.id).single(),
            window.supabaseClient.from('user_tickets').select('qty').eq('user_id', user.id)
        ]);

        const displayName  = profile?.username || 'My Vault';
        const avatarUrl    = profile?.avatar_url || null;
        const totalTickets = tickets ? tickets.reduce((s, t) => s + (t.qty || 0), 0) : 0;
        const initial      = displayName.charAt(0).toUpperCase();

        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(255,255,255,0.15);flex-shrink:0;">`
            : `<span style="width:26px;height:26px;border-radius:50%;background:rgba(220,38,38,0.25);border:1.5px solid rgba(220,38,38,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:white;flex-shrink:0;">${initial}</span>`;

        authLinks.forEach(link => {
            link.href = '/dashboard';
            link.innerHTML = avatarHtml + `<span style="font-size:13px;font-weight:600;color:white;">${displayName}</span>`;
            link.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;';
            link.classList.remove('bg-card','bg-brand','border-brand');
        });

        // Ticket count pill — inserted before the profile link
        if (!document.getElementById('nav-ticket-pill')) {
            authLinks.forEach(link => {
                const pill = document.createElement('a');
                pill.id   = 'nav-ticket-pill';
                pill.href = '/dashboard';
                pill.innerHTML = `<svg style="width:14px;height:14px;color:#f59e0b;flex-shrink:0;" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a1 1 0 01-1 1 1 1 0 100 2 1 1 0 011 1v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a1 1 0 011-1 1 1 0 100-2 1 1 0 01-1-1V6z"/></svg><span style="font-size:13px;font-weight:700;color:#f59e0b;">${totalTickets}</span>`;
                pill.style.cssText = 'display:flex;align-items:center;gap:5px;background:rgba(245,158,11,0.08);border:1.5px solid rgba(245,158,11,0.22);border-radius:12px;padding:6px 11px;text-decoration:none;transition:all 0.2s;';
                pill.onmouseenter = () => { pill.style.background='rgba(245,158,11,0.14)'; pill.style.borderColor='rgba(245,158,11,0.45)'; };
                pill.onmouseleave = () => { pill.style.background='rgba(245,158,11,0.08)'; pill.style.borderColor='rgba(245,158,11,0.22)'; };
                link.parentNode.insertBefore(pill, link);
            });
        }

        // Wallet balance pill — green, inserted before ticket pill
        if (!document.getElementById('nav-wallet-pill')) {
            const { data: walletProfile } = await window.supabaseClient
                .from('profiles').select('wallet_balance').eq('id', user.id).single();
            const bal = parseFloat(walletProfile?.wallet_balance || 0);
            const balStr = '£' + bal.toFixed(2);
            authLinks.forEach(link => {
                const wpill = document.createElement('a');
                wpill.id   = 'nav-wallet-pill';
                wpill.href = '/dashboard?wallet=open';
                wpill.title = 'My Wallet — click to top up';
                wpill.innerHTML = `<svg style="width:13px;height:13px;color:#10b981;flex-shrink:0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg><span id="nav-wallet-pill-bal" style="font-size:13px;font-weight:700;color:#10b981;">${balStr}</span>`;
                wpill.style.cssText = 'display:flex;align-items:center;gap:5px;background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.25);border-radius:12px;padding:6px 11px;text-decoration:none;transition:all 0.2s;';
                wpill.onmouseenter = () => { wpill.style.background='rgba(16,185,129,0.15)'; wpill.style.borderColor='rgba(16,185,129,0.5)'; };
                wpill.onmouseleave = () => { wpill.style.background='rgba(16,185,129,0.08)'; wpill.style.borderColor='rgba(16,185,129,0.25)'; };
                const ticketPill = document.getElementById('nav-ticket-pill');
                if (ticketPill) {
                    link.parentNode.insertBefore(wpill, ticketPill);
                } else {
                    link.parentNode.insertBefore(wpill, link);
                }
            });
        }

        // Referral processing is handled by onAuthStateChange above,
        // which fires at the exact moment the session is established.
    }

    // --- IF ON HOMEPAGE: INJECT LIVE RAFFLE STATS ---
    if (window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname.includes('index')) {
        const { data: raffles, error } = await window.supabaseClient
            .from('raffles')
            .select('id, tickets_sold, max_tickets, status')
            .eq('status', 'live');
            
        if (!error && raffles) {
            raffles.forEach(r => {
                const pct = Math.round((r.tickets_sold / r.max_tickets) * 100);
                
                // Find the elements on the page by ID and update them with DB values
                const statText = document.getElementById(`stat-text-${r.id}`);
                const statPct = document.getElementById(`stat-pct-${r.id}`);
                const statBar = document.getElementById(`stat-bar-${r.id}`);
                
                if (statText) statText.innerText = `${r.tickets_sold} / ${r.max_tickets} Sold`;
                if (statPct) statPct.innerText = `${pct}%`;
                if (statBar) statBar.style.width = `${pct}%`;
            });
        }
    }
});

// --- GLOBAL VAULT FETCHER (Fixed Race Condition) ---
window.loadGlobalVault = async function(passedUserId) {
    // Safely get the user ID exactly when the vault asks for it
    let userId = passedUserId;
    if (!userId) {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;
        userId = user.id;
    }
    
    const list = document.getElementById('ticket-list');
    if (!list) return;

    const { data: tickets, error } = await window.supabaseClient
        .from('user_tickets')
        .select(`
            id, qty, paypal_transaction_id, created_at,
            raffles ( title )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        // Vault fetch failed — details suppressed client-side
    }

    if (error || !tickets || tickets.length === 0) {
        list.innerHTML = `<p class="text-slate-400 p-6 bg-card rounded-xl border border-slate-800">Your vault is empty. <a href="/" class="text-brand hover:underline">View live draws</a>.</p>`;
        return;
    }

    // Format date helper
    const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

    list.innerHTML = tickets.map((t, i) => `
        <div class="vault-card rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/5"
             style="animation: floatUp 0.4s ${i * 0.06}s cubic-bezier(0.22,1,0.36,1) both;">
            <div class="flex items-center gap-5 w-full sm:w-auto">
                <!-- Ticket count badge (mini dartboard-inspired) -->
                <div class="relative w-16 h-16 flex-shrink-0 rounded-full border-2 border-brand/30 flex flex-col items-center justify-center bg-dark overflow-hidden shadow-[0_0_12px_rgba(220,38,38,0.15)]">
                    <div class="absolute inset-0 ticket-badge opacity-[0.12] rounded-full"></div>
                    <span class="relative text-[9px] text-brand font-bold uppercase tracking-wider leading-none">QTY</span>
                    <span class="relative text-2xl font-black text-white leading-none" style="font-family:'Barlow Condensed',sans-serif;">${t.qty}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0"></span>
                        <span class="text-[10px] text-success font-bold uppercase tracking-widest">Secured Entry</span>
                    </div>
                    <h3 class="font-bold text-white text-base leading-snug mb-1" style="font-family:'Barlow Condensed',sans-serif;font-size:1.15rem;">${t.raffles ? t.raffles.title : 'Free Welcome Tickets'}</h3>
                    <p class="text-[11px] text-slate-600 font-mono truncate max-w-xs">TX: ${t.paypal_transaction_id}</p>
                </div>
            </div>
            <div class="flex-shrink-0 pl-20 sm:pl-0">
                <p class="text-[10px] text-slate-600 font-medium uppercase tracking-wider">${fmtDate(t.created_at)}</p>
                <div class="mt-1 flex items-center gap-1.5 text-accent text-[10px] font-bold uppercase tracking-wider">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/></svg>
                    Draw Pending
                </div>
            </div>
        </div>
    `).join('');
};

// --- GLOBAL FREE SPIN INJECTOR ---
// Maximum tickets any wheel segment can award — enforced here server-side too
const FREE_SPIN_MAX = 3;

window.injectFreeTickets = async function(wonAmount) {
    // Clamp to the wheel's actual maximum regardless of what's passed in
    const safeQty = Math.min(Math.max(1, parseInt(wonAmount) || 1), FREE_SPIN_MAX);
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return false;

        // Server-side duplicate check — localStorage can be cleared by anyone,
        // so we verify against the DB that no FREE-SPIN row already exists
        const { data: existing } = await window.supabaseClient
            .from('user_tickets')
            .select('id')
            .eq('user_id', user.id)
            .ilike('paypal_transaction_id', 'FREE-SPIN-%')
            .limit(1)
            .maybeSingle();
        if (existing) return false;

        // 1. Ensure profile row exists
        await window.supabaseClient.from('profiles').upsert({ id: user.id, email: user.email });

        // 2. Fetch a £2 raffle for free spin tickets only
        const { data: raffles } = await window.supabaseClient
            .from('raffles')
            .select('id')
            .eq('price_per_ticket', 2)
            .eq('status', 'live')
            .limit(1);
        const fallbackId = (raffles && raffles.length > 0) ? raffles[0].id : null;

        // 3. Insert with capped qty
        const { error } = await window.supabaseClient.from('user_tickets').insert([{
            user_id: user.id,
            raffle_id: fallbackId,
            qty: safeQty,
            paypal_transaction_id: 'FREE-SPIN-' + Math.floor(Math.random() * 1000000),
            purchase_price: 0
        }]);

        if (error) return false;
        return true;
    } catch (err) {
        return false;
    }
};

// --- PAYMENT HELPERS ---
window.processPayment = async function(paypalOrderId, raffleId, quantity, promoCode, userId) {
    /**
     * Client-side wrapper that calls the Supabase Edge Function
     * This provides client-side validation before calling the secure backend
     */
    try {
        if (!paypalOrderId || !raffleId || !quantity || !userId) {
            throw new Error('Missing required payment fields');
        }

        const supabaseUrl = window.supabaseClient.supabaseUrl;
        const response = await fetch(`${supabaseUrl}/functions/v1/process-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                paypalOrderId,
                raffleId: parseInt(raffleId),
                quantity: parseInt(quantity),
                promoCode: promoCode ? promoCode.toUpperCase() : null,
                userId
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Payment processing failed');
        }

        return result;
    } catch (error) {
        throw error;
    }
};

// --- UTILITY: Refresh Vault After Purchase ---
window.refreshVaultAfterPurchase = async function(userId) {
    /**
     * Called after successful payment to reload vault UI
     */
    if (window.loadGlobalVault) {
        await window.loadGlobalVault(userId);
    }
};

// ============================================================
// --- THEME SYSTEM ---
// ============================================================

const OV_THEMES = {
    crimson: {
        id: 'crimson',
        name: 'Crimson Vault',
        emoji: '🎯',
        brand: '#dc2626', brandRgb: '220,38,38',
        brandDark: '#991b1b', brandDarker: '#7f1d1d',
        accent: '#f59e0b', accentRgb: '245,158,11',
        bg: '#0c1220', bgRgb: '12,18,32',
        card: '#141f35', cardRgb: '20,31,53',
    },
    neon: {
        id: 'neon',
        name: 'Neon Abyss',
        emoji: '⚡',
        brand: '#7c3aed', brandRgb: '124,58,237',
        brandDark: '#6d28d9', brandDarker: '#5b21b6',
        accent: '#22d3ee', accentRgb: '34,211,238',
        bg: '#08091c', bgRgb: '8,9,28',
        card: '#0e1133', cardRgb: '14,17,51',
    },
    arctic: {
        id: 'arctic',
        name: 'Arctic Steel',
        emoji: '❄️',
        brand: '#1d4ed8', brandRgb: '29,78,216',
        brandDark: '#1e40af', brandDarker: '#1e3a8a',
        accent: '#38bdf8', accentRgb: '56,189,248',
        bg: '#040e1c', bgRgb: '4,14,28',
        card: '#0a1829', cardRgb: '10,24,41',
    },
    emerald: {
        id: 'emerald',
        name: 'Emerald',
        emoji: '💎',
        brand: '#059669', brandRgb: '5,150,105',
        brandDark: '#047857', brandDarker: '#065f46',
        accent: '#fbbf24', accentRgb: '251,191,36',
        bg: '#04100c', bgRgb: '4,16,12',
        card: '#091a14', cardRgb: '9,26,20',
    },
    solar: {
        id: 'solar',
        name: 'Solar Flare',
        emoji: '🔥',
        brand: '#ea580c', brandRgb: '234,88,12',
        brandDark: '#c2410c', brandDarker: '#9a3412',
        accent: '#facc15', accentRgb: '250,204,21',
        bg: '#100a04', bgRgb: '16,10,4',
        card: '#1c1208', cardRgb: '28,18,8',
    },
};

function _buildThemeCSS(t) {
    return `
/* OcheVault Theme: ${t.name} */
:root {
  --ov-brand: ${t.brand};
  --ov-brand-rgb: ${t.brandRgb};
  --ov-brand-dark: ${t.brandDark};
  --ov-accent: ${t.accent};
  --ov-accent-rgb: ${t.accentRgb};
  --ov-bg: ${t.bg};
  --ov-card: ${t.card};
}

/* ── Backgrounds ── */
body                              { background-color: ${t.bg} !important; }
nav                               { background-color: rgba(${t.bgRgb},0.9) !important; }
.bg-dark                          { background-color: ${t.bg} !important; }
.bg-card                          { background-color: ${t.card} !important; }
.bg-brand                         { background-color: ${t.brand} !important; }
.bg-accent                        { background-color: ${t.accent} !important; }

/* ── Text ── */
.text-brand                       { color: ${t.brand} !important; }
.text-accent                      { color: ${t.accent} !important; }

/* ── Borders ── */
.border-brand                     { border-color: ${t.brand} !important; }
nav.border-b, nav.border-b-slate-700\\/40
                                  { border-bottom-color: rgba(${t.brandRgb},0.15) !important; }

/* ── Buttons ── */
.hover\\:bg-brand:hover,
.auth-link,
.tab-btn.active                   { background-color: ${t.brand} !important; }
.auth-link:hover                  { background-color: ${t.brandDark} !important; }
.tab-btn.active                   { box-shadow: 0 4px 14px rgba(${t.brandRgb},0.35) !important; }

/* ── Inputs ── */
.oche-input:focus,
input[class*="oche-input"]:focus  { border-color: ${t.brand} !important; box-shadow: 0 0 0 3px rgba(${t.brandRgb},0.12) !important; }

/* ── Cards with brand left-border ── */
.vault-card                       { border-left-color: ${t.brand} !important; }
.vault-card:hover                 { border-left-color: ${t.accent} !important; box-shadow: 0 12px 40px -10px rgba(0,0,0,0.6), -4px 0 0 0 ${t.accent} !important; }
.admin-card                       { border-left-color: ${t.brand} !important; }

/* ── Ticket badge conic ── */
.ticket-badge                     { background: conic-gradient(from 0deg, ${t.brand} 0deg 120deg, ${t.card} 120deg 240deg, ${t.brandDark} 240deg 360deg) !important; }

/* ── Dartboard background pattern ── */
.oche-bg                          { background-image: repeating-conic-gradient(from 0deg, rgba(${t.brandRgb},0.03) 0deg 18deg, rgba(255,255,255,0.008) 18deg 36deg) !important; }

/* ── Stat bars ── */
.stat-bar-brand                   { box-shadow: 0 0 8px rgba(${t.brandRgb},0.4) !important; }
.stat-bar-accent                  { box-shadow: 0 0 8px rgba(${t.accentRgb},0.4) !important; }

/* ── Glass card border tints ── */
.glass-card                       { border-color: rgba(${t.brandRgb},0.12) !important; }

/* ── Glow blobs ── */
.bg-brand\\/5, .bg-brand\\/6,
.bg-brand\\/8, .bg-brand\\/10,
.bg-brand\\/12, .bg-brand\\/15,
.bg-brand\\/20, .bg-brand\\/25    { background-color: rgba(${t.brandRgb},0.08) !important; }

/* ── Vault tab active ── */
.vault-tab.active {
  background: linear-gradient(135deg, rgba(${t.brandRgb},0.15), rgba(${t.brandRgb},0.06)) !important;
  color: ${t.brand} !important;
  border-color: rgba(${t.brandRgb},0.3) !important;
}

/* ── Admin btn brand ── */
.btn-brand { background: ${t.brand} !important; }
.btn-brand:hover { background: ${t.brandDark} !important; }

/* ── Leaderboard you row ── */
.lb-row.you {
  background: rgba(${t.brandRgb},0.07) !important;
  border-color: rgba(${t.brandRgb},0.22) !important;
}

/* ── Bg-card with opacity (nav backdrop, modal etc) ── */
.bg-card\\/70, .bg-card\\/80,
.bg-card\\/60, .bg-card\\/95      { background-color: rgba(${t.cardRgb},0.85) !important; }
`;
}

function applyTheme(name, save) {
    const t = OV_THEMES[name] || OV_THEMES.crimson;
    if (save !== false) localStorage.setItem('ov_theme', name);

    // Inject/update the theme stylesheet
    let el = document.getElementById('ov-theme-css');
    if (!el) {
        el = document.createElement('style');
        el.id = 'ov-theme-css';
        document.head.appendChild(el);
    }
    el.textContent = _buildThemeCSS(t);

    // Update SVG dartboard logos
    document.querySelectorAll('svg circle').forEach(c => {
        const f = c.getAttribute('fill');
        if (f === '#dc2626' || f === OV_THEMES.neon.brand || f === OV_THEMES.arctic.brand ||
            f === OV_THEMES.emerald.brand || f === OV_THEMES.solar.brand) {
            c.setAttribute('fill', t.brand);
        } else if (f === '#991b1b' || f === OV_THEMES.neon.brandDark || f === OV_THEMES.arctic.brandDark ||
                   f === OV_THEMES.emerald.brandDark || f === OV_THEMES.solar.brandDark) {
            c.setAttribute('fill', t.brandDark);
        } else if (f === '#0c1220' || f === OV_THEMES.neon.bg || f === OV_THEMES.arctic.bg ||
                   f === OV_THEMES.emerald.bg || f === OV_THEMES.solar.bg) {
            c.setAttribute('fill', t.bg);
        } else if (f === '#f59e0b' || f === OV_THEMES.neon.accent || f === OV_THEMES.arctic.accent ||
                   f === OV_THEMES.emerald.accent || f === OV_THEMES.solar.accent) {
            c.setAttribute('fill', t.accent);
        }
    });

    // Update active state on picker swatches if open
    document.querySelectorAll('.ov-theme-swatch').forEach(s => {
        const isActive = s.dataset.theme === name;
        s.style.transform = isActive ? 'scale(1.06)' : 'scale(1)';
        s.style.outline = isActive ? `2px solid ${t.accent}` : '2px solid transparent';
        s.style.outlineOffset = '3px';
    });

    document.documentElement.setAttribute('data-ov-theme', name);
}

function _renderThemePicker() {
    if (document.getElementById('ov-theme-picker')) return;

    const picker = document.createElement('div');
    picker.id = 'ov-theme-picker';
    picker.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
        font-family: 'Plus Jakarta Sans', sans-serif;
    `;

    const panel = document.createElement('div');
    panel.id = 'ov-theme-panel';
    panel.style.cssText = `
        background: rgba(14,17,51,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;
        padding: 16px; display: flex; flex-direction: column; gap: 8px;
        box-shadow: 0 24px 60px -12px rgba(0,0,0,0.7);
        transform: translateY(12px) scale(0.96); opacity: 0;
        transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease;
        pointer-events: none; width: 220px;
        transform-origin: bottom right;
    `;

    const label = document.createElement('p');
    label.textContent = 'CHOOSE THEME';
    label.style.cssText = `
        font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
        color: rgba(255,255,255,0.3); margin: 0 0 4px 4px;
    `;
    panel.appendChild(label);

    Object.values(OV_THEMES).forEach(t => {
        const swatch = document.createElement('button');
        swatch.className = 'ov-theme-swatch';
        swatch.dataset.theme = t.id;
        swatch.style.cssText = `
            display: flex; align-items: center; gap: 12px;
            padding: 10px 12px; border-radius: 12px; cursor: pointer;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
            transition: background 0.15s, transform 0.2s cubic-bezier(0.22,1,0.36,1), outline 0.15s;
            width: 100%; text-align: left; outline: 2px solid transparent; outline-offset: 3px;
        `;
        swatch.onmouseenter = () => { swatch.style.background = 'rgba(255,255,255,0.08)'; };
        swatch.onmouseleave = () => { swatch.style.background = 'rgba(255,255,255,0.04)'; };

        const dots = document.createElement('div');
        dots.style.cssText = 'display:flex;gap:5px;flex-shrink:0;';
        [t.brand, t.accent, t.card].forEach((col, i) => {
            const dot = document.createElement('span');
            dot.style.cssText = `
                width: ${i === 0 ? 14 : 10}px; height: ${i === 0 ? 14 : 10}px;
                border-radius: 50%; background: ${col};
                box-shadow: 0 0 6px ${col}80;
                flex-shrink: 0; align-self: center;
            `;
            dots.appendChild(dot);
        });

        const nameEl = document.createElement('span');
        nameEl.style.cssText = `font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.85); flex:1;`;
        nameEl.textContent = t.name;

        const emoji = document.createElement('span');
        emoji.style.cssText = 'font-size: 16px;';
        emoji.textContent = t.emoji;

        swatch.appendChild(dots);
        swatch.appendChild(nameEl);
        swatch.appendChild(emoji);

        swatch.onclick = () => {
            applyTheme(t.id);
            // Update panel background to match new theme
            panel.style.background = `rgba(${t.cardRgb},0.92)`;
            toggleBtn.style.background = t.brand;
        };
        panel.appendChild(swatch);
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'ov-theme-toggle';
    toggleBtn.title = 'Change theme';
    toggleBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2C6.5 2 2 6.5 2 12"/></svg>`;
    toggleBtn.style.cssText = `
        width: 46px; height: 46px; border-radius: 50%; cursor: pointer;
        background: #dc2626; color: white; border: none;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 0 rgba(220,38,38,0.4);
        transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s;
    `;
    toggleBtn.onmouseenter = () => { toggleBtn.style.transform = 'scale(1.1) rotate(30deg)'; };
    toggleBtn.onmouseleave = () => { toggleBtn.style.transform = 'scale(1) rotate(0deg)'; };

    let panelOpen = false;
    toggleBtn.onclick = () => {
        panelOpen = !panelOpen;
        if (panelOpen) {
            panel.style.pointerEvents = 'auto';
            panel.style.transform = 'translateY(0) scale(1)';
            panel.style.opacity = '1';
        } else {
            panel.style.pointerEvents = 'none';
            panel.style.transform = 'translateY(12px) scale(0.96)';
            panel.style.opacity = '0';
        }
    };

    // Close on outside click
    document.addEventListener('click', e => {
        if (panelOpen && !picker.contains(e.target)) {
            panelOpen = false;
            panel.style.pointerEvents = 'none';
            panel.style.transform = 'translateY(12px) scale(0.96)';
            panel.style.opacity = '0';
        }
    });

    picker.appendChild(panel);
    picker.appendChild(toggleBtn);
    document.body.appendChild(picker);
}

// ── Boot: apply saved theme immediately, render picker after DOM ready ──
(function () {
    const saved = localStorage.getItem('ov_theme') || 'crimson';
    // Apply theme CSS before paint to avoid flash
    const el = document.createElement('style');
    el.id = 'ov-theme-css';
    document.head.appendChild(el);
    el.textContent = _buildThemeCSS(OV_THEMES[saved] || OV_THEMES.crimson);
    document.documentElement.setAttribute('data-ov-theme', saved);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyTheme(saved, false); // re-run to catch SVGs
            _renderThemePicker();
            // Sync toggle button color to active theme
            const t = OV_THEMES[saved] || OV_THEMES.crimson;
            const btn = document.getElementById('ov-theme-toggle');
            if (btn) btn.style.background = t.brand;
        });
    } else {
        applyTheme(saved, false);
        _renderThemePicker();
        const t = OV_THEMES[saved] || OV_THEMES.crimson;
        const btn = document.getElementById('ov-theme-toggle');
        if (btn) btn.style.background = t.brand;
    }
})();