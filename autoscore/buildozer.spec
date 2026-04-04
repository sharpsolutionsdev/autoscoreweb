[app]

# App identity
title          = DartVoice
package.name   = dartvoice
package.domain = com.dartvoice
version        = 1.7

# Source
source.dir          = .
source.include_exts = py,json,ttf,otf

# Bundle the Vosk model inside the APK (extracted to writable storage on first run)
source.include_patterns = vosk-model-small-en-us/*,vosk-model-small-en-us/am/*,vosk-model-small-en-us/graph/*,vosk-model-small-en-us/graph/phones/*,vosk-model-small-en-us/conf/*,vosk-model-small-en-us/ivector/*

# Background service (service/main.py runs as a separate Android process)
services = DartVoice:./service/main.py:foreground

# Requirements
# vosk — the p4a recipe downloads libvosk.so automatically for arm64
# If the standard recipe is unavailable in your p4a version, see the
# manual wheel instructions at the bottom of this file.
requirements = python3==3.11.0,kivy==2.3.0,pyjnius,android,vosk,supabase,httpx

# Orientation & display
orientation = portrait
fullscreen  = 0

# Icons (optional — replace with your own 512×512 PNG)
# icon.filename      = icon.png
# presplash.filename = presplash.png

# Android permissions
android.permissions = \
    RECORD_AUDIO, \
    FOREGROUND_SERVICE, \
    FOREGROUND_SERVICE_MICROPHONE, \
    WAKE_LOCK

# API targets
android.api    = 34
android.minapi = 24

# Architectures
android.archs = arm64-v8a

# NDK
android.ndk_api          = 24
android.accept_sdk_license = True

# Bootstrap
p4a.bootstrap = sdl2

# Uncomment to use a specific python-for-android branch that includes the
# vosk recipe (recommended if your version doesn't have it):
# p4a.branch = develop

[buildozer]
log_level = 2
warn_on_root = 1

# ─────────────────────────────────────────────────────────────────────────────
# BUILD INSTRUCTIONS
# ─────────────────────────────────────────────────────────────────────────────
# 1. Install buildozer on Linux/WSL2 (macOS also works):
#       pip install buildozer cython
#
# 2. Install Android SDK/NDK dependencies:
#       sudo apt install -y git zip unzip openjdk-17-jdk python3-pip \
#            libffi-dev libssl-dev autoconf libtool pkg-config \
#            zlib1g-dev libncurses5-dev libncursesw5-dev libtinfo5 cmake
#
# 3. Vosk wheel for Android (arm64):
#    Download the arm64 .whl from https://github.com/alphacep/vosk-api/releases
#    Place it next to this file and add it to requirements above, e.g.:
#       requirements = ...,vosk-0.3.45-cp311-cp311-linux_aarch64.whl
#
# 4. Copy the Vosk model:
#    The vosk-model-small-en-us folder is bundled automatically via
#    source.include_patterns above. It will be extracted to app storage
#    on first run if needed.
#
# 5. Build debug APK:
#       buildozer android debug
#
# 6. Build + deploy to connected device:
#       buildozer android debug deploy run
#
# 7. Release build (requires a keystore):
#       buildozer android release
