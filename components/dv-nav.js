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
            <a href="/features.html" class="text-sm text-muted hover:text-chalk transition px-3 py-2">Features</a>
            <a href="/how-it-works.html" class="text-sm text-muted hover:text-chalk transition px-3 py-2">How It Works</a>
            <a href="/index.html#pricing" class="text-sm text-muted hover:text-chalk transition px-3 py-2">Pricing</a>
            <a href="/guide" class="text-sm text-muted hover:text-chalk transition px-3 py-2">Guide</a>
            <a href="/referral" class="text-sm text-muted hover:text-chalk transition px-3 py-2 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block"></span>Ambassador
            </a>
          </div>
          <div id="dv-nav-auth-desktop" class="hidden sm:flex items-center gap-3">
            <a href="/login" class="text-sm font-semibold text-muted hover:text-chalk transition">Sign In</a>
            <a href="/login?intent=subscribe" class="bg-brand hover:bg-red-600 transition px-4 py-2 rounded-lg text-sm font-semibold text-white">Start Free Trial</a>
          </div>
          <button id="mob-btn-nav" class="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition" aria-label="Open navigation menu">
            <svg class="w-5 h-5 text-chalk" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
        <div id="mob-nav" style="max-height:0;overflow:hidden;transition:max-height .35s ease" class="sm:hidden border-t border-wire/50 bg-dark/95 backdrop-blur-xl">
          <div class="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-1">
            <a href="/features.html" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5">Features</a>
            <a href="/how-it-works.html" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5">How It Works</a>
            <a href="/index.html#pricing" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5">Pricing</a>
            <a href="/guide" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5">Setup Guide</a>
            <a href="/referral" class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>Ambassador Program
            </a>
            <div id="dv-nav-auth-mobile" class="border-t border-wire/50 mt-1 pt-3 grid grid-cols-2 gap-2">
              <a href="/login" class="border border-wire rounded-lg px-3 py-2.5 text-sm font-semibold text-center text-chalk hover:bg-white/5 transition">Sign In</a>
              <a href="/login?intent=subscribe" class="bg-brand rounded-lg px-3 py-2.5 text-sm font-semibold text-center text-white hover:bg-red-600 transition">Start Free Trial</a>
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
      menu.style.maxHeight = isOpen ? '0px' : '360px';
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
            <span class="text-xs text-muted truncate max-w-[180px]">${safeEmail}</span>
            <a href="/dartvoice-dashboard" class="bg-brand hover:bg-red-600 transition px-4 py-2 rounded-lg text-sm font-semibold text-white">My Dashboard</a>
            <button type="button" data-dv-signout class="text-xs text-muted hover:text-chalk transition px-2 py-1.5 rounded-lg hover:bg-wire/30">Sign Out</button>
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
