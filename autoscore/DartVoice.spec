# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = []
binaries = []
hiddenimports = []

# ── Vosk model ────────────────────────────────────────────────────────────────
datas += [('vosk-model-small-en-us', 'vosk-model-small-en-us')]

# ── Fonts ─────────────────────────────────────────────────────────────────────
datas += [('fonts', 'fonts')]

# ── billing.py (must sit next to the exe at runtime) ─────────────────────────
datas += [('billing.py', '.')]

# ── customtkinter ─────────────────────────────────────────────────────────────
tmp = collect_all('customtkinter')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pystray (system tray) ─────────────────────────────────────────────────────
tmp = collect_all('pystray')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
hiddenimports += ['pystray._win32']

# ── PIL / Pillow ──────────────────────────────────────────────────────────────
tmp = collect_all('PIL')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── Supabase + dependencies ───────────────────────────────────────────────────
tmp = collect_all('supabase')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
tmp = collect_all('supabase_auth')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
tmp = collect_all('postgrest')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
tmp = collect_all('storage3')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
tmp = collect_all('realtime')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
tmp = collect_all('httpx')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
tmp = collect_all('gotrue')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
hiddenimports += collect_submodules('supabase')
hiddenimports += collect_submodules('httpx')
hiddenimports += ['pyjwt', 'jwt', 'cryptography']

# ── vosk ──────────────────────────────────────────────────────────────────────
tmp = collect_all('vosk')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pyttsx3 ───────────────────────────────────────────────────────────────────
tmp = collect_all('pyttsx3')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
hiddenimports += ['pyttsx3.drivers', 'pyttsx3.drivers.sapi5',
                  'win32com.client', 'win32api', 'win32con']

# ── pyautogui ─────────────────────────────────────────────────────────────────
hiddenimports += ['pyautogui', 'pyscreeze', 'mouseinfo', 'pytweening']

# ── numpy (video scoring) ─────────────────────────────────────────────────────
tmp = collect_all('numpy')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── misc stdlib that PyInstaller sometimes misses ─────────────────────────────
hiddenimports += [
    'colorsys', 'hashlib', 'threading', 'webbrowser',
    'tkinter', 'tkinter.colorchooser', 'tkinter.messagebox',
    '_tkinter',
]


a = Analysis(
    ['dartvoice_v2.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'scipy', 'pandas', 'IPython', 'notebook',
              'pytest', 'setuptools', 'distutils', 'kivy'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='DartVoice',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,          # swap in 'dartvoice.ico' when you have one
    version=None,
    # Application manifest — requests DPI awareness so text isn't blurry
    manifest='''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity version="1.7.0.0" processorArchitecture="amd64"
                    name="DartVoice" type="win32"/>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/PM</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
    </windowsSettings>
  </application>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security><requestedPrivileges>
      <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
    </requestedPrivileges></security>
  </trustInfo>
</assembly>''',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='DartVoice',
)
