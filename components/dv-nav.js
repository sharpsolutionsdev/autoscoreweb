class DvNav extends HTMLElement {
  connectedCallback() {
    this.render();
    this.bindMenu();
    this.bindLeaderboard();
    this.initAuth();
    this.markActive();
    DvNav.installScrollTrail();
    DvNav.installScrollReveal();
  }

  /**
   * Highlight the nav link that matches the current page so users always
   * know where they are. Adds an underline + brand colour and aria-current.
   */
  markActive() {
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    const here = path.toLowerCase();
    const links = this.querySelectorAll('a[href]');
    links.forEach((a) => {
      const rawHref = a.getAttribute('href') || '';
      const href = rawHref.split('#')[0].split('?')[0];
      if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
      // Anchor-only or hash links to the current page should NOT mark the
      // link as the active page — otherwise on `/` every `/#section` link
      // gets a red underline.
      const hasHash = rawHref.indexOf('#') !== -1;
      const target = href.replace(/\/+$/, '').replace(/\.html$/, '').toLowerCase() || '/';
      const match =
        !hasHash && (
          target === here ||
          target === here + '.html' ||
          target === here.replace(/\.html$/, '') ||
          (target !== '/' && (here.endsWith(target) || here === target.replace(/^\//, '')))
        );
      if (match) {
        a.setAttribute('aria-current', 'page');
        a.classList.add('dv-nav-active');
        a.style.color = 'var(--brand)';
      }
    });
    // Inject a tiny stylesheet for the active marker (idempotent).
    if (!document.getElementById('dv-nav-active-style')) {
      const s = document.createElement('style');
      s.id = 'dv-nav-active-style';
      s.textContent = `
        .dv-nav-active { position: relative; }
        .dv-nav-active::after {
          content:''; position:absolute; left:10px; right:10px; bottom:-2px;
          height:2px; background:var(--brand); border-radius:2px;
          box-shadow:0 0 8px rgba(var(--brand-rgb),.55);
        }
        /* Premium glassy mobile burger menu links */
        #mob-nav .dv-mob-link {
          display:block; font-size:14px; font-weight:600;
          color:#D5D5DE; text-decoration:none;
          padding:11px 14px; border-radius:12px;
          border:1px solid transparent;
          background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005));
          transition:background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease;
        }
        #mob-nav .dv-mob-link:hover,
        #mob-nav .dv-mob-link:focus-visible {
          color:#FFFFFF;
          background:linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border-color:rgba(255,255,255,0.08);
        }
        #mob-nav .dv-mob-link.dv-nav-active {
          color:#FFFFFF;
          background:linear-gradient(90deg, rgba(204,11,32,0.16), rgba(204,11,32,0.02));
          border-color:rgba(204,11,32,0.32);
        }
        #mob-nav .dv-mob-link-feature {
          display:flex; align-items:center; gap:10px;
          font-size:14px; font-weight:700; color:#FFFFFF;
          padding:11px 14px; border-radius:12px;
          text-decoration:none;
          transition:transform .18s ease, filter .18s ease;
        }
        #mob-nav .dv-mob-link-feature:hover { filter:brightness(1.12); transform:translateX(2px); }
        `;
      document.head.appendChild(s);
    }
  }

  /**
   * Dart-trail scroll indicator — a thin red bar with a glowing tip
   * fixed to the right edge of the viewport that fills as the user
   * scrolls. Uses a CSS variable updated on scroll.
   */
  static installScrollTrail() {
    if (document.querySelector('.dv-scroll-trail')) return;
    const reduce =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const el = document.createElement('div');
    el.className = 'dv-scroll-trail';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = (h.scrollHeight - h.clientHeight) || 1;
        const pct = Math.min(100, Math.max(0, (h.scrollTop || window.scrollY) / max * 100));
        el.style.setProperty('--dv-scroll', pct.toFixed(2) + '%');
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  /**
   * Scroll-reveal for any element with class `.reveal`. Uses a single
   * IntersectionObserver and unobserves after first reveal.
   */
  static installScrollReveal() {
    if (DvNav._revealInstalled) return;
    DvNav._revealInstalled = true;
    const reduce =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = (el) => el.classList.add('in-view');
    const items = () => document.querySelectorAll('.reveal:not(.in-view)');
    if (reduce || !('IntersectionObserver' in window)) {
      items().forEach(reveal);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal(e.target);
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    const observe = () => items().forEach((el) => io.observe(el));
    observe();
    // Re-observe if pages inject more `.reveal` nodes later.
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  render() {
    this.innerHTML = `
      <nav class="fixed top-0 w-full z-50 bg-dark/85 backdrop-blur-xl border-b border-wire/60">
        <div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <a href="/" class="flex items-center gap-2.5 group shrink-0">
            <img src="/logo-transparent.png" alt="DartVoice" class="w-8 h-8 shrink-0" style="object-fit:contain;">
            <span class="display text-lg group-hover:text-brand transition-colors">DARTVOICE</span>
          </a>
          <div class="hidden lg:flex items-center gap-0.5">
            <a href="/web-app" class="nav-link text-sm text-brand font-bold hover:text-brand-light transition px-2.5 py-2 flex items-center gap-1.5">
              <img src="/dc-logo.png" alt="Dart Counter" class="w-5 h-5 rounded" style="image-rendering:auto;">
              Web App
              <span class="flex h-2 w-2 relative -top-1"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-brand"></span></span>
            </a>
            <a href="/ranked" class="nav-link text-sm font-bold transition px-2.5 py-2 flex items-center gap-1.5 relative group" style="color:#f0f0f5;" title="Ranked Hub · MMR ladder, friends & stats">
              <span class="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition" style="background:linear-gradient(135deg, rgba(204,11,32,0.18), transparent 70%);"></span>
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color:var(--brand,#CC0B20);"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h4l1 4a4 4 0 008 0l1-4h4M5 4v3a4 4 0 004 4h6a4 4 0 004-4V4M9 22h6M12 15v7"/></svg>
              <span class="relative">Ranked</span>
              <span class="relative text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded" style="background:rgba(204,11,32,0.15); color:var(--brand,#CC0B20); border:1px solid rgba(204,11,32,0.4);">PRO</span>
            </a>
            <div class="relative" id="nav-lb-wrap">
              <button type="button" id="nav-lb-btn"
                class="nav-link text-sm text-muted hover:text-chalk transition px-2.5 py-2 flex items-center gap-1.5"
                aria-haspopup="true" aria-expanded="false" aria-controls="nav-lb-menu" title="Order of Merit · Live Rankings">
                <svg class="w-3.5 h-3.5 text-brand" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2c0 3.31-2.06 6.13-4.96 7.27.46 1.31 1.36 2.41 2.54 3.13l-1 2.6H8.42l-1-2.6c1.18-.72 2.08-1.82 2.54-3.13C7.06 11.13 5 8.31 5 5V3zm2 2v0c0 2.36 1.5 4.36 3.6 5.13L11 11h2l.4-.87C15.5 9.36 17 7.36 17 5H7zM6 20h12v2H6v-2z"/></svg>
                Rankings
                <svg class="w-3 h-3 transition-transform" id="nav-lb-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div id="nav-lb-menu"
                class="absolute right-0 top-full mt-1 w-[320px] rounded-xl border border-wire/60 bg-dark/95 backdrop-blur-xl shadow-2xl opacity-0 invisible translate-y-1 transition-all duration-150 overflow-hidden">
                <div class="px-4 pt-3 pb-2 flex items-center justify-between border-b border-wire/40">
                  <div>
                    <p class="text-[10px] font-bold tracking-widest text-brand uppercase">Top Ranked</p>
                    <p class="text-xs text-muted">Live MMR rankings</p>
                  </div>
                  <a href="/rankings" class="text-[11px] text-muted hover:text-chalk transition">Order of Merit →</a>
                </div>
                <div id="nav-lb-list" class="py-1 max-h-[340px] overflow-y-auto">
                  <div class="px-4 py-6 text-center text-xs text-muted">Loading…</div>
                </div>
              </div>
            </div>
            <div class="relative group" id="nav-more">
              <button type="button" id="nav-more-btn"
                class="nav-link text-sm text-muted hover:text-chalk transition px-2.5 py-2 flex items-center gap-1"
                aria-haspopup="true" aria-expanded="false">
                More
                <svg class="w-3 h-3 transition-transform group-hover:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div id="nav-more-menu"
                class="absolute right-0 top-full mt-1 min-w-[200px] rounded-xl border border-wire/60 bg-dark/95 backdrop-blur-xl shadow-2xl py-2 opacity-0 invisible translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
                <a href="/#features" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Features</a>
                <a href="/#pricing" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Pricing</a>
                <a href="/how-it-works" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">How It Works</a>
                <a href="/competitions" class="flex items-center gap-1.5 px-4 py-2 text-sm text-chalk hover:text-brand hover:bg-wire/30 transition">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse"></span>Competitions
                  <span class="ml-auto text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.4);">NEW</span>
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
          <div id="dv-nav-auth-desktop" class="hidden sm:flex items-center gap-2 ml-auto">
            <div data-dv-currency-mount></div>
            <a href="/login" class="btn-outline px-4 py-2 rounded-lg text-sm font-semibold text-chalk">Sign In</a>
            <a href="/login?intent=subscribe" class="btn-brand px-4 py-2 rounded-lg text-sm font-semibold text-white whitespace-nowrap">Start Free Trial</a>
          </div>
          <button id="mob-btn-nav" class="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition" aria-label="Open navigation menu">
            <svg class="w-5 h-5 text-chalk" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
        <div id="mob-nav" style="max-height:0;overflow:hidden;transition:max-height .35s ease,padding .35s ease;background:linear-gradient(180deg,rgba(12,12,16,0.96) 0%,rgba(8,8,10,0.98) 100%);-webkit-backdrop-filter:blur(24px) saturate(1.2);backdrop-filter:blur(24px) saturate(1.2);border-top:1px solid rgba(255,255,255,0.06);box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),0 24px 60px rgba(0,0,0,0.55);" class="lg:hidden">
          <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-1">
            <a href="/#features" class="dv-mob-link">Features</a>
            <a href="/how-it-works" class="dv-mob-link">How It Works</a>
            <a href="/#pricing" class="dv-mob-link">Pricing</a>
            <a href="/#brand-ambassador" class="dv-mob-link">Brand Ambassador</a>
            <a href="/guide" class="dv-mob-link">Setup Guide</a>
            <a href="/competitions" class="dv-mob-link-feature" style="background:linear-gradient(90deg, rgba(245,158,11,0.18), rgba(245,158,11,0.04)); border:1px solid rgba(245,158,11,0.35);">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              Competitions
              <span class="ml-auto text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4);">NEW</span>
            </a>
            <a href="/web-app" class="dv-mob-link" style="display:flex;align-items:center;gap:10px;">
              <img src="/dc-logo.png" alt="Dart Counter" class="w-5 h-5 rounded">
              Web App
            </a>
            <a href="/ranked" class="dv-mob-link-feature" style="background:linear-gradient(90deg, rgba(204,11,32,0.20), rgba(204,11,32,0.04)); border:1px solid rgba(204,11,32,0.35);">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color:var(--brand,#CC0B20);"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h4l1 4a4 4 0 008 0l1-4h4M5 4v3a4 4 0 004 4h6a4 4 0 004-4V4M9 22h6M12 15v7"/></svg>
              Ranked Hub
              <span class="ml-auto text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded" style="background:rgba(204,11,32,0.22); color:var(--brand,#CC0B20); border:1px solid rgba(204,11,32,0.4);">PRO</span>
            </a>
            <div class="px-2 pt-3 pb-1 flex items-center justify-between">
              <p class="text-[10px] font-bold tracking-widest uppercase" style="color:var(--brand,#CC0B20);">Top Ranked</p>
              <a href="/ranked" class="text-[11px] text-muted hover:text-chalk">View all →</a>
            </div>
            <div id="nav-lb-list-mobile" class="rounded-xl border border-wire/30 bg-black/25 mb-2 overflow-hidden">
              <div class="px-3 py-3 text-center text-[11px] text-muted">Loading…</div>
            </div>
            <a href="/referral" class="dv-mob-link" style="display:flex;align-items:center;gap:8px;">
              <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>Ambassador Program
            </a>
            <a href="/contact" class="dv-mob-link">Contact</a>
            <div id="dv-nav-auth-mobile" style="border-top:1px solid rgba(255,255,255,0.06);margin-top:6px;padding-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
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
        const initial = (email || '?').trim().charAt(0).toUpperCase() || '?';
        // Short label for the pill — "name" portion of the email, capped.
        const namePart = (email || '').split('@')[0] || 'Account';
        const shortName = this.escapeHtml(namePart.length > 14 ? namePart.slice(0, 13) + '…' : namePart);

        if (desktop) {
          desktop.innerHTML = `
            <div data-dv-currency-mount></div>
            <div class="w-px h-4 bg-wire/50"></div>
            <div class="relative" id="dv-profile-wrap">
              <button type="button" id="dv-profile-btn"
                class="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-wire/60 hover:border-brand/60 bg-wire/20 hover:bg-wire/30 transition"
                aria-haspopup="true" aria-expanded="false" title="${safeEmail}">
                <span class="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black text-white shrink-0"
                      style="background:linear-gradient(135deg, var(--brand,#CC0B20), #7a0613);">${this.escapeHtml(initial)}</span>
                <span class="text-xs font-semibold text-chalk hidden md:inline">${shortName}</span>
                <svg class="w-3 h-3 text-muted transition-transform" id="dv-profile-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div id="dv-profile-menu"
                class="absolute right-0 top-full mt-2 min-w-[240px] rounded-xl border border-wire/60 bg-dark/95 backdrop-blur-xl shadow-2xl py-2 opacity-0 invisible translate-y-1 transition-all duration-150 z-50">
                <div class="px-4 pt-2 pb-3 border-b border-wire/40">
                  <p class="text-[10px] font-bold tracking-widest text-brand uppercase">Signed in</p>
                  <p class="text-xs text-chalk truncate mt-0.5">${safeEmail}</p>
                </div>
                <a href="/dartvoice-dashboard" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">My Dashboard</a>
                <a href="/ranked" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Ranked Hub</a>
                <a href="/web-app" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Web App</a>
                <a href="/referral" class="block px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Ambassador</a>
                <div class="my-1 border-t border-wire/30"></div>
                <button type="button" data-dv-signout class="w-full text-left px-4 py-2 text-sm text-muted hover:text-chalk hover:bg-wire/30 transition">Sign Out</button>
              </div>
            </div>
          `;
          // Wire profile dropdown
          const wrap = desktop.querySelector('#dv-profile-wrap');
          const btn  = desktop.querySelector('#dv-profile-btn');
          const menu = desktop.querySelector('#dv-profile-menu');
          const chev = desktop.querySelector('#dv-profile-chev');
          const setOpen = (open) => {
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            menu.classList.toggle('opacity-0', !open);
            menu.classList.toggle('invisible', !open);
            menu.classList.toggle('translate-y-1', !open);
            menu.classList.toggle('opacity-100', open);
            menu.classList.toggle('visible', open);
            menu.classList.toggle('translate-y-0', open);
            chev?.classList.toggle('rotate-180', open);
          };
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setOpen(btn.getAttribute('aria-expanded') !== 'true');
          });
          document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) setOpen(false); });
          document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
        }

        if (mobile) {
          mobile.innerHTML = `
            <div class="col-span-2 flex items-center gap-3 px-2 py-2 rounded-lg" style="background:rgba(204,11,32,0.08);border:1px solid rgba(204,11,32,0.25);">
              <span class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0" style="background:linear-gradient(135deg, var(--brand,#CC0B20), #7a0613);">${this.escapeHtml(initial)}</span>
              <div class="min-w-0">
                <p class="text-[10px] font-bold tracking-widest text-brand uppercase">Signed in</p>
                <p class="text-xs text-chalk truncate">${safeEmail}</p>
              </div>
            </div>
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
          aria-haspopup="true" aria-expanded="false" title="Order of Merit · Live Rankings">
          <svg style="width:14px;height:14px;color:#CC0B20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v2c0 3.31-2.06 6.13-4.96 7.27.46 1.31 1.36 2.41 2.54 3.13l-1 2.6H8.42l-1-2.6c1.18-.72 2.08-1.82 2.54-3.13C7.06 11.13 5 8.31 5 5V3zm2 2v0c0 2.36 1.5 4.36 3.6 5.13L11 11h2l.4-.87C15.5 9.36 17 7.36 17 5H7zM6 20h12v2H6v-2z"/></svg>
          <span>Rankings</span>
          <svg id="dvlb-chev" style="width:12px;height:12px;transition:transform .15s" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div id="dvlb-menu"
          style="position:absolute;right:0;top:100%;margin-top:4px;width:320px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(10,10,10,0.96);backdrop-filter:blur(16px);box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;opacity:0;visibility:hidden;transform:translateY(4px);transition:all .15s;z-index:60;">
          <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
            <div>
              <p style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#CC0B20;margin:0;">Top Ranked</p>
              <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:2px 0 0;">Live MMR rankings</p>
            </div>
            <a href="/rankings" style="font-size:11px;color:rgba(255,255,255,0.5);text-decoration:none;">Order of Merit →</a>
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
