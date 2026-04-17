# Web Platform & Billing Integration

## 1. The Static Frontend

The DartVoice web ecosystem is built heavily on static HTML to ensure blazing fast load times and cheap hosting. It leverages:
- **Vanilla JavaScript:** For all DOM manipulation.
- **TailwindCSS (CDN):** For rapid styling.
- **Lucide Icons:** For scalable vector iconography.

The core pages (`html/index.html`, `html/dartvoice-dashboard.html`, `html/guide.html`) utilize deep dark modes, premium red accents (`#CC0B20`), heavy glassmorphism, and modern micro-animations to communicate a premium "software" feel before the user even downloads an app.

## 2. Stripe Checkout Funnel

We do not utilize a custom backend shopping cart.
- Purchasing is handled entirely out-of-ecosystem by Stripe via Payment Links (`buy.stripe.com`).
- These links are embedded directly into the CTA buttons on `html/index.html`.
- Upon successful payment, Stripe handles the automatic recurring billing (SaaS model), and redirects the user to the `html/thanks.html` success page.
- Canceling a checkout redirects back to `html/checkout-cancelled.html`.

## 3. Passwordless OTP Backend

The local applications (Desktop, Mobile) require the user to log in. To prevent the friction of creating and remembering a password:

1. The user inputs their email address into the DartVoice application.
2. The DartVoice app sends a request to the backend validation server.
3. The server checks the Stripe API: *"Does this email currently have an active, paying DartVoice subscription?"*
4. If yes, the server generates a 6-digit One Time Password (OTP) and emails it via an SMTP relay (e.g. Amazon SES / SendGrid).
5. The user types the 6-digit code into the local app.
6. A success response grants the app authorization to bypass the 10-minute Hard-Lock paywall.

## 4. Transactional Emails

The `/emails/` directory contains 7 beautifully structured, responsive HTML email templates:
- **Welcome**
- **OTP Code (Magic Login)**
- **Subscription Active**
- **Payment Failed**
- **Referral Invite**
- **Referral Payout**
- **Cancelled**

These templates ensure the premium DartVoice aesthetic is maintained across the entire user lifecycle. They are dynamically generated via `script_email_update.py` to maintain design continuity across all variants if the core brand CSS changes.

