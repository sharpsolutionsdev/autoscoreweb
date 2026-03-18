// --- 1. INITIALIZE SUPABASE ---
const SUPABASE_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';

// Create client attached to window so all pages can use it
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    // --- GLOBAL AUTHENTICATION CHECK ---
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    
    // Find all "Sign In" buttons
    const authLinks = document.querySelectorAll('.auth-link');
    
    if (user) {
        // Fetch their OcheTag (username)
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
            
        const displayName = profile?.username ? profile.username : 'My Vault';
        
        // Update navigation buttons dynamically
        authLinks.forEach(link => {
            link.href = "dashboard.html";
            link.innerText = displayName;
            link.classList.remove('bg-card', 'text-white', 'border-slate-700');
            link.classList.add('bg-brand', 'text-white', 'border-brand');
        });
    }

    // --- IF ON HOMEPAGE: INJECT LIVE RAFFLE STATS ---
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
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
        list.innerHTML = `<p class="text-slate-400 p-6 bg-card rounded-xl border border-slate-800">Your vault is empty. <a href="index.html" class="text-brand hover:underline">View live draws</a>.</p>`;
        return;
    }

    list.innerHTML = tickets.map(t => `
        <div class="bg-card border border-brand/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-lg mb-4 hover:border-brand/50 transition-colors">
            <div class="flex items-center gap-6 mb-4 md:mb-0 w-full md:w-auto">
                <div class="w-16 h-16 bg-dark rounded-lg border border-brand/30 flex flex-col items-center justify-center text-white font-black shadow-inner">
                    <span class="text-xs text-brand font-bold">QTY</span>
                    <span class="text-xl">${t.qty}</span>
                </div>
                <div>
                    <div class="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> SECURED ENTRY
                    </div>
                    <h3 class="text-lg font-bold text-white">${t.raffles ? t.raffles.title : 'Free Welcome Tickets'}</h3>
                    <p class="text-xs text-slate-500 font-mono mt-1">TX: ${t.paypal_transaction_id}</p>
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