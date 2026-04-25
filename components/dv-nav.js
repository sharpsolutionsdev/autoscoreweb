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
