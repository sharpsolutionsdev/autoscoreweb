# Client Applications Deep Dive

The DartVoice ecosystem is supported by three primary runtime clients designed to cover any user's hardware setup.

## 1. Windows Desktop Client (`dartvoice_v2.py`)
**Framework:** Python + `customtkinter`
**Core Logic:**
- **Local Audio Engine:** Utilizes the lightweight `vosk` Python library for offline, zero-latency speech recognition. It listens strictly for mathematical integers and dart terminology.
- **CustomTkinter GUI:** Moves away from standard ugly Tkinter windows to provide a Discord/OBS-like "Command Center" layout with dark themes, rounded corners, and a borderless "Picture-in-Picture" stream widget mode.
- **PyAutoGUI Layer:** The user "calibrates" the app by clicking specific numbers on their external dart software. `dartvoice_v2.py` maps these `(X, Y)` coordinate locations. When a user shouts "Sixty!", PyAutoGUI rapidly moves the mouse and simulates synthetic left-clicks on those mapped coordinates, effectively automating the external app.

## 2. Android Client (`dartvoice_android.py`)
**Framework:** Python + Kivy
**Core Logic:**
- **The "Thumb Zone":** Designed specifically for pub players holding a phone with one hand. All crucial controls are docked to the bottom 40% of the screen.
- **Background Processes:** The Android client must keep the microphone active even when the screen goes to sleep or the user switches to a different score tracking app. This is achieved via a dedicated background Python thread that prevents OS sleep-state suspension.
- **Native Hard-Locks:** Contains sophisticated `FloatLayout` overlay views to act as a secure paywall (the "Netflix Lock") that blocks all interaction until an OTP string is successfully validated.

## 3. Chrome Extension (`content.js`)
**Framework:** Manifest V3 API + Vanilla JS
**Core Logic:**
- **DOM Injection:** Rather than simulating physical mouse clicks, the extension identifies the HTML `<div>` or `<button>` elements of specific target scoreboards (e.g., DartCounter) using `document.querySelector`.
- **System WebRTC:** Instead of clustering a heavy offline Python library, the extension utilizes the browser’s native `webkitSpeechRecognition` API.
- **Direct Event Firing:** Once parsed, the extension programmatically dispatches `.click()` events directly onto the scoring elements within the webpage. This is drastically faster and natively cross-platform compared to the Windows Desktop approach.
