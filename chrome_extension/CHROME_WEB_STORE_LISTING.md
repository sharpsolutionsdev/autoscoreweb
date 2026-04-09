# Chrome Web Store Listing — DartVoice Launchpad

Copy-paste each section into the corresponding Chrome Web Store Developer Dashboard field.

---

## Store Listing Tab

### Language
**English (United Kingdom)** (or English)

### Detailed Description (min 25 chars)
```
DartVoice Launchpad lets you voice-control any browser-based dart scorer using your microphone. Say your score, and DartVoice types it in for you — no hands needed.

How it works:
1. Open your favourite online dart scorer (e.g. DartCounter, Nakka)
2. Click the DartVoice icon and press "Launch Overlay"
3. Calibrate the score input box with one click
4. Start talking — DartVoice listens and enters your scores automatically

Supported voice commands:
• Single dart scores: "treble twenty", "double sixteen", "bullseye", "miss"
• X01 totals: "sixty", "one hundred and eighty"
• Cricket darts: "triple twenty", "double bull"

Features:
• Works on DartCounter.net, Nakka.com, and any dart scorer via manual launch
• 10-minute free demo — no sign-up required
• Choose your preferred microphone from the popup
• Floating overlay with live status, calibration, and transcript log
• Sign in via dartvoice.app for unlimited use with a DartVoice Pro subscription

DartVoice keeps your hands free so you can focus on your throw.
```

### Category
**Sports**

---

## Privacy Practices Tab

### Single Purpose Description
```
Voice-control browser-based dart scoring websites by converting spoken dart scores into keyboard input.
```

### Permission Justifications

#### activeTab
```
Used to inject the DartVoice voice-control overlay into the user's current tab when they click "Launch Overlay" in the popup. This grants temporary access only to the active tab after explicit user interaction, rather than requesting blanket access to all tabs.
```

#### scripting
```
Required to programmatically inject the content script (content.js) into the active tab when the user clicks "Launch Overlay" in the popup. The script creates a floating overlay panel for microphone control, speech-to-score parsing, and score injection into the dart scoring website's input fields.
```

#### storage
```
Stores user preferences and session state locally on the device: selected microphone device ID, calibrated score-input coordinates, demo usage timer (seconds used out of 10-minute trial), and authentication tokens for signed-in users. No data is sent to third parties.
```

#### declarativeNetRequest
```
Removes X-Frame-Options and Content-Security-Policy response headers from sub-frame requests to dartcounter.net and nakka.com only. This allows the DartVoice web dashboard (dartvoice.app) to embed these dart scoring websites in an iframe for an integrated scoring experience. No headers are modified on any other websites.
```

#### Host permissions (dartcounter.net, nakka.com, dartvoice.app)
```
dartcounter.net and nakka.com: The extension auto-injects a content script on these dart scoring websites to provide voice-controlled score entry. dartvoice.app: Used to relay authentication state from the DartVoice website to the extension so users can sign in once and stay authenticated across sessions.
```

#### Remote code
```
This extension does not load or execute any remote code. All JavaScript is bundled locally in the extension package. The only remote requests are: (1) Supabase API calls for user authentication and subscription verification, and (2) Google Fonts CSS loaded in the overlay for consistent styling. No executable code is fetched remotely.
```

### Data Usage Compliance
Tick the checkbox: **"I certify that my item's data usage complies with the Developer Program Policies."**

The extension:
- Does NOT sell user data to third parties
- Does NOT transfer user data for purposes unrelated to the item's single purpose
- Does NOT transfer user data for creditworthiness or lending purposes
- Only stores data locally (chrome.storage.local) on the user's device
- Authentication tokens are exchanged solely with Supabase (dartvoice.app's backend) for login/subscription verification

---

## Account Tab (MANUAL — you must do these yourself)

1. **Contact email**: Enter your developer contact email
2. **Verify contact email**: Click the verification link sent to that email

---

## Assets

### Icon
Already provided in the extension package: `icon128.png` (128×128 red dartboard target).
Upload this same file as the Store Icon.

### Screenshots (at least 1 required, 1280×800 or 640×400)
You need to take screenshots of:
1. The extension popup (click the DartVoice icon in Chrome toolbar)
2. The voice overlay running on DartCounter.net with "Listening..." status
3. (Optional) The calibration mode overlay

**To capture screenshots:**
1. Install the unpacked extension in Chrome (`chrome://extensions` → Load unpacked → select `chrome_extension/` folder)
2. Navigate to dartcounter.net, click the DartVoice icon, click Launch Overlay
3. Use Windows Snipping Tool (Win+Shift+S) to capture at 1280×800
4. Save as PNG and upload to the Chrome Web Store listing

---

## Summary Checklist

| # | Error | Resolution | Who |
|---|-------|-----------|-----|
| 1 | activeTab justification | Paste text above | You (Privacy tab) |
| 2 | declarativeNetRequest justification | Paste text above | You (Privacy tab) |
| 3 | Host permission justification | Paste text above | You (Privacy tab) |
| 4 | Remote code justification | Paste text above | You (Privacy tab) |
| 5 | Scripting justification | Paste text above | You (Privacy tab) |
| 6 | Storage justification | Paste text above | You (Privacy tab) |
| 7 | Screenshot required | Capture & upload | You (Store listing) |
| 8 | Icon image | Upload icon128.png | You (Store listing) |
| 9 | Language | Select English | You (Store listing) |
| 10 | Category | Select Sports | You (Store listing) |
| 11 | Detailed description | Paste text above | You (Store listing) |
| 12 | Single purpose description | Paste text above | You (Privacy tab) |
| 13 | Data usage compliance | Tick checkbox | You (Privacy tab) |
| 14 | Contact email | Enter your email | You (Account tab) |
| 15 | Verify contact email | Click verification link | You (Account tab) |
