// components/dv-nav.js
class DvNav extends HTMLElement {
  connectedCallback() {
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
                    <a href="/index.html#features"     class="text-sm text-muted hover:text-chalk transition px-3 py-2">Features</a>
                    <a href="/index.html#pricing"      class="text-sm text-muted hover:text-chalk transition px-3 py-2">Pricing</a>
                    <a href="guide"               class="text-sm text-muted hover:text-chalk transition px-3 py-2">Guide</a>
                    <a href="referral"            class="text-sm text-muted hover:text-chalk transition px-3 py-2 flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block"></span>Ambassador
                    </a>
                </div>
                <div class="hidden sm:flex items-center gap-3">
                    <a href="login" class="text-sm font-semibold text-muted hover:text-chalk transition">Sign In</a>
                    <a href="dartvoice-dashboard" class="bg-brand hover:bg-red-600 transition px-4 py-2 rounded-lg text-sm font-semibold text-white">Start Free Trial</a>
                </div>
                <button id="mob-btn-nav"
                        class="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition">
                    <svg class="w-5 h-5 text-chalk" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                </button>
            </div>
            <div id="mob-nav"
                style="max-height:0;overflow:hidden;transition:max-height .35s ease"
                class="sm:hidden border-t border-wire/50 bg-dark/95 backdrop-blur-xl">
                <div class="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-1">
                    <a href="/index.html#features"  class="text-sm text-muted hover:text-chalk transition px-2 py-2.5">Features</a>
                    <a href="/index.html#pricing"   class="text-sm text-muted hover:text-chalk transition px-2 py-2.5">Pricing</a>
                    <a href="guide"            class="text-sm text-muted hover:text-chalk transition px-2 py-2.5">Setup Guide</a>
                    <a href="referral"         class="text-sm text-muted hover:text-chalk transition px-2 py-2.5 flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>Ambassador Program
                    </a>
                    <div class="border-t border-wire/50 mt-1 pt-3 grid grid-cols-2 gap-2">
                        <a href="login" class="border border-wire rounded-lg px-3 py-2.5 text-sm font-semibold text-center text-chalk hover:bg-white/5 transition">Sign In</a>
                        <a href="dartvoice-dashboard" class="bg-brand rounded-lg px-3 py-2.5 text-sm font-semibold text-center text-white hover:bg-red-600 transition">Free Trial</a>
                    </div>
                </div>
            </div>
            <script>
            document.getElementById('mob-btn-nav').addEventListener('click', function() {
                var m = document.getElementById('mob-nav');
                m.style.maxHeight = m.style.maxHeight === '0px' || !m.style.maxHeight ? '320px' : '0px';
            });
            </script>
        </nav>
    `;
  }
}
customElements.define("dv-nav", DvNav);
