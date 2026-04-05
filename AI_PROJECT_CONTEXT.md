# DartVoice - System Architecture & AI Context
*Generated for Future AI Handoff*

**Project Description:** DartVoice is a voice-controlled auto-scoring system designed to automate manual dartboard scoring software (like Target Dart Counter, Nakka, etc.). The system translates spoken words (e.g., "Triple twenty", "Ton eighty", "Two marks on nineteen") into system-level inputs or DOM clicks. 

The software ecosystem comprises a static marketing website, custom transactional emails, a Windows desktop application, an Android native application, and a Chrome Extension.

---

## 🏗 Core Architecture & Repositories

### 1. Web Platform (Marketing & Portal)
- **Stack:** HTML5, TailwindCSS (CDN), Vanilla JavaScript.
- **Design System:** Deep dark mode (`bg-[#08080A]`), premium red accents (`#CC0B20`), heavy glassmorphism, floating micro-animations, and fluid responsive typography.
- **Key Files:**
  - `index.html`: The high-converting marketing landing page featuring 3D hover states, pseudo-software CSS mockups, and Stripe checkout funnels.
  - `dartvoice-dashboard.html`: The authenticated portal where active subscribers download the respective clients.
  - `guide.html`: A master documentation page detailing Software Installation, First Launch, X01 Calibration, Cricket Calibration, and Voice Commands.

### 2. The Clients (The Auto-Scoring Software)
- **Windows Desktop (`autoscore/dartvoice_v2.py`)**
  - Python-based application that listens to an active microphone input and parses darts terminology.
  - Uses GUI calibration (which the user sets up to tell it where to click/input).
- **Android App (`autoscore/buildozer.spec`)**
  - The Python logic packaged into an Android APK using Buildozer (likely Kivy/Flet framework) to act as a mobile microphone array and parser.
- **Chrome Extension (`chrome_extension/content.js`)**
  - Uses Manifest V3.
  - Operates using the native browser `webkitSpeechRecognition` API.
  - Specifically designed to parse voice and manipulate DOM elements on browser-based scorers (like DartCounter Chrome tabs) directly, bypassing the need for a desktop client. Features full mathematical parsing for X01 and Cricket.

### 3. Authentication & Billing Layer
- **Payments:** Handled entirely out-of-ecosystem by Stripe (`buy.stripe.com` links are embedded in `index.html` and `guide.html`).
- **Authentication Strategy:** Passwordless OTP (One-Time Password). Users input the email they used to buy the subscription on Stripe into the Desktop/Android/Chrome clients. The backend sends an OTP.
- **Email Templates (`emails/`)**:
  - 7 deeply polished, branded HTML emails (Welcome, OTP Code, Payment Failed, Subscription Active, Referral Invite, Referral Payout, Cancelled). These were batched and generated via a python script (`script_email_update.py`) maintaining strict design continuity.

---

## 🚀 Immediate Next Steps & Deployment Checklist

For any AI returning to this codebase, the UI/UX is functionally "Launch Ready." Focus should immediately shift to deployment, backend integration, and store compliance.

### 1. Chrome Extension Submission ✅
- ✅ Icons generated (16x16, 48x48, 128x128) and wired into `manifest.json`.
- ✅ Extension folder archived as `dartvoice-extension.zip` — ready for Chrome Web Store upload.
- ⬜ Once approved, update the `href` on the Chrome Extension download button in `dartvoice-dashboard.html` to the official Web Store URL.

### 2. Backend API Verification ⬜
*Note: The frontend is currently static HTML. To make the dashboard and OTP logic functional:*
- ⬜ Ensure the backend server securely validates Stripe Webhooks (e.g. `customer.subscription.created`) and updates the user database.
- ⬜ Connect the static `login.html` and `dartvoice-dashboard.html` files to an actual routing framework (like Next.js) OR wire up Vanilla JS to consume backend JWT/Session tokens.
- ⬜ Hook up the SendGrid/AWS SES logic to dispatch the templates located in `/emails/` when OTP requests are fired.

### 3. Windows & Android Builds ⬜
- **Windows**: Package `dartvoice_v2.py` utilizing PyInstaller or Nuitka to compile a standalone executable (`DartVoice_Setup.exe`). Ensure the executable is code-signed with an EV certificate to prevent Windows Defender SmartScreen warnings.
- **Android**: Run the `buildozer.spec` pipeline to generate the `.aab` (Android App Bundle). Prepare Play Store screenshots and submit for app review.

### 4. SEO & Analytics ✅ (Placeholder)
- ✅ Google Analytics `gtag.js` snippet injected into ALL 8 public-facing pages.
- ⬜ **ACTION REQUIRED:** Find-and-replace `G-XXXXXXXXXX` with your real Google Analytics Measurement ID across all HTML files. You can do this with a single command:
  ```
  # PowerShell (run from project root)
  Get-ChildItem *.html | ForEach-Object { (Get-Content $_.FullName) -replace 'G-XXXXXXXXXX','G-YOUR_REAL_ID' | Set-Content $_.FullName }
  ```
1

