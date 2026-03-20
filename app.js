// --- 1. INITIALIZE SUPABASE ---
const SUPABASE_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';

// Create client attached to window so all pages can use it
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

        // --- PROCESS REFERRAL IF PRESENT ---
        // Check both localStorage AND URL params (magic link may open in different browser)
        const urlRefParams = new URLSearchParams(window.location.search);
        const refCode = localStorage.getItem('ochevault_ref') || urlRefParams.get('ref');
        if (refCode) {
            localStorage.removeItem('ochevault_ref');
            // Clean the ref param from URL without reload
            if (urlRefParams.get('ref')) {
                urlRefParams.delete('ref');
                const cleanUrl = urlRefParams.toString()
                    ? window.location.pathname + '?' + urlRefParams.toString()
                    : window.location.pathname;
                window.history.replaceState({}, '', cleanUrl);
            }
            try {
                // Find the referrer by their referral code
                const { data: referrer } = await window.supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('referral_code', refCode)
                    .single();

                if (referrer && referrer.id !== user.id) {
                    // Update referral record: set referred_user_id and status to signed_up
                    await window.supabaseClient
                        .from('referrals')
                        .update({ referred_user_id: user.id, status: 'signed_up' })
                        .eq('referrer_id', referrer.id)
                        .eq('referred_email', user.email)
                        .eq('status', 'pending');

                    // Also try to create a referral if the referrer shared the link
                    // but didn't manually invite this specific email
                    const { data: existing } = await window.supabaseClient
                        .from('referrals')
                        .select('id')
                        .eq('referrer_id', referrer.id)
                        .eq('referred_email', user.email)
                        .limit(1);

                    if (!existing || existing.length === 0) {
                        await window.supabaseClient.from('referrals').insert([{
                            referrer_id: referrer.id,
                            referred_email: user.email,
                            referred_user_id: user.id,
                            status: 'signed_up'
                        }]);
                    }
                }
            } catch (e) {
                console.error('Referral processing error:', e);
            }
        }
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
        console.error("Error fetching vault:", error);
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

// --- GLOBAL FREE SPIN INJECTOR (Fixed Race Condition) ---
window.injectFreeTickets = async function(wonAmount) {
    try {
        // Explicitly await the user to guarantee we have their ID
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return false;
        
        // 1. Ensure Profile Exists (Email tracking)
        await window.supabaseClient.from('profiles').upsert({ id: user.id, email: user.email });
        
        // 2. Dynamically fetch a valid Raffle ID safely without crashing
        const { data: raffles, error: raffleErr } = await window.supabaseClient.from('raffles').select('id').limit(1);
        const fallbackId = (raffles && raffles.length > 0) ? raffles[0].id : null;

        // 3. Insert Tickets Safely
        const { error } = await window.supabaseClient.from('user_tickets').insert([{
            user_id: user.id,
            raffle_id: fallbackId, 
            qty: wonAmount,
            paypal_transaction_id: 'FREE-SPIN-' + Math.floor(Math.random()*1000000),
            purchase_price: 0
        }]);

        if (error) {
            console.error("Critical DB Insert Error:", error);
            return false;
        }
        return true;
    } catch (err) {
        console.error("Error injecting tickets:", err);
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
            console.error('Payment processing error:', result);
            throw new Error(result.error || 'Payment processing failed');
        }

        return result;
    } catch (error) {
        console.error('Payment error:', error);
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