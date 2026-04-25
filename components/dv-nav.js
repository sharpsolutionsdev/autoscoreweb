class DvNav extends HTMLElement {
  connectedCallback() {
    this.render();
    this.bindMenu();
    this.bindLeaderboard();
    this.initAuth();
  }

  render() {
    this.innerHTML = `
      <nav class="fixed top-0 w-full z-50 bg-dark/85 backdrop-blur-xl border-b border-wire/60">
        <div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" class="flex items-center gap-2.5 group">
            <img src="/logo-transparent.png" alt="DartVoice" class="w-8 h-8 shrink-0" style="object-fit:contain;">
            <span class="display text-lg group-hover:text-brand transition-colors">DARTVOICE</span>
          </a>
          <div class="hidden sm:flex items-center gap-1">
            <a href="/#features" class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2">Features</a>
            <a href="/#pricing" class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2">Pricing</a>
            <a href="/web-app" class="nav-link text-sm text-brand font-bold hover:text-brand-light transition px-3 py-2 flex items-center gap-1.5">
              <img src="/dc-logo.png" alt="Dart Counter" class="w-5 h-5 rounded" style="image-rendering:auto;">
              Web App
              <span class="flex h-2 w-2 relative -top-1"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-brand"></span></span>
            </a>
            <div class="relative" id="nav-lb-wrap">
              <button type="button" id="nav-lb-btn"
                class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2 flex items-center gap-1.5"
                aria-haspopup="true" aria-expanded="false" aria-controls="nav-lb-menu" title="Live Ranked Leaderboard">
                <svg class="w-3.5 h-3.5 text-brand" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2c0 3.31-2.06 6.13-4.96 7.27.46 1.31 1.36 2.41 2.54 3.13l-1 2.6H8.42l-1-2.6c1.18-.72 2.08-1.82 2.54-3.13C7.06 11.13 5 8.31 5 5V3zm2 2v0c0 2.36 1.5 4.36 3.6 5.13L11 11h2l.4-.87C15.5 9.36 17 7.36 17 5H7zM6 20h12v2H6v-2z"/></svg>
                Leaderboard
                <svg class="w-3 h-3 transition-transform" id="nav-lb-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div id="nav-lb-menu"
                class="absolute right-0 top-full mt-1 w-[320px] rounded-xl border border-wire/60 bg-dark/95 backdrop-blur-xl shadow-2xl opacity-0 invisible translate-y-1 transition-all duration-150 overflow-hidden">
                <div class="px-4 pt-3 pb-2 flex items-center justify-between border-b border-wire/40">
                  <div>
                    <p class="text-[10px] font-bold tracking-widest text-brand uppercase">Top Ranked</p>
                    <p class="text-xs text-muted">Live MMR rankings</p>
                  </div>
                  <a href="/ranked" class="text-[11px] text-muted hover:text-chalk transition">View all →</a>
                </div>
                <div id="nav-lb-list" class="py-1 max-h-[340px] overflow-y-auto">
                  <div class="px-4 py-6 text-center text-xs text-muted">Loading…</div>
                </div>
              </div>
            </div>
            <div class="relative group" id="nav-more">
              <button type="button" id="nav-more-btn"
                class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2 flex items-center gap-1"
                aria-haspopup="true" aria-expanded="false">
                More
                <svg class="w-3 h-3 transition-transform group-hover:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div id="nav-more-menu"
                class="absolute right-0 top-full mt-1 min-w-[180px] rounded-xl border border-wire/60 bg-dark/95 backdrop-blur-xl shadow-2xl py-2 opacity-0 invisible translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
                <a href="/how-it-works" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">How It Works</a>
                <a href="/ranked" class="flex items-center gap-1.5 px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">
                  <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block"></span>Ranked
                </a>
                <a href="/#brand-ambassador" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Brand Ambassador</a>
                <a href="/guide" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Setup Guide</a>
                <a href="/referral" class="flex items-center gap-1.5 px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">
                  <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block"></span>Ambassador
                </a>
                <a href="/contact" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Contact</a>
              </div>
            </div>
          </div>
          <div id="dv-nav-auth-desktop" class="hidden sm:flex items-center gap-3 ml-2">
            <div data-dv-currency-mount></div>
            <div class="w-px h-4 bg-wire/50"></div>
            <a href="https://instagram.com/dartvoiceapp" target="_blank" rel="noopener" class="text-muted hover:text-brand transition" title="Follow @dartvoiceapp on Instagram" aria-label="Instagram">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.43.403a4.08 4.08 0 011.47.96c.458.457.779.91.96 1.47.163.46.349 1.26.403 2.43.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.403 2.43a4.08 4.08 0 01-.96 1.47 4.08 4.08 0 01-1.47.96c-.46.163-1.26.349-2.43.403-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.43-.403a4.08 4.08 0 01-1.47-.96 4.08 4.08 0 01-.96-1.47c-.163-.46-.349-1.26-.403-2.43C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.054-1.17.24-1.97.403-2.43a4.08 4.08 0 01.96-1.47 4.08 4.08 0 011.47-.96c.46-.163 1.26-.349 2.43-.403C8.416 2.175 8.796 2.163 12 2.163zM12 0C8.741 0 8.333.014 7.053.072 5.775.13 4.903.333 4.14.63a5.88 5.88 0 00-2.126 1.384A5.88 5.88 0 00.63 4.14C.333 4.903.13 5.775.072 7.053.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.058 1.278.261 2.15.558 2.913a5.88 5.88 0 001.384 2.126A5.88 5.88 0 004.14 23.37c.763.297 1.635.5 2.913.558C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.278-.058 2.15-.261 2.913-.558a6.14 6.14 0 002.126-1.384 5.88 5.88 0 001.384-2.126c.297-.763.5-1.635.558-2.913.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.058-1.278-.261-2.15-.558-2.913a5.88 5.88 0 00-1.384-2.126A5.88 5.88 0 0019.86.63c-.763-.297-1.635-.5-2.913-.558C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"/></svg>
            </a>
            <div class="w-px h-4 bg-wire/50"></div>
            <a href="/login" class="btn-outline px-5 py-2.5 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold min-h-[44px] sm:min-h-0 text-chalk">Sign In</a>
            <a href="/login?intent=subscribe" class="btn-brand px-5 py-2.5 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold min-h-[44px] sm:min-h-0 text-white">Start Free Trial</a>
          </div>
          <button id="mob-btn-nav" class="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition" aria-label="Open navigation menu">
            <svg class="w-5 h-5 text-chalk" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
        <div id="mob-nav" style="max-height:0;overflow:hidden;transition:max-height .35s ease" class="sm:hidden border-t border-wire/50 bg-dark/95 backdrop-blur-xl">
          <div class="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-1">
            <a href="/#features" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30">Features</a>
            <a href="/how-it-works" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30">How It Works</a>
            <a href="/#pricing" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30">Pricing</a>
            <a href="/#brand-ambassador" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30">Brand Ambassador</a>
            <a href="/guide" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30">Setup Guide</a>
            <a href="/web-app" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30 flex items-center gap-2">
              <img src="/dc-logo.png" alt="Dart Counter" class="w-5 h-5 rounded">
              Web App
            </a>
            <a href="/ranked" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>Ranked
            </a>
            <div class="px-2 pt-2 pb-1 flex items-center justify-between">
              <p class="text-[10px] font-bold tracking-widest text-brand uppercase">Top Ranked</p>
              <a href="/ranked" class="text-[11px] text-muted hover:text-chalk">View all →</a>
            </div>
            <div id="nav-lb-list-mobile" class="rounded-lg border border-wire/40 bg-black/30 mb-1">
              <div class="px-3 py-3 text-center text-[11px] text-muted">Loading…</div>
            </div>
            <a href="/referral" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>Ambassador Program
            </a>
            <a href="/contact" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 rounded-lg hover:bg-wire/30">Contact</a>
            <div id="dv-nav-auth-mobile" class="border-t border-wire/50 mt-1 pt-3 grid grid-cols-2 gap-2">
              <a href="/login" class="btn-outline px-3 py-2.5 rounded-lg text-sm font-semibold text-center text-chalk">Sign In</a>
              <a href="/login?intent=subscribe" class="btn-brand px-3 py-2.5 rounded-lg text-sm font-semibold text-center text-white">Start Free Trial</a>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  bindMenu() {
    const button = this.querySelector('#mob-btn-nav');
    const menu = this.querySelector('#mob-nav');
    if (!button || !menu) return;

    button.addEventListener('click', () => {
      const isOpen = menu.style.maxHeight && menu.style.maxHeight !== '0px';
      menu.style.maxHeight = isOpen ? '0px' : '560px';
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menu.style.maxHeight = '0px';
      });
    });
  }

  /**
   * Live ranked leaderboard popover. Fetches top 8 ranked profiles by MMR
   * via Supabase REST. Reuses anon key. RLS allows public select on ranked_profiles.
   */
  bindLeaderboard() {
    const wrap = this.querySelector('#nav-lb-wrap');
    const btn  = this.querySelector('#nav-lb-btn');
    const menu = this.querySelector('#nav-lb-menu');
    const chev = this.querySelector('#nav-lb-chev');
    const list = this.querySelector('#nav-lb-list');
    const listMob = this.querySelector('#nav-lb-list-mobile');
    if (!wrap || !btn || !menu || !list) return;

    const setOpen = (open) => {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        menu.classList.remove('opacity-0', 'invisible', 'translate-y-1');
        menu.classList.add('opacity-100', 'visible', 'translate-y-0');
        chev?.classList.add('rotate-180');
      } else {
        menu.classList.add('opacity-0', 'invisible', 'translate-y-1');
        menu.classList.remove('opacity-100', 'visible', 'translate-y-0');
        chev?.classList.remove('rotate-180');
      }
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = btn.getAttribute('aria-expanded') === 'true';
      setOpen(!open);
      if (!open) this.loadLeaderboard(list, listMob);
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    // Pre-warm mobile list once nav menu first opens.
    const mobBtn = this.querySelector('#mob-btn-nav');
    if (mobBtn && listMob) {
      mobBtn.addEventListener('click', () => {
        if (!listMob.dataset.loaded) this.loadLeaderboard(null, listMob);
      }, { once: false });
    }
  }

  /** Tier badge color */
  static tierColor(tier) {
    const t = (tier || '').toLowerCase();
    if (t.includes('grand')) return '#a855f7';
    if (t.includes('master')) return '#ef4444';
    if (t.includes('diamond')) return '#06b6d4';
    if (t.includes('plat')) return '#22d3ee';
    if (t.includes('gold')) return '#f59e0b';
    if (t.includes('silver')) return '#cbd5e1';
    if (t.includes('bronze')) return '#b45309';
    return '#94a3b8';
  }

  async loadLeaderboard(listEl, listMobEl) {
    const SB_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';
    const targets = [listEl, listMobEl].filter(Boolean);
    try {
      const url = `${SB_URL}/rest/v1/ranked_profiles?select=id,display_name,mmr,rank_tier,wins,losses,avatar_url&order=mmr.desc&limit=8`;
      const resp = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      const rows = resp.ok ? await resp.json() : [];
      const html = (rows && rows.length)
        ? rows.map((r, i) => {
            const name = this.escapeHtml(r.display_name || 'Player');
            const tier = (r.rank_tier || 'silver').toString().toUpperCase();
            const tierC = DvNav.tierColor(r.rank_tier);
            const w = r.wins || 0; const l = r.losses || 0;
            const wr = (w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0;
            const av = r.avatar_url
              ? `<img src="${this.escapeHtml(r.avatar_url)}" alt="" class="w-7 h-7 rounded-full object-cover">`
              : `<div class="w-7 h-7 rounded-full bg-wire/40 flex items-center justify-center text-[10px] font-bold text-muted">${name.slice(0,1).toUpperCase()}</div>`;
            return `
              <div class="flex items-center gap-2.5 px-3 py-2 hover:bg-wire/20 transition">
                <span class="text-[11px] font-bold w-5 text-right" style="color:${i < 3 ? '#f59e0b' : '#6b7280'}">#${i + 1}</span>
                ${av}
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-chalk font-semibold truncate">${name}</p>
                  <p class="text-[10px] text-muted">${w}W · ${l}L · ${wr}% WR</p>
                </div>
                <div class="text-right">
                  <p class="text-xs font-bold text-chalk">${r.mmr ?? '—'}</p>
                  <p class="text-[9px] font-bold tracking-wider" style="color:${tierC}">${this.escapeHtml(tier)}</p>
                </div>
              </div>`;
          }).join('')
        : `<div class="px-4 py-6 text-center text-xs text-muted">No ranked players yet.<br><a href="/ranked" class="text-brand hover:underline">Be the first →</a></div>`;
      targets.forEach(el => { el.innerHTML = html; el.dataset.loaded = '1'; });
    } catch (e) {
      const errHtml = `<div class="px-4 py-6 text-center text-xs text-muted">Couldn’t load leaderboard.</div>`;
      targets.forEach(el => { el.innerHTML = errHtml; });
    }
  }

  initAuth() {
    const start = () => {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') return false;

      const SB_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
      const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';
      const sb = window.supabase.createClient(SB_URL, SB_KEY);

      const updateAuth = (email) => {
        const desktop = this.querySelector('#dv-nav-auth-desktop');
        const mobile = this.querySelector('#dv-nav-auth-mobile');
        const safeEmail = this.escapeHtml(email);

        if (desktop) {
          desktop.innerHTML = `
            <div data-dv-currency-mount></div>
            <a href="/dartvoice-dashboard" class="text-sm text-muted hover:text-chalk transition px-3 py-2">My Dashboard</a>
            <div class="w-px h-4 bg-wire/50"></div>
            <span class="text-xs text-muted truncate max-w-[160px]">${safeEmail}</span>
            <button type="button" data-dv-signout class="text-xs text-muted hover:text-chalk transition px-3 py-1.5 rounded-lg hover:bg-wire/30">Sign Out</button>
          `;
        }

        if (mobile) {
          mobile.innerHTML = `
            <p class="text-xs text-muted truncate px-2 mb-2 col-span-2">${safeEmail}</p>
            <a href="/dartvoice-dashboard" class="bg-brand rounded-lg px-3 py-2.5 text-sm font-semibold text-center text-white hover:bg-red-600 transition">My Dashboard</a>
            <button type="button" data-dv-signout class="border border-wire rounded-lg px-3 py-2.5 text-sm font-semibold text-center text-chalk hover:bg-white/5 transition">Sign Out</button>
          `;
        }

        this.querySelectorAll('[data-dv-signout]').forEach((button) => {
          button.addEventListener('click', () => {
            sb.auth.signOut().then(() => {
              window.location.reload();
            });
          });
        });
      };

      sb.auth.getSession().then((res) => {
        const session = res.data && res.data.session;
        if (session && session.user) {
          updateAuth(session.user.email || '');
        }
      }).catch(() => {});

      return true;
    };

    if (start()) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (start() || attempts >= 20) {
        window.clearInterval(timer);
      }
    }, 250);
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  }
}

customElements.define('dv-nav', DvNav);

/* ──────────────────────────────────────────────────────────────────────
   Auto-inject leaderboard pill into pages that use an inline <nav>
   instead of <dv-nav>. Runs on DOMContentLoaded; bails out if a
   <dv-nav> element is present (it already has the pill) or if a
   #nav-lb-btn already exists in the DOM.
   ────────────────────────────────────────────────────────────────────── */
(function dvLeaderboardPill() {
  const SB_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';

  // Same 6-tier ladder used on ranked.html — kept in sync intentionally.
  const RANKS = [
    { name:'bronze',   min:0,    color:'#cd7f32' },
    { name:'silver',   min:800,  color:'#c0c0c0' },
    { name:'gold',     min:1200, color:'#ffd700' },
    { name:'platinum', min:1600, color:'#e5e4e2' },
    { name:'diamond',  min:2000, color:'#b9f2ff' },
    { name:'champion', min:2400, color:'#CC0B20' }
  ];
  function rankInfo(mmr) {
    const m = Math.max(0, Number(mmr) || 0);
    let i = 0;
    for (let k = 0; k < RANKS.length; k++) if (m >= RANKS[k].min) i = k;
    const cur = RANKS[i];
    const next = RANKS[i + 1];
    const span = next ? (next.min - cur.min) : 600;
    const seg  = Math.min(2, Math.floor((m - cur.min) / (span / 3)));
    const div  = ['III','II','I'][seg];
    const cap  = cur.name.charAt(0).toUpperCase() + cur.name.slice(1);
    return { name: cur.name, color: cur.color, division: div, label: `${cap} ${div}` };
  }
  function flagEmoji(cc) {
    if (!cc || typeof cc !== 'string' || cc.length !== 2) return '';
    const A = 0x1F1E6;
    const c = cc.toUpperCase();
    return String.fromCodePoint(A + (c.charCodeAt(0) - 65)) + String.fromCodePoint(A + (c.charCodeAt(1) - 65));
  }
  function esc(v) {
    const d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  function makePillHtml() {
    return `
      <div class="relative" id="dvlb-wrap" style="display:inline-block;">
        <button type="button" id="dvlb-btn"
          class="text-sm transition px-3 py-2 flex items-center gap-1.5"
          style="color:rgba(255,255,255,0.65);background:transparent;border:0;cursor:pointer;font:inherit;"
          aria-haspopup="true" aria-expanded="false" title="Live Ranked Leaderboard">
          <svg style="width:14px;height:14px;color:#CC0B20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2c0 3.31-2.06 6.13-4.96 7.27.46 1.31 1.36 2.41 2.54 3.13l-1 2.6H8.42l-1-2.6c1.18-.72 2.08-1.82 2.54-3.13C7.06 11.13 5 8.31 5 5V3zm2 2v0c0 2.36 1.5 4.36 3.6 5.13L11 11h2l.4-.87C15.5 9.36 17 7.36 17 5H7zM6 20h12v2H6v-2z"/></svg>
          <span>Leaderboard</span>
          <svg id="dvlb-chev" style="width:12px;height:12px;transition:transform .15s" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div id="dvlb-menu"
          style="position:absolute;right:0;top:100%;margin-top:4px;width:320px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(10,10,10,0.96);backdrop-filter:blur(16px);box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;opacity:0;visibility:hidden;transform:translateY(4px);transition:all .15s;z-index:60;">
          <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
            <div>
              <p style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#CC0B20;margin:0;">Top Ranked</p>
              <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;">Live MMR rankings</p>
            </div>
            <a href="/ranked" style="font-size:11px;color:rgba(255,255,255,0.5);text-decoration:none;">View all →</a>
          </div>
          <div id="dvlb-list" style="padding:4px 0;max-height:340px;overflow-y:auto;">
            <div style="padding:24px;text-align:center;font-size:12px;color:rgba(255,255,255,0.5);">Loading…</div>
          </div>
        </div>
      </div>`;
  }

  async function loadList(listEl) {
    try {
      const url = `${SB_URL}/rest/v1/ranked_profiles?select=id,display_name,mmr,wins,losses&is_placed=eq.true&order=mmr.desc&limit=8`;
      const resp = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      const rows = resp.ok ? await resp.json() : [];
      if (!rows.length) {
        listEl.innerHTML = `<div style="padding:24px;text-align:center;font-size:12px;color:rgba(255,255,255,0.5);">No ranked players yet.<br><a href="/ranked" style="color:#CC0B20;">Be the first →</a></div>`;
        return;
      }
      // Try to enrich with avatars + country codes. Best-effort.
      let avatarMap = {}, countryMap = {};
      try {
        const ids = rows.map(r => r.id);
        const inList = ids.map(i => `"${i}"`).join(',');
        const url2 = `${SB_URL}/rest/v1/dartvoice_profiles?select=id,avatar_url,country_code&id=in.(${inList})`;
        const r2 = await fetch(url2, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
        if (r2.ok) {
          const profs = await r2.json();
          profs.forEach(p => {
            if (p.avatar_url) avatarMap[p.id] = p.avatar_url;
            if (p.country_code) countryMap[p.id] = p.country_code;
          });
        }
      } catch(_){}
      listEl.innerHTML = rows.map((r, i) => {
        const name = esc(r.display_name || 'Player');
        const ri = rankInfo(r.mmr || 1200);
        const w = r.wins || 0, l = r.losses || 0;
        const wr = (w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0;
        const av = avatarMap[r.id]
          ? `<img src="${esc(avatarMap[r.id])}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
          : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);flex-shrink:0;">${name.slice(0,1).toUpperCase()}</div>`;
        const flag = flagEmoji(countryMap[r.id]);
        const posColor = i < 3 ? '#f59e0b' : 'rgba(255,255,255,0.4)';
        return `
          <a href="/ranked" style="display:flex;align-items:center;gap:10px;padding:8px 14px;text-decoration:none;color:inherit;transition:background .12s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
            <span style="font-size:11px;font-weight:700;width:20px;text-align:right;color:${posColor};">#${i + 1}</span>
            ${av}
            <div style="flex:1;min-width:0;">
              <p style="font-size:12px;font-weight:600;color:#fff;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${flag ? `<span style="margin-right:4px;font-size:13px;">${flag}</span>` : ''}${name}</p>
              <p style="font-size:10px;color:rgba(255,255,255,0.45);margin:1px 0 0;">${w}W · ${l}L · ${wr}% WR</p>
            </div>
            <div style="text-align:right;">
              <p style="font-size:12px;font-weight:700;color:#fff;margin:0;">${r.mmr ?? '—'}</p>
              <p style="font-size:9px;font-weight:700;letter-spacing:.06em;margin:1px 0 0;color:${ri.color};">${esc(ri.label)}</p>
            </div>
          </a>`;
      }).join('');
    } catch (e) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;font-size:12px;color:rgba(255,255,255,0.5);">Couldn’t load leaderboard.</div>`;
    }
  }

  function inject() {
    if (document.querySelector('dv-nav')) return;        // already handled by component
    if (document.getElementById('nav-lb-btn')) return;   // duplicate
    if (document.getElementById('dvlb-btn')) return;     // already injected
    // Find the auth/CTA cluster on the right side of the inline nav.
    const authBlock =
      document.getElementById('nav-auth-desktop') ||
      document.querySelector('nav .hidden.sm\\:flex.items-center.gap-3') ||
      null;
    if (!authBlock) return;
    const wrap = document.createElement('span');
    wrap.innerHTML = makePillHtml();
    // Insert before the auth block so it sits between page links and Sign In.
    authBlock.parentNode.insertBefore(wrap.firstElementChild, authBlock);

    const btn  = document.getElementById('dvlb-btn');
    const menu = document.getElementById('dvlb-menu');
    const list = document.getElementById('dvlb-list');
    const chev = document.getElementById('dvlb-chev');
    const wrapEl = document.getElementById('dvlb-wrap');
    if (!btn || !menu || !list) return;

    const setOpen = (open) => {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.style.opacity    = open ? '1' : '0';
      menu.style.visibility = open ? 'visible' : 'hidden';
      menu.style.transform  = open ? 'translateY(0)' : 'translateY(4px)';
      if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = btn.getAttribute('aria-expanded') === 'true';
      setOpen(!open);
      if (!open && !list.dataset.loaded) { loadList(list); list.dataset.loaded = '1'; }
    });
    document.addEventListener('click', (e) => { if (!wrapEl.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
