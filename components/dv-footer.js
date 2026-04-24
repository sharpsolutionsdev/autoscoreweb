// components/dv-nav.js
class DvFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
        <footer class="border-t border-wire/60 pt-8 pb-6">
            <div class="max-w-6xl mx-auto px-5">

                <!-- Top grid: logo + 3 columns -->
                <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6 mb-8">

                    <!-- Brand column -->
                    <div class="col-span-2 sm:col-span-4 lg:col-span-2">
                        <a href="/" class="flex items-center gap-2.5 group mb-4">
                            <img src="/logo-transparent.png" alt="DartVoice" class="w-8 h-8 shrink-0" style="object-fit:contain;">
                            <span class="display text-lg group-hover:text-brand transition-colors">DARTVOICE</span>
                        </a>
                        <p class="text-muted text-sm leading-relaxed mb-5 max-w-xs">
                            Voice-controlled auto-scoring for darts. Say your score — DartVoice handles the rest.
                        </p>
                        <!-- Platform badges -->
                        <div class="flex flex-wrap gap-2">
                            <div class="flex items-center gap-1.5 bg-card border border-wire rounded-lg px-3 py-1.5">
                                <svg class="w-3.5 h-3.5 text-muted" fill="currentColor" viewBox="0 0 24 24">
                                    <path
                                        d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                                </svg>
                                <span class="text-xs text-muted">Windows</span>
                            </div>
                            <div class="flex items-center gap-1.5 bg-card border border-wire rounded-lg px-3 py-1.5">
                                <svg class="w-3.5 h-3.5 text-muted" fill="currentColor" viewBox="0 0 24 24">
                                    <path
                                        d="M17.523 15.341a4.91 4.91 0 01-2.536.703c-2.765 0-5.023-2.257-5.023-5.044s2.258-5.044 5.023-5.044c1.367 0 2.612.535 3.524 1.408l1.716-1.716A7.444 7.444 0 0015 4C10.86 4 7.5 7.358 7.5 11.5s3.36 7.5 7.5 7.5c2.143 0 4.09-.897 5.488-2.347l-2.965-1.312zm-12.06-4.34h1.81l-1.81-5.442-1.81 5.442H5.463zm-2.712 0L0 6.81V15.5h2V9.044l2.773 6.456h.915L8.46 9.044V15.5h2V6.81L7.808 11h-2.06l-.997-4.81z" />
                                </svg>
                                <span class="text-xs text-muted">Android</span>
                            </div>
                        </div>
                    </div>

                    <!-- Product -->
                    <div>
                        <p class="footer-heading">Product</p>
                        <ul class="space-y-2.5">
                            <li><a href="#features" class="text-sm text-muted hover:text-chalk transition">Features</a></li>
                            <li><a href="#how-it-works" class="text-sm text-muted hover:text-chalk transition">How It
                                    Works</a></li>
                            <li><a href="#pricing" class="text-sm text-muted hover:text-chalk transition">Pricing</a></li>
                            <li><a href="guide" class="text-sm text-muted hover:text-chalk transition">Setup Guide</a>
                            </li>
                            <li><a href="dartvoice-dashboard"
                                    class="text-sm text-muted hover:text-chalk transition">Dashboard</a></li>
                        </ul>
                    </div>

                    <!-- Earn -->
                    <div>
                        <p class="footer-heading">Earn</p>
                        <ul class="space-y-2.5">
                            <li><a href="referral"
                                    class="text-sm text-muted hover:text-chalk transition flex items-center gap-1.5">
                                    <span class="w-1 h-1 rounded-full bg-brand inline-block shrink-0"></span>Ambassador
                                    Program</a></li>
                            <li><a href="referral#how-it-works"
                                    class="text-sm text-muted hover:text-chalk transition">How Referrals Work</a></li>
                            <li><a href="dartvoice-dashboard#ambassador"
                                    class="text-sm text-muted hover:text-chalk transition">Get My Link</a></li>
                        </ul>
                    </div>

                    <!-- Legal -->
                    <div>
                        <p class="footer-heading">Legal &amp; Support</p>
                        <ul class="space-y-2.5">
                            <li><a href="terms" class="text-sm text-muted hover:text-chalk transition">Terms of
                                    Service</a></li>
                            <li><a href="mailto:support@dartvoice.app"
                                    class="text-sm text-muted hover:text-chalk transition">support@dartvoice.app</a></li>
                        </ul>
                    </div>

                </div>

                <!-- Payment methods strip -->
                <div class="border-t border-wire/60 pt-6 mb-4">
                    <p class="footer-heading mb-4">Accepted Payment Methods</p>
                    <div class="flex flex-wrap gap-2 items-center">

                        <!-- Stripe -->
                        <div class="pay-badge gap-1.5" title="Powered by Stripe">
                            <svg class="h-4" viewBox="0 0 60 25" fill="none"><text x="0" y="19" font-family="Arial"
                                    font-weight="700" font-size="18" fill="#6772E5">stripe</text></svg>
                        </div>

                        <!-- Visa -->
                        <div class="pay-badge" title="Visa">
                            <svg viewBox="0 0 750 471" class="h-4 w-auto">
                                <rect width="750" height="471" rx="40" fill="#1A1F71" />
                                <path
                                    d="M278 334l33-195h53l-33 195h-53zm243-190c-10-4-27-8-47-8-52 0-89 26-89 64 0 28 26 44 46 53 20 10 27 16 27 25 0 13-16 19-31 19-20 0-32-3-49-10l-7-3-7 41c12 5 34 10 57 10 55 0 90-26 90-66 0-22-14-39-44-53-18-9-29-15-29-24 0-8 9-17 29-17 16 0 28 3 37 7l5 2 8-40zm140-5h-40c-13 0-22 4-28 17l-80 178h57s9-24 11-29h69c2 7 6 29 6 29h50l-44-195zm-67 118c4-11 20-53 20-53s4-11 7-17l3 15s9 42 11 55h-41zm-340-118l-52 133-6-27c-10-29-42-60-77-76l47 169h58l87-199h-57z"
                                    fill="white" />
                                <path d="M155 139H73l-1 5c56 14 94 47 109 87l-16-77c-3-12-11-15-20-15z" fill="#F9A533" />
                            </svg>
                        </div>

                        <!-- Mastercard -->
                        <div class="pay-badge" title="Mastercard">
                            <svg viewBox="0 0 131 86" class="h-4 w-auto">
                                <circle cx="47" cy="43" r="43" fill="#EB001B" />
                                <circle cx="84" cy="43" r="43" fill="#F79E1B" />
                                <path d="M65.5 13.5a43 43 0 010 59A43 43 0 0165.5 13.5z" fill="#FF5F00" />
                            </svg>
                        </div>

                        <!-- Amex -->
                        <div class="pay-badge gap-1" title="American Express">
                            <svg viewBox="0 0 48 16" class="h-3.5 w-auto">
                                <rect width="48" height="16" rx="3" fill="#2E77BC" /><text x="4" y="12" font-family="Arial"
                                    font-weight="900" font-size="11" fill="white">AMEX</text>
                            </svg>
                        </div>

                        <!-- PayPal -->
                        <div class="pay-badge gap-1" title="PayPal">
                            <svg viewBox="0 0 101 32" class="h-4 w-auto" fill="none">
                                <path d="M12 4h14c8 0 12 4 10 11-2 8-8 11-16 11H16l-4 6H4L12 4z" fill="#003087" />
                                <path d="M16 4h14c8 0 12 4 10 11-2 8-8 11-16 11H20l-4 6H8L16 4z" fill="#009CDE"
                                    opacity=".8" />
                                <text x="34" y="22" font-family="Arial" font-weight="700" font-size="14"
                                    fill="#003087">PayPal</text>
                            </svg>
                        </div>

                        <!-- Apple Pay -->
                        <div class="pay-badge gap-1.5" title="Apple Pay">
                            <svg viewBox="0 0 44 18" class="h-4 w-auto">
                                <rect width="44" height="18" rx="3" fill="black" stroke="#3a3a3c" stroke-width="1" /><text
                                    x="5" y="13" font-family="-apple-system,Arial" font-size="10" fill="white">&#xF8FF;
                                    Pay</text>
                            </svg>
                        </div>

                        <!-- Google Pay -->
                        <div class="pay-badge gap-1" title="Google Pay">
                            <svg viewBox="0 0 54 18" class="h-4 w-auto">
                                <rect width="54" height="18" rx="3" fill="#1a1a1a" stroke="#333" stroke-width="1" />
                                <text x="5" y="13" font-family="Arial" font-size="10" font-weight="500" fill="white">
                                    <tspan fill="#4285F4">G</tspan>
                                    <tspan fill="#EA4335">o</tspan>
                                    <tspan fill="#FBBC05">o</tspan>
                                    <tspan fill="#4285F4">g</tspan>
                                    <tspan fill="#34A853">l</tspan>
                                    <tspan fill="#EA4335">e</tspan>
                                    <tspan fill="white"> Pay</tspan>
                                </text>
                            </svg>
                        </div>

                        <!-- Klarna -->
                        <div class="pay-badge" title="Klarna">
                            <svg viewBox="0 0 68 20" class="h-4 w-auto">
                                <rect width="68" height="20" rx="4" fill="#FFB3C7" /><text x="8" y="14" font-family="Arial"
                                    font-weight="700" font-size="11" fill="#17120E" letter-spacing="-0.3">klarna</text>
                            </svg>
                        </div>

                        <!-- Bank Transfer -->
                        <div class="pay-badge gap-1.5" title="Bank Transfer">
                            <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" stroke-width="1.5"
                                viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M3 6l9-3 9 3M3 6v12a1 1 0 001 1h4M3 6h18m0 0v12a1 1 0 01-1 1h-4m-8 0v-6m4 6v-6m4 6v-6M9 18H7m-4 0h2m14 0h-2" />
                            </svg>
                            <span class="text-muted text-xs">Bank Transfer</span>
                        </div>

                        <div class="ml-auto flex items-center gap-1.5 text-muted2 text-xs">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5"
                                viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            Payments secured by Stripe
                        </div>
                    </div>
                </div>

                <!-- Bottom bar -->
                <div
                    class="border-t border-wire/40 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted2">
                    <div class="flex items-center gap-4 flex-wrap">
                        <span>&copy; 2026 DartVoice. All rights reserved.</span>
                        <div data-dv-currency-mount></div>
                    </div>
                    <div class="flex items-center gap-5">
                        <a href="https://instagram.com/dartvoiceapp" target="_blank" rel="noopener" class="hover:text-muted transition" title="Follow us on Instagram">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.43.403a4.08 4.08 0 011.47.96c.458.457.779.91.96 1.47.163.46.349 1.26.403 2.43.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.403 2.43a4.08 4.08 0 01-.96 1.47 4.08 4.08 0 01-1.47.96c-.46.163-1.26.349-2.43.403-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.43-.403a4.08 4.08 0 01-1.47-.96 4.08 4.08 0 01-.96-1.47c-.163-.46-.349-1.26-.403-2.43C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.054-1.17.24-1.97.403-2.43a4.08 4.08 0 01.96-1.47 4.08 4.08 0 011.47-.96c.46-.163 1.26-.349 2.43-.403C8.416 2.175 8.796 2.163 12 2.163zM12 0C8.741 0 8.333.014 7.053.072 5.775.13 4.903.333 4.14.63a5.88 5.88 0 00-2.126 1.384A5.88 5.88 0 00.63 4.14C.333 4.903.13 5.775.072 7.053.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.058 1.278.261 2.15.558 2.913a5.88 5.88 0 001.384 2.126A5.88 5.88 0 004.14 23.37c.763.297 1.635.5 2.913.558C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.278-.058 2.15-.261 2.913-.558a6.14 6.14 0 002.126-1.384 5.88 5.88 0 001.384-2.126c.297-.763.5-1.635.558-2.913.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.058-1.278-.261-2.15-.558-2.913a5.88 5.88 0 00-1.384-2.126A5.88 5.88 0 0019.86.63c-.763-.297-1.635-.5-2.913-.558C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"/></svg>
                        </a>
                        <a href="terms" class="hover:text-muted transition">Terms of Service</a>
                        <a href="contact" class="hover:text-muted transition">Contact</a>
                        <a href="referral" class="hover:text-brand transition flex items-center gap-1">
                            <span class="w-1 h-1 rounded-full bg-brand"></span>Ambassador
                        </a>
                    </div>
                </div>

            </div>
        </footer>
    `;
  }
}
customElements.define("dv-footer", DvFooter);

// Ensure the custom element behaves as a block so it doesn't leave baseline whitespace
const __dvFooterStyle = document.createElement('style');
__dvFooterStyle.textContent = 'dv-footer{display:block}';
document.head.appendChild(__dvFooterStyle);
