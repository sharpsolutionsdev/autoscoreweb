# Deployment & Compilation Guide

This document outlines how to safely package and deploy the three discrete clients and the marketing website.

## 1. Deploying the Website

The website consists entirely of static HTML, CSS, and JS. It requires no Node backend or heavy server architecture.
- **Hosting:** Deploy directly to a CDN via Vercel, Netlify, or AWS S3 Cloudfront.
- **Environment Targeting:** Ensure `gtag.js` identifiers are active on the production domain before shipping.
- **Stripe Updates:** To change pricing or checkout routing, generate a new Payment Link in the Stripe Developer Dashboard and update the `href` on `index.html`.

## 2. Packaging the Windows Executable (.exe)

Because standard Python requires users to use the CLI, we bundle the Desktop app into an `.exe`.

1. Install PyInstaller: `pip install pyinstaller`.
2. Navigate to `/autoscore`.
3. Run the bundling script: 
   ```bash
   pyinstaller --noconfirm --onedir --windowed --add-data "vosk_model;vosk_model" --icon "favicon.ico" dartvoice_v2.py
   ```
4. **Code Signing:** To prevent Windows Defender SmartScreen from blocking the app, the final executable MUST be cryptographically signed using an EV (Extended Validation) Certificate.

## 3. Packaging the Android Release (.aab)

We use **Buildozer** to compile the Python/Kivy app into an Android App Bundle.

1. Ensure you are running within a Linux/WSL environment.
2. Initialize Buildozer if needed, or use the existing `buildozer.spec`.
3. Run the Android build command:
   ```bash
   buildozer android release
   ```
4. Find the resulting `.aab` file inside the `bin/` directory.
5. Upload the `.aab` to the Google Play Store Developer Console. Ensure you fill out the Microphone Privacy declarations, as an always-listening background app requires explicit justification.

## 4. Submitting the Chrome Extension

The Chrome extension requires no compilation, only archiving.
1. Navigate to `/chrome_extension`.
2. Ensure `manifest.json` correctly points to the `content.js` and local assets (16x16, 48x48, 128x128 icons).
3. Zip the entire `/chrome_extension` folder.
   > **Note:** The compiled zip should already exist in `/build_artifacts` if no recent code changes were made.
4. Upload the zip to the Chrome Web Store Developer Dashboard. Fill out the "Broad Host Permissions" justification to ensure the extension is allowed to inject scripts across multiple dart scoring domains.
