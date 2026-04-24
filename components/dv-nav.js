class DvNav extends HTMLElement {
  connectedCallback() {
    this.render();
    this.bindMenu();
    this.initAuth();
  }

  render() {
    this.innerHTML = `
      <nav class="fixed top-0 w-full z-50 bg-dark/85 backdrop-blur-xl border-b border-wire/60">
        <div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" class="flex items-center gap-2.5 group">
            <svg viewBox="0 0 36 36" class="w-8 h-8 shrink-0" fill="none">
              <rect width="36" height="36" rx="9" fill="#CC0B20"/>
              <circle cx="18" cy="18" r="11" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/>
              <circle cx="18" cy="18" r="6.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" fill="none"/>
              <circle cx="18" cy="18" r="3" fill="white"/>
              <path d="M 24 10 Q 30 18 24 26" stroke="rgba(255,255,255,0.7)" stroke-width="2" stroke-linecap="round" fill="none"/>
            </svg>
            <span class="display text-lg group-hover:text-brand transition-colors">DARTVOICE</span>
          </a>
          <div class="hidden sm:flex items-center gap-1">
            <a href="/#features" class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2">Features</a>
            <a href="/how-it-works" class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2">How It Works</a>
            <a href="/#pricing" class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2">Pricing</a>
            <a href="/web-app" class="nav-link text-sm text-brand font-bold hover:text-brand-light transition px-3 py-2 flex items-center gap-1.5">
              <img src="/dc-logo.png" alt="Dart Counter" class="w-5 h-5 rounded" style="image-rendering:auto;">
              Web App
              <span class="flex h-2 w-2 relative -top-1"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-brand"></span></span>
            </a>
            <div class="relative group" id="nav-more">
              <button type="button" id="nav-more-btn"
                class="nav-link text-sm text-muted hover:text-chalk transition px-3 py-2 flex items-center gap-1"
                aria-haspopup="true" aria-expanded="false">
                More
                <svg class="w-3 h-3 transition-transform group-hover:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div id="nav-more-menu"
                class="absolute right-0 top-full mt-1 min-w-[180px] rounded-xl border border-wire/60 bg-dark/95 backdrop-blur-xl shadow-2xl py-2 opacity-0 invisible translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
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
