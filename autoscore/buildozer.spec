[app]

# App identity
title          = DartVoice
package.name   = dartvoice
package.domain = com.dartvoice
version        = 1.8

# Source
source.dir          = .
# CRITICAL: include every file extension used by the Vosk model, fonts, and app
source.include_exts = py,json,ttf,otf,png,mdl,fst,conf,mat,int,dubm,ie,stats,txt

# Bundle the Vosk model inside the APK (extracted to writable storage on first run)
source.include_patterns = vosk-model-small-en-us/*,vosk-model-small-en-us/am/*,vosk-model-small-en-us/graph/*,vosk-model-small-en-us/graph/phones/*,vosk-model-small-en-us/conf/*,vosk-model-small-en-us/ivector/*

# Exclude build artifacts, Windows-only files, and dev tooling
source.exclude_dirs  = bin,build,dist,__pycache__,.buildozer,.git,billing_server
source.exclude_patterns = dartvoice_v2.py,DartVoice.spec,gen_icon.py,p4a_hook.py

# Background service (service/main.py runs as a separate Android process)
services = DartVoice:./service/main.py:foreground

# Requirements
# vosk — the p4a recipe downloads libvosk.so automatically for arm64
# plyer — for vibrator/haptic feedback on score confirm
# NOTE: supabase is NOT listed here because pydantic-core (Rust extension)
#       cannot be cross-compiled for Android.  billing.py gracefully falls
#       back to offline-only mode when supabase is unavailable.
requirements = python3==3.11.0,kivy==2.3.0,pyjnius,android,plyer,vosk

# Orientation & display
orientation = portrait
fullscreen  = 0

# Icons
icon.filename      = icon.png
presplash.filename = icon.png
presplash.color = #08080A

# Android permissions
android.permissions = RECORD_AUDIO, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE, WAKE_LOCK, INTERNET, VIBRATE

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
