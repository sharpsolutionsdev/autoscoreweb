# Tech Stack & Simple Explainer

This is a simplified breakdown of exactly what languages, frameworks, and critical third-party services power the entire DartVoice ecosystem.

## 1. The Marketing Website & User Portal
*What powers the website you visit to learn about and download the app?*

- **HTML5:** The core semantic structure of the website.
- **TailwindCSS (via CDN):** The CSS framework used to rapidly design the beautiful, premium dark mode interfaces, glassmorphism, and responsive layouts.
- **Vanilla JavaScript:** Powers the DOM manipulation, navigation, and custom checkout redirection logic without the heavy overhead of a frontend framework like React.
- **Lucide Icons:** Used for all SVG vector iconography across the marketing pages.

## 2. The Windows Desktop Software (`autoscore/dartvoice_v2.py`)
*What runs the local desktop application?*

- **Python (v3.10+):** The core programming language powering the logic.
- **[CustomTkinter](https://github.com/TomSchimansky/CustomTkinter):** A modern, dark-themed UI wrapper over classic Tkinter, providing the sleek "Command Center" aesthetic with rounded buttons and fluid windows.
- **[Vosk](https://alphacephei.com/vosk/):** An offline, ultra-fast speech recognition engine capable of converting audio streams into raw string data immediately.
- **[PyAutoGUI](https://pyautogui.readthedocs.io/):** The automation layer that allows Python to take control of the user's mouse and send synthetic physical clicks to external screens (like hitting the "T20" button on DartCounter).

## 3. The Android Application (`dartvoice_android.py`)
*What runs the mobile microphone array app?*

- **Python & Kivy:** The app is written entirely in Python, utilizing the [Kivy](https://kivy.org/) Open Source Python library for rapid cross-platform UI development.
- **Buildozer:** A tool that takes the raw Kivy Python script and compiles it into a native Android App Bundle (`.aab`) that can be uploaded to the Google Play Store.

## 4. The Chrome Web Extension (`content.js`)
*What runs the seamless browser extension?*

- **Vanilla JavaScript:** Powers the entire extension.
- **Manifest V3 API:** The modern architecture blueprint mandated by Google Chrome for defining extension permissions and logic.
- **WebRTC (`webkitSpeechRecognition`):** Utilizes Google Chrome's built-in global speech recognition API to transcribe audio without needing the offline `Vosk` models.
- **DOM Injection:** Uses JavaScript `document.querySelector().click()` to artificially trigger clicks on the DartCounter website running in the active tab.

## 5. Critical External Services
*What third-party platforms keep the business running?*

- **Stripe:** Exclusively handles all payments, recurring subscription billing, and acts as our source-of-truth for active user status via webhook endpoints.
- **Supabase / Auth:** Used to securely generate, validate, and bridge the 6-digit OTP (One Time Password) flow.
- **SendGrid / AWS SES:** The SMTP protocol services responsible for delivering the beautifully branded HTML lifecycle emails to user inboxes securely.
- **GitHub:** Acts as the decentralized version control system to house all codebases.
