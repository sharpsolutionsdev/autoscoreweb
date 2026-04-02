# DartVoice — Setup Guide

---

## FOR USERS — Installing DartVoice on Windows

> **You need nothing except the installer file. No Python. No technical knowledge.**

### Install

1. Download **DartVoice_Setup_v1.7.exe**
2. Double-click it → Next → Next → Install
3. DartVoice launches automatically

### How to use

1. Open your darts scoring software (Target Dartcounter, Lidarts, etc.) and get to the score entry screen
2. Open DartVoice from Start Menu / desktop shortcut
3. First time: click **Calibrate** in the right panel and click on the score input box in your scoring app
4. Click **START LISTENING**
5. Say *"score one forty"* (or just *"one forty"* if trigger word is off) — it types automatically

### Uninstall

Settings → Apps → DartVoice → Uninstall

---
---

## FOR DEVELOPERS — Building the installer

### One-command build

```cmd
build_windows.bat
```

That single script:
1. Installs/upgrades PyInstaller
2. Builds `dist\DartVoice\DartVoice.exe` (bundles Python + all dependencies)
3. Auto-detects Inno Setup and compiles `installer_output\DartVoice_Setup_v1.7.exe`

**That `.exe` is what you distribute.**

---

### Manual build (step by step)

**Step 1 — Build the exe**

```cmd
python -m PyInstaller DartVoice.spec --noconfirm --clean
```

Output: `dist\DartVoice\DartVoice.exe`  (~150–200 MB folder, runs on any Windows 10/11 PC, no Python needed)

**Step 2 — Build the installer**

1. Download **Inno Setup 6** (free): https://jrsoftware.org/isinfo.php
2. Open `installer.iss` → Ctrl+F9
3. Output: `installer_output\DartVoice_Setup_v1.7.exe`  (~60–80 MB compressed)

---

### First-time dev setup

```cmd
pip install -r requirements_windows.txt
```

---

### Distributing to users

Options:
- **GitHub Releases** (recommended — free, versioned)
  ```
  GitHub → your repo → Releases → Draft new release
  → Attach DartVoice_Setup_v1.7.exe → Publish
  ```
- Upload to your website as a direct download
- Google Drive / Dropbox share link

---

### After code changes

```cmd
python -m PyInstaller DartVoice.spec --noconfirm
```
Then recompile in Inno Setup (Ctrl+F9) or re-run `build_windows.bat`.

---

### Version bump checklist

| File | What to change |
|------|----------------|
| `installer.iss` | `#define AppVersion "x.x"` |
| `DartVoice.spec` | `version` line in manifest |
| `build_windows.bat` | banner line at top |

---
---

## Android build (APK)

> Requires WSL2 (Windows Subsystem for Linux) — Ubuntu.

**One-time setup**

```powershell
# PowerShell as Administrator
wsl --install
```
Restart, open Ubuntu, then:

```bash
sudo apt update && sudo apt install -y \
    git zip unzip openjdk-17-jdk python3-pip python3-venv \
    libffi-dev libssl-dev autoconf libtool pkg-config \
    zlib1g-dev cmake adb

python3 -m venv ~/buildozer-env
source ~/buildozer-env/bin/activate
pip install buildozer cython
```

**Copy project + build**

```bash
cp -r /mnt/c/Users/vrynw/Documents/GitHub/dartvoice/testomg/autoscore ~/dartvoice
cd ~/dartvoice
source ~/buildozer-env/bin/activate
buildozer android debug deploy run
```

First build downloads Android SDK/NDK (~20–40 min). Subsequent builds: ~2–5 min.

**USB debugging on your phone**

1. Settings → About phone → tap Build number 7 times
2. Settings → Developer options → enable USB debugging
3. Plug in phone → tap Allow

```bash
adb devices   # should show your device
```

**Troubleshooting**

| Problem | Fix |
|---------|-----|
| `adb devices` shows "unauthorized" | Unplug → replug → tap Allow |
| App crashes on launch | `adb logcat -s python` to see error |
| "Model not found" | Wait 30–60s — extracting voice model |
| Mic permission denied | Phone Settings → Apps → DartVoice → Permissions → Microphone |
