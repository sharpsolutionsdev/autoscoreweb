# DartVoice — Setup Guide

---

# FOR USERS — Installing DartVoice on Windows

> **Users need nothing except the installer file. No Python. No technical knowledge.**

### How to install

1. Download **DartVoice_Setup.exe** (from wherever you share it — website, Google Drive, etc.)
2. Double-click it
3. Click **Next → Next → Install**
4. DartVoice launches automatically when done

That's it. It works like any normal Windows program.

### How to use it

1. Open your darts scoring software (Lidarts, Autodarts, etc.) and get to the score screen
2. Open DartVoice from the Start Menu or desktop shortcut
3. Click **Settings → Calibrate X01 box**, then click on the score input in your darts software
4. Click **START LISTENING**
5. Say *"score one forty"* — it types the score in automatically

### Uninstalling

Settings → Apps → DartVoice → Uninstall  (like any normal program)

---
---

# FOR YOU (THE DEVELOPER) — Building the installer

These steps are run **once on your machine** to produce the `DartVoice_Setup.exe` that you give to users.

---

## Step 1 — Build the exe

Double-click **`build_windows.bat`** in the autoscore folder.

It installs PyInstaller automatically and builds everything.
When it finishes you'll see:
```
Build complete!
Distributable folder: dist\DartVoice\
```

Or from the terminal:
```cmd
python -m PyInstaller DartVoice.spec --noconfirm
```

> **Note:** use `python -m PyInstaller`, not just `pyinstaller` — Windows sometimes doesn't put PyInstaller on PATH even when it's installed.

This produces `dist\DartVoice\DartVoice.exe` — runs on any Windows 10/11 PC with no Python required.

---

## Step 2 — Build the installer with Inno Setup

1. Download **Inno Setup 6** (free): https://jrsoftware.org/isinfo.php
2. Install it (next → next → finish)
3. Open `installer.iss` in Inno Setup
4. Press **Ctrl+F9** (or Build → Compile)
5. The installer appears at: `installer_output\DartVoice_Setup.exe`

**That single file is what you distribute to users.**
It's ~50–80MB, includes everything, and installs like any normal Windows software.

---

## Step 3 — Distribute it

Options (pick one):
- Upload to your website as a download link
- Share via Google Drive / Dropbox link
- GitHub Releases (free, works well for software downloads)

For GitHub Releases:
```
github.com → your repo → Releases → Draft a new release
→ Attach DartVoice_Setup.exe → Publish
```

Users then download directly from GitHub. No hosting costs.

---

## Rebuilding after code changes

```cmd
pyinstaller DartVoice.spec          # rebuilds dist\DartVoice\
```
Then recompile in Inno Setup (Ctrl+F9) to get a new `DartVoice_Setup.exe`.

---

---

# FOR YOU — Testing on Android

> The APK build requires Linux or WSL2 (Windows Subsystem for Linux).
> Your phone just needs USB debugging enabled.

---

## Step 1 — Enable WSL2 (one time only)

Open **PowerShell as Administrator**:
```powershell
wsl --install
```
Restart your PC. Open **Ubuntu** from the Start Menu and complete the first-run setup.

All commands below are run inside the Ubuntu terminal.

---

## Step 2 — Install build tools (one time only)

```bash
sudo apt update && sudo apt install -y \
    git zip unzip openjdk-17-jdk python3-pip python3-venv \
    libffi-dev libssl-dev autoconf libtool pkg-config \
    zlib1g-dev cmake adb

python3 -m venv ~/buildozer-env
source ~/buildozer-env/bin/activate
pip install buildozer cython
```

---

## Step 3 — Copy the project into WSL2

```bash
cp -r /mnt/c/Users/vrynw/Desktop/autoscore ~/dartvoice
cd ~/dartvoice
source ~/buildozer-env/bin/activate
```

---

## Step 4 — Download the Vosk Android library

```bash
wget https://github.com/alphacep/vosk-api/releases/download/v0.3.45/vosk-0.3.45-cp311-cp311-linux_aarch64.whl
```

Edit `buildozer.spec` — find the `requirements =` line and change `vosk` to the filename:
```
requirements = python3==3.11.0,kivy==2.3.0,pyjnius,android,./vosk-0.3.45-cp311-cp311-linux_aarch64.whl,numpy,stripe
```

---

## Step 5 — Enable USB debugging on your phone

1. **Settings → About phone** → tap **Build number** 7 times
   → "Developer mode enabled" toast appears
2. **Settings → Developer options** → turn on **USB debugging**
3. Plug phone into PC via USB cable
4. Tap **Allow** on the phone when it asks to trust this computer

Check it's detected:
```bash
adb devices
```
You should see your device (not "unauthorized").

---

## Step 6 — Build and install

First build downloads the Android SDK/NDK automatically — takes **20–40 minutes** once.

```bash
buildozer android debug deploy run
```

When it finishes the app opens on your phone automatically.

---

## Rebuilding after code changes

```bash
buildozer android debug deploy run
```
Subsequent builds take **2–5 minutes** (SDK already downloaded).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `adb devices` shows "unauthorized" | Unplug → replug → tap Allow on phone |
| Build fails on `vosk` | Check the `.whl` filename matches exactly in buildozer.spec |
| App crashes on launch | `adb logcat -s python` to see the error |
| "Model not found" on first launch | Wait 30–60 sec — it's extracting the voice model |
| Mic permission denied | Phone Settings → Apps → DartVoice → Permissions → Microphone → Allow |

View live logs from the phone:
```bash
adb logcat -s python
```

---

## Quick reference

| Task | Command |
|------|---------|
| Rebuild Windows exe | `pyinstaller DartVoice.spec` |
| Build Android APK + install | `buildozer android debug deploy run` |
| Install APK manually | `adb install bin/dartvoice-*.apk` |
| View phone logs | `adb logcat -s python` |
| Clean build cache | `buildozer android clean` |
