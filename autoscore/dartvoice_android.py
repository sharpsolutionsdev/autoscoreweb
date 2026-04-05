"""
DartVoice for Android
Standalone darts scorer with voice recognition (Vosk) and TTS.
Build with Buildozer:  buildozer android debug deploy run
"""

import os, sys, json, threading, re, time

# ─────────────────────────────────────────────────────────────────────────────
# Platform detection
# ─────────────────────────────────────────────────────────────────────────────
ANDROID = sys.platform == 'linux' and 'ANDROID_ARGUMENT' in os.environ

# ─────────────────────────────────────────────────────────────────────────────
# Kivy config must be set BEFORE any kivy imports
# ─────────────────────────────────────────────────────────────────────────────
os.environ.setdefault('KIVY_NO_ENV_CONFIG', '1')

from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.spinner import Spinner
from kivy.uix.scrollview import ScrollView
from kivy.uix.slider import Slider
from kivy.uix.widget import Widget
from kivy.uix.textinput import TextInput
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.utils import platform as kivy_platform
from kivy.metrics import dp, sp
from kivy.graphics import Color, Rectangle, RoundedRectangle, Ellipse, Line
from kivy.animation import Animation

# ─────────────────────────────────────────────────────────────────────────────
# Palette (matches desktop app)
# ─────────────────────────────────────────────────────────────────────────────
BG   = (0.031, 0.031, 0.039, 1)      # #08080A
CARD = (0.067, 0.067, 0.078, 1)      # #111114
CARD2= (0.094, 0.094, 0.110, 1)      # #18181C
FG   = (0.941, 0.941, 0.961, 1)      # #F0F0F5
FG2  = (0.431, 0.431, 0.510, 1)      # #6E6E82
FG3  = (0.180, 0.180, 0.227, 1)      # #2E2E3A
SEP  = (0.145, 0.145, 0.188, 1)      # #252530

# Theme-driven globals (updated by _apply_theme)
ACCENT     = (0.800, 0.043, 0.125, 1)
ACCENT_DIM = (0.533, 0.027, 0.078, 1)
ACCENT_GLO = (1.000, 0.125, 0.251, 1)
PRI_HOV    = (0.878, 0.063, 0.188, 1)
PRI_FG     = (1, 1, 1, 1)
STOP_BG    = (0.102, 0.024, 0.031, 1)
STOP_HOV   = (0.067, 0.016, 0.024, 1)
STOP_BDR   = (0.227, 0.063, 0.094, 1)
WIRE_HINT  = (0.110, 0.031, 0.055, 1)

def hex_to_kivy(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4)) + (1,)

# ─────────────────────────────────────────────────────────────────────────────
# Player themes  (mirrors Windows app exactly)
# ─────────────────────────────────────────────────────────────────────────────
THEMES = {
    'Littler': {
        'player': 'Luke Littler', 'nickname': 'The Nuke',
        'accent': '#CC0B20', 'accent_dim': '#880714', 'accent_glo': '#FF2040',
        'pri_hov': '#E01030',
        'stop_bg': '#1A0608', 'stop_hov': '#110406', 'stop_bdr': '#3A1018',
        'wire_hint': '#1C080E',
    },
    'Anderson': {
        'player': 'Gary Anderson', 'nickname': 'The Flying Scotsman',
        'accent': '#0074D9', 'accent_dim': '#004A8C', 'accent_glo': '#3FA8FF',
        'pri_hov': '#1A8AFF',
        'stop_bg': '#080E1A', 'stop_hov': '#060A12', 'stop_bdr': '#12223A',
        'wire_hint': '#0A1020',
    },
    'van Gerwen': {
        'player': 'Michael van Gerwen', 'nickname': 'MvG',
        'accent': '#00B140', 'accent_dim': '#006B26', 'accent_glo': '#22E860',
        'pri_hov': '#00CC4A',
        'stop_bg': '#081408', 'stop_hov': '#060E06', 'stop_bdr': '#102A14',
        'wire_hint': '#091608',
    },
    'Wright': {
        'player': 'Peter Wright', 'nickname': 'Snakebite',
        'accent': '#9B30FF', 'accent_dim': '#5E1AAA', 'accent_glo': '#C070FF',
        'pri_hov': '#AF50FF',
        'stop_bg': '#120A1C', 'stop_hov': '#0C0614', 'stop_bdr': '#26143C',
        'wire_hint': '#140A1E',
    },
    'van Barneveld': {
        'player': 'Raymond van Barneveld', 'nickname': 'Barney',
        'accent': '#FF6200', 'accent_dim': '#A33D00', 'accent_glo': '#FF8E3A',
        'pri_hov': '#FF7418',
        'stop_bg': '#1A0E04', 'stop_hov': '#120A04', 'stop_bdr': '#3A1E08',
        'wire_hint': '#1C1006',
    },
    'Taylor': {
        'player': 'Phil Taylor', 'nickname': 'The Power',
        'accent': '#D4A017', 'accent_dim': '#8C6A0A', 'accent_glo': '#FFD040',
        'pri_hov': '#E8B820',
        'stop_bg': '#1A1606', 'stop_hov': '#121004', 'stop_bdr': '#3A2E0C',
        'wire_hint': '#1C1A08',
    },
    'Price': {
        'player': 'Gerwyn Price', 'nickname': 'The Iceman',
        'accent': '#D0E8FF', 'accent_dim': '#6080A0', 'accent_glo': '#FFFFFF',
        'pri_hov': '#E8F4FF', 'pri_fg': '#06060A',
        'stop_bg': '#0C1218', 'stop_hov': '#080C10', 'stop_bdr': '#1E2E3C',
        'wire_hint': '#0E1620',
    },
    'Sherrock': {
        'player': 'Fallon Sherrock', 'nickname': 'Queen of the Palace',
        'accent': '#E8007A', 'accent_dim': '#960050', 'accent_glo': '#FF40A8',
        'pri_hov': '#FF1A90',
        'stop_bg': '#1A0410', 'stop_hov': '#12040C', 'stop_bdr': '#3A0C28',
        'wire_hint': '#1C0614',
    },
    'Custom': {
        'player': 'Your Colour', 'nickname': 'Pick any accent',
        'accent': '#FFFFFF', 'accent_dim': '#888888', 'accent_glo': '#FFFFFF',
        'pri_hov': '#DDDDDD', 'pri_fg': '#06060A',
        'stop_bg': '#111114', 'stop_hov': '#0C0C10', 'stop_bdr': '#282830',
        'wire_hint': '#141418',
        '_custom': True,
    },
}

def _derive_shades(hex_accent):
    """Derive all theme colours from a single hex accent for the Custom theme."""
    import colorsys
    h = hex_accent.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    hh, s, v = colorsys.rgb_to_hsv(r, g, b)
    def _to_hex(rr, gg, bb):
        return '#{:02X}{:02X}{:02X}'.format(
            max(0, min(255, int(rr * 255))),
            max(0, min(255, int(gg * 255))),
            max(0, min(255, int(bb * 255))),
        )
    dim  = _to_hex(*colorsys.hsv_to_rgb(hh, s, v * 0.55))
    glow = _to_hex(*colorsys.hsv_to_rgb(hh, max(0, s - 0.15), min(1, v * 1.25)))
    hov  = _to_hex(*colorsys.hsv_to_rgb(hh, s, min(1, v * 1.12)))
    stop = _to_hex(*[c * 0.07 + rr * 0.03 for c, rr in zip((r, g, b), (1, 0, 0))])
    wire = _to_hex(*[c * 0.09 for c in (r, g, b)])
    bdr  = _to_hex(*[c * 0.22 for c in (r, g, b)])
    pri_fg = '#06060A' if v > 0.80 and s < 0.25 else '#FFFFFF'
    return {
        'accent': hex_accent, 'accent_dim': dim, 'accent_glo': glow,
        'pri_hov': hov, 'pri_fg': pri_fg,
        'stop_bg': stop, 'stop_hov': stop, 'stop_bdr': bdr,
        'wire_hint': wire,
    }

def _glow_layers(accent_rgba):
    """Return 5 Kivy RGBA colours from darkest-glow to brightest-glow."""
    r, g, b = accent_rgba[0], accent_rgba[1], accent_rgba[2]
    return [
        (max(0.004, r * s), max(0.004, g * s), max(0.004, b * s), 1)
        for s in (0.27, 0.44, 0.67, 0.83, 1.0)
    ]

def _apply_theme(name, custom_hex='#FFFFFF'):
    """Update global theme colours. Call before building/rebuilding UI."""
    global ACCENT, ACCENT_DIM, ACCENT_GLO, PRI_HOV, PRI_FG
    global STOP_BG, STOP_HOV, STOP_BDR, WIRE_HINT
    t = THEMES.get(name, THEMES['Littler'])
    if t.get('_custom'):
        shades = _derive_shades(custom_hex)
        ACCENT     = hex_to_kivy(shades['accent'])
        ACCENT_DIM = hex_to_kivy(shades['accent_dim'])
        ACCENT_GLO = hex_to_kivy(shades['accent_glo'])
        PRI_HOV    = hex_to_kivy(shades['pri_hov'])
        PRI_FG     = hex_to_kivy(shades['pri_fg'])
        STOP_BG    = hex_to_kivy(shades['stop_bg'])
        STOP_HOV   = hex_to_kivy(shades['stop_hov'])
        STOP_BDR   = hex_to_kivy(shades['stop_bdr'])
        WIRE_HINT  = hex_to_kivy(shades['wire_hint'])
    else:
        ACCENT     = hex_to_kivy(t['accent'])
        ACCENT_DIM = hex_to_kivy(t['accent_dim'])
        ACCENT_GLO = hex_to_kivy(t['accent_glo'])
        PRI_HOV    = hex_to_kivy(t['pri_hov'])
        PRI_FG     = hex_to_kivy(t.get('pri_fg', '#FFFFFF'))
        STOP_BG    = hex_to_kivy(t['stop_bg'])
        STOP_HOV   = hex_to_kivy(t['stop_hov'])
        STOP_BDR   = hex_to_kivy(t['stop_bdr'])
        WIRE_HINT  = hex_to_kivy(t['wire_hint'])

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
def _config_dir():
    if ANDROID:
        from android.storage import app_storage_path  # type: ignore
        return app_storage_path()
    return os.path.dirname(os.path.abspath(__file__))

def load_config():
    path = os.path.join(_config_dir(), 'dartvoice_config.json')
    defaults = {
        'game_mode': 'X01', 'x01_start': 501,
        'trigger': 'score', 'require_trigger': True,
        'cancel_word': 'wait',
        'voice_assist': True, 'voice_rate': 1.0,
        'mic_index': None,
        'per_dart_mode': False,
        'live_checkout': False,
    }
    if os.path.exists(path):
        try:
            with open(path) as f:
                return {**defaults, **json.load(f)}
        except Exception:
            pass
    return defaults

def save_config(cfg):
    path = os.path.join(_config_dir(), 'dartvoice_config.json')
    try:
        with open(path, 'w') as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
# Vosk model extraction (Android assets → writable storage)
# ─────────────────────────────────────────────────────────────────────────────
MODEL_NAME = 'vosk-model-small-en-us'

def _ensure_model():
    """
    Return a writable filesystem path to the Vosk model.
    On Android, models bundled via Buildozer end up inside the APK's assets.
    Vosk requires a real directory, so we extract on first run.
    On desktop, just look next to the script.
    """
    if not ANDROID:
        local = os.path.join(os.path.dirname(os.path.abspath(__file__)), MODEL_NAME)
        return local if os.path.isdir(local) else None

    # Android path
    from android.storage import app_storage_path  # type: ignore
    dest = os.path.join(app_storage_path(), MODEL_NAME)
    if os.path.isdir(dest):
        return dest

    # Extract from APK assets
    try:
        import zipfile
        from android import mActivity  # type: ignore

        apk_path = mActivity.getPackageCodePath()
        with zipfile.ZipFile(apk_path, 'r') as z:
            members = [m for m in z.namelist()
                       if m.startswith(f'assets/{MODEL_NAME}/')]
            if not members:
                return None
            os.makedirs(dest, exist_ok=True)
            for member in members:
                rel = member[len(f'assets/{MODEL_NAME}/'):]
                if not rel:
                    continue
                target = os.path.join(dest, rel)
                if member.endswith('/'):
                    os.makedirs(target, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with z.open(member) as src, open(target, 'wb') as dst:
                        dst.write(src.read())
        return dest
    except Exception as e:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Score parsers (same logic as desktop)
# ─────────────────────────────────────────────────────────────────────────────
_ONES = {'zero':0,'oh':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,
         'for':4,'fore':4,'far':4,'fur':4,'foe':4,'ford':4,'fort':4,'floor':4,'poor':4,'war':4,
         'hero':0,'nero':0,'arrow':0,'era':0}
_TENS = {
    'twenty':20,'thirty':30,'forty':40,'fifty':50,
    'sixty':60,'seventy':70,'eighty':80,'ninety':90,
}

def _parse_under_100(t):
    t = t.strip()
    if t in _ONES: return _ONES[t]
    if t in _TENS: return _TENS[t]
    w = t.split()
    if len(w) == 2 and w[0] in _TENS and w[1] in _ONES:
        v = _TENS[w[0]] + _ONES[w[1]]
        return v if v < 100 else None
    try:
        v = int(t)
        return v if 0 <= v <= 99 else None
    except ValueError:
        return None

def parse_score(text):
    t = re.sub(r'\s+', ' ', re.sub(r'\band\b', ' ', text.lower().strip())).strip()
    m = re.fullmatch(r'one (twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)', t)
    if m: return 100 + _TENS[m.group(1)]
    m = re.fullmatch(r'one (oh|zero) (\w+)', t)
    if m and m.group(2) in _ONES:
        d = _ONES[m.group(2)]
        if 0 <= d <= 9: return 100 + d
    m = re.fullmatch(r'one hundred(?: (.+))?', t)
    if m:
        rest = (m.group(1) or '').strip()
        if not rest: return 100
        r = _parse_under_100(rest)
        if r is not None:
            v = 100 + r
            return v if v <= 180 else None
    return _parse_under_100(t)

_CRICKET_TARGETS = {
    'twenty':'20','twenties':'20','20':'20','plenty':'20',
    'nineteen':'19','nineteens':'19','19':'19',
    'eighteen':'18','eighteens':'18','18':'18',
    'seventeen':'17','seventeens':'17','17':'17',
    'sixteen':'16','sixteens':'16','16':'16',
    'fifteen':'15','fifteens':'15','15':'15',
    'bull':'b','bullseye':'b','bulls':'b','bowl':'b','bold':'b','pull':'b','full':'b',
    'miss':'miss','zero':'miss','nothing':'miss','none':'miss','missed':'miss',
}
_CRICKET_MODS = {
    'single':'s','double':'d','treble':'t','triple':'t',
    'travel':'t','trouble':'t','tribal':'t','tremble':'t','trickle':'t',
    'tripled':'t','tripple':'t','trebble':'t','trible':'t','tripe':'t',
    'devil':'d','doubles':'d','doubled':'d','dabble':'d','dbl':'d',
    'singles':'s','singled':'s','sgl':'s',
}
_SHORTHAND_RE = re.compile(r'^([sdt])(\d{2}|bull?)$')
_SHORTHAND_TARGETS = {
    '20':'20','19':'19','18':'18','17':'17','16':'16','15':'15',
    'bul':'b','bull':'b','b':'b',
}

def parse_cricket_darts(text):
    words = text.lower().replace('-', ' ').split()
    darts, mod = [], 's'
    for w in words:
        sh = _SHORTHAND_RE.match(w)
        if sh:
            m = sh.group(1)
            tgt = _SHORTHAND_TARGETS.get(sh.group(2))
            if tgt:
                darts.append((tgt, ('s' if tgt == 'b' and m == 't' else m)))
                continue
        if w in _CRICKET_MODS:
            mod = _CRICKET_MODS[w]
        elif w in _CRICKET_TARGETS:
            tgt = _CRICKET_TARGETS[w]
            darts.append(('miss', 'none') if tgt == 'miss' else
                         (tgt, ('s' if tgt == 'b' and mod == 't' else mod)))
            mod = 's'
    return darts[:3]

# ─────────────────────────────────────────────────────────────────────────────
# Single-dart parser  (per-dart X01 mode)
# ─────────────────────────────────────────────────────────────────────────────
_SINGLE_DART_SH = re.compile(r'^([sdt])(\d{1,2})$')

def parse_single_dart(text):
    """Parse one spoken dart. Returns (value: int, display: str) or None."""
    t = re.sub(r'\s+', ' ', text.lower().strip())
    m = _SINGLE_DART_SH.match(t)
    if m:
        mc, num = m.group(1), int(m.group(2))
        if 1 <= num <= 20:
            if mc == 't': return (num * 3, f"T{num}")
            if mc == 'd': return (num * 2, f"D{num}")
            return (num, str(num))
    if t in ('bull', 'bullseye', 'bulls', 'double bull', 'double bullseye', 'fifty',
             'bull\'s eye', 'bulls eye', 'double twenty five', 'double twenty-five',
             'double outer bull', 'inner bull', 'fifty points'):
        return (50, 'Bull')
    if t in ('outer bull', 'twenty five', 'twenty-five', 'half bull', 'single bull',
             'single twenty five', 'green bull', 'twenty-five points'):
        return (25, '25')
    if t in ('miss', 'missed', 'zero', 'nothing', 'none', 'no score',
             'outside', 'bounce out', 'bounce', 'bounced out'):
        return (0, 'Miss')
    words = t.split()
    mod, pfx = 1, ''
    if words and words[0] in _CRICKET_MODS:
        mc2 = _CRICKET_MODS[words[0]]
        if mc2 == 't': mod, pfx = 3, 'T'
        elif mc2 == 'd': mod, pfx = 2, 'D'
        words = words[1:]
    if not words:
        return None
    val = _parse_under_100(' '.join(words))
    if val is None:
        return None
    if 1 <= val <= 20:
        return (val * mod, f"{pfx}{val}" if pfx else str(val))
    # No modifier: reverse-map raw score (e.g. "51" → T17, "40" → D20)
    if mod == 1:
        if val % 3 == 0 and 1 <= val // 3 <= 20:
            return (val, f"T{val // 3}")
        if val % 2 == 0 and 1 <= val // 2 <= 20:
            return (val, f"D{val // 2}")
    return None

# ─────────────────────────────────────────────────────────────────────────────
# Checkout table
# ─────────────────────────────────────────────────────────────────────────────
def _build_checkout_table():
    opts    = [(t * 3, f"T{t}") for t in range(20, 0, -1)]
    opts.append((50, 'Bull'))
    opts   += [(d * 2, f"D{d}") for d in range(20, 0, -1)]
    opts   += [(s, str(s)) for s in range(20, 0, -1)]
    opts.append((25, '25'))
    doubles = [(d * 2, f"D{d}") for d in range(1, 21)] + [(50, 'Bull')]
    table   = {}
    for n in range(2, 171):
        for dv, dn in doubles:
            if dv == n:
                table[n] = dn; break
        if n in table:
            continue
        found = False
        for fv, fn in opts:
            rem = n - fv
            if rem <= 0: continue
            for dv, dn in doubles:
                if dv == rem:
                    table[n] = f"{fn} {dn}"; found = True; break
            if found: break
        if found: continue
        for fv, fn in opts:
            rem2 = n - fv
            if rem2 < 2: continue
            found2 = False
            for fv2, fn2 in opts:
                rem3 = rem2 - fv2
                if rem3 <= 0: continue
                for dv, dn in doubles:
                    if dv == rem3:
                        table[n] = f"{fn} {fn2} {dn}"; found2 = True; break
                if found2: break
            if found2: break
    return table

CHECKOUT = _build_checkout_table()

def checkout_hint(remaining):
    if not isinstance(remaining, int) or remaining < 2 or remaining > 170:
        return None
    return CHECKOUT.get(remaining)

# ─────────────────────────────────────────────────────────────────────────────
# Game state
# ─────────────────────────────────────────────────────────────────────────────
CRICKET_TARGETS = ['20', '19', '18', '17', '16', '15', 'b']
MOD_HITS = {'s': 1, 'd': 2, 't': 3}

class GameState:
    def __init__(self, mode='X01', start=501):
        self.mode  = mode
        self.start = start
        self.reset()

    def reset(self):
        self.remaining = self.start
        self.scores    = []         # X01: list of int; Cricket: unused
        self.marks     = {t: 0 for t in CRICKET_TARGETS}  # Cricket marks (0-3+)
        self.history   = []         # human-readable turn strings

    # ── X01 ──────────────────────────────────────────────────────────────────
    def apply_x01(self, score):
        """Returns 'ok' | 'bust' | 'win'."""
        new = self.remaining - score
        if new < 0:
            self.history.append(f'BUST  ({score})')
            return 'bust'
        self.remaining = new
        self.scores.append(score)
        avg = sum(self.scores) / len(self.scores) if self.scores else 0
        self.history.append(f'{score}  →  {self.remaining}  (avg {avg:.0f})')
        return 'win' if new == 0 else 'ok'

    # ── Cricket ──────────────────────────────────────────────────────────────
    def apply_cricket(self, darts):
        """Apply parsed cricket darts. Returns list of (target, mod, result_str)."""
        results = []
        for tgt, mod in darts:
            if tgt == 'miss':
                results.append(('miss', 'none', 'Miss'))
                continue
            hits = MOD_HITS.get(mod, 1)
            before = self.marks.get(tgt, 0)
            after  = min(before + hits, 3)
            self.marks[tgt] = after
            label = {'s': '', 'd': 'D/', 't': 'T/'}[mod] + tgt.upper()
            if before >= 3:
                results.append((tgt, mod, f'{label} (closed)'))
            else:
                results.append((tgt, mod, label))
        entry = '  '.join(r[2] for r in results)
        self.history.append(entry)
        return results

    @property
    def cricket_done(self):
        return all(v >= 3 for v in self.marks.values())

# ─────────────────────────────────────────────────────────────────────────────
# TTS
# ─────────────────────────────────────────────────────────────────────────────
_tts_lock = threading.Lock()

def speak(text, cfg):
    if not cfg.get('voice_assist', True):
        return
    def _do():
        with _tts_lock:
            if ANDROID:
                try:
                    from jnius import autoclass  # type: ignore
                    PythonActivity = autoclass('org.kivy.android.PythonActivity')
                    Locale         = autoclass('java.util.Locale')
                    tts_class      = autoclass('android.speech.tts.TextToSpeech')
                    ctx = PythonActivity.mActivity
                    tts = tts_class(ctx, None)
                    time.sleep(0.3)  # wait for init
                    tts.setLanguage(Locale.US)
                    tts.speak(text, tts_class.QUEUE_FLUSH, None, None)
                    time.sleep(len(text) * 0.07 + 0.5)
                    tts.shutdown()
                except Exception:
                    pass
            else:
                try:
                    import pyttsx3
                    e = pyttsx3.init()
                    e.setProperty('rate', int(cfg.get('voice_rate', 1.0) * 170))
                    e.say(text); e.runAndWait()
                except Exception:
                    pass
    threading.Thread(target=_do, daemon=True).start()

# ─────────────────────────────────────────────────────────────────────────────
# Speech listener thread
# ─────────────────────────────────────────────────────────────────────────────
class SpeechListener(threading.Thread):
    def __init__(self, model_path, cfg, on_score, on_status,
                 on_cancel=None, on_new_leg=None):
        super().__init__(daemon=True)
        self.model_path = model_path
        self.cfg        = cfg
        self.on_score   = on_score
        self.on_status  = on_status
        self.on_cancel  = on_cancel
        self.on_new_leg = on_new_leg
        self._stop_evt  = threading.Event()

    def stop(self):
        self._stop_evt.set()

    def run(self):
        try:
            import vosk
            model = vosk.Model(self.model_path)
            rec   = vosk.KaldiRecognizer(model, 16000)
        except Exception as e:
            self.on_status(f'Model error: {e}')
            return

        if ANDROID:
            self._run_android(rec)
        else:
            self._run_desktop(rec)

    # ── Android audio via AudioRecord ────────────────────────────────────────
    def _run_android(self, rec):
        try:
            from jnius import autoclass  # type: ignore
            AudioRecord   = autoclass('android.media.AudioRecord')
            AudioFormat   = autoclass('android.media.AudioFormat')
            MediaRecorder = autoclass('android.media.MediaRecorder$AudioSource')
        except Exception as e:
            self.on_status(f'Audio init error: {e}')
            return

        RATE    = 16000
        CHANNEL = AudioFormat.CHANNEL_IN_MONO
        FORMAT  = AudioFormat.ENCODING_PCM_16BIT
        BUF     = max(AudioRecord.getMinBufferSize(RATE, CHANNEL, FORMAT), 8000)

        try:
            recorder = AudioRecord(
                MediaRecorder.VOICE_RECOGNITION,
                RATE, CHANNEL, FORMAT, BUF * 4,
            )
            recorder.startRecording()
        except Exception as e:
            self.on_status(f'Mic error: {e}')
            return

        self.on_status('Listening')
        chunk = bytearray(4096)
        while not self._stop_evt.is_set():
            try:
                n = recorder.read(chunk, len(chunk))
                if n > 0:
                    data = bytes(chunk[:n])
                    if rec.AcceptWaveform(data):
                        self._process(json.loads(rec.Result()).get('text', ''))
                    else:
                        partial = json.loads(rec.PartialResult()).get('partial', '')
                        trigger = self.cfg.get('trigger', 'score').lower()
                        if self.cfg.get('require_trigger', True) and trigger in partial:
                            self.on_status('Trigger heard…')
            except Exception:
                continue

        try:
            recorder.stop()
            recorder.release()
        except Exception:
            pass

    # ── Desktop audio via PyAudio (for testing) ──────────────────────────────
    def _run_desktop(self, rec):
        try:
            import pyaudio
            pa     = pyaudio.PyAudio()
            stream = pa.open(
                format=pyaudio.paInt16, channels=1, rate=16000,
                input=True, input_device_index=self.cfg.get('mic_index'),
                frames_per_buffer=8000,
            )
            stream.start_stream()
        except Exception as e:
            self.on_status(f'Mic error: {e}')
            return

        self.on_status('Listening')
        while not self._stop_evt.is_set():
            try:
                data = stream.read(4000, exception_on_overflow=False)
                if rec.AcceptWaveform(data):
                    self._process(json.loads(rec.Result()).get('text', ''))
                else:
                    partial = json.loads(rec.PartialResult()).get('partial', '')
                    trigger = self.cfg.get('trigger', 'score').lower()
                    if self.cfg.get('require_trigger', True) and trigger in partial:
                        self.on_status('Trigger heard…')
            except Exception:
                continue
        stream.stop_stream()
        stream.close()
        pa.terminate()

    def _process(self, text):
        text = text.lower().strip()

        # Cancel word (no trigger required)
        cancel = self.cfg.get('cancel_word', 'wait').lower().strip()
        if cancel and text == cancel:
            if self.on_cancel: self.on_cancel()
            return

        # New leg / reset (no trigger required)
        if any(p in text for p in ('new leg', 'new game', 'next leg', 'reset leg',
                                   'reset game', 'restart leg')):
            if self.on_new_leg: self.on_new_leg()
            return

        trigger = self.cfg.get('trigger', 'score').lower()
        require = self.cfg.get('require_trigger', True)
        if require:
            if trigger not in text: return
            after = text.split(trigger, 1)[-1].strip()
        else:
            after = text.replace(trigger, '').strip()

        mode = self.cfg.get('game_mode', 'X01')

        # "enter" command — submit accumulated darts early in per-dart mode
        if after == 'enter' or text.strip() == 'enter':
            if self.on_status: self.on_status("Enter pressed")
            if self.cfg.get('per_dart_mode', False):
                self.on_score(('dart_submit',))
            return

        if mode == 'Cricket':
            darts = parse_cricket_darts(after)
            if darts:
                self.on_score(darts)
        elif self.cfg.get('per_dart_mode', False):
            dart = parse_single_dart(after)
            if dart is not None:
                self.on_score(('dart', dart[0], dart[1]))
        else:
            score = parse_score(after)
            if score is not None and 0 <= score <= 180:
                self.on_score(score)

# ─────────────────────────────────────────────────────────────────────────────
# UI helpers
# ─────────────────────────────────────────────────────────────────────────────
def _card_bg(widget, color=CARD, radius=12):
    with widget.canvas.before:
        Color(*color)
        widget._bg_rect = RoundedRectangle(pos=widget.pos, size=widget.size, radius=[dp(radius)])
    widget.bind(pos=lambda *_: setattr(widget._bg_rect, 'pos', widget.pos),
                size=lambda *_: setattr(widget._bg_rect, 'size', widget.size))

def _sep_line(widget):
    """Draw a 1dp horizontal separator line via canvas.before."""
    with widget.canvas.before:
        Color(*SEP)
        widget._sep_rect = RoundedRectangle(pos=widget.pos, size=(widget.width, dp(1)), radius=[0])
    widget.bind(pos=lambda *_: setattr(widget._sep_rect, 'pos', widget.pos),
                size=lambda *a: setattr(widget._sep_rect, 'size', (a[1][0], dp(1))))

def _accent_btn(text, on_press):
    btn = Button(
        text=text, font_size=sp(13), bold=True,
        background_normal='', background_color=(0, 0, 0, 0),
        color=PRI_FG, size_hint_y=None, height=dp(52),
    )
    with btn.canvas.before:
        Color(*ACCENT)
        btn._bg = RoundedRectangle(pos=btn.pos, size=btn.size, radius=[dp(12)])
    btn.bind(
        pos=lambda *_: setattr(btn._bg, 'pos', btn.pos),
        size=lambda *_: setattr(btn._bg, 'size', btn.size),
    )
    btn.bind(on_press=lambda *_: on_press())
    return btn

def _ghost_btn(text, on_press):
    """Secondary button with a border and dark background."""
    btn = Button(
        text=text, font_size=sp(12), bold=False,
        background_normal='', background_color=(0, 0, 0, 0),
        color=FG2, size_hint_y=None, height=dp(44),
    )
    with btn.canvas.before:
        Color(*SEP)
        btn._border = RoundedRectangle(pos=btn.pos, size=btn.size, radius=[dp(10)])
        Color(0.067, 0.067, 0.078, 1)  # CARD
        pad = dp(1)
        btn._fill = RoundedRectangle(
            pos=(btn.x + pad, btn.y + pad),
            size=(btn.width - pad * 2, btn.height - pad * 2),
            radius=[dp(9)],
        )
    def _upd(*a):
        btn._border.pos  = btn.pos
        btn._border.size = btn.size
        btn._fill.pos    = (btn.x + dp(1), btn.y + dp(1))
        btn._fill.size   = (btn.width - dp(2), btn.height - dp(2))
    btn.bind(pos=_upd, size=_upd)
    btn.bind(on_press=lambda *_: on_press())
    return btn

# ─────────────────────────────────────────────────────────────────────────────
# Cricket grid widget
# ─────────────────────────────────────────────────────────────────────────────
class CricketGrid(GridLayout):
    LABELS = ['20', '19', '18', '17', '16', '15', 'B']

    # Mark display: open = dimmed, 1-2 hits = partial, closed = accent + checkmark
    _MARKS  = ['·', '/', 'X', '\u2713']
    _COLORS = [
        (0.3, 0.3, 0.38, 1),   # 0 hits — very dim
        (0.75, 0.75, 0.82, 1), # 1 hit
        (0.94, 0.94, 0.96, 1), # 2 hits
        None,                   # 3+ hits — uses ACCENT
    ]

    def __init__(self, state, **kwargs):
        super().__init__(cols=2, spacing=dp(6), padding=dp(10), **kwargs)
        self.state      = state
        self._mark_lbls = {}
        for tgt, label in zip(CRICKET_TARGETS, self.LABELS):
            name_lbl = Label(
                text=label, font_size=sp(17), bold=True,
                color=(0.6, 0.6, 0.7, 1),
                size_hint_x=0.35,
            )
            mark_lbl = Label(
                text=self._mark_text(tgt), font_size=sp(22), bold=True,
                color=self._mark_color(tgt), size_hint_x=0.65,
            )
            self._mark_lbls[tgt] = mark_lbl
            self.add_widget(name_lbl)
            self.add_widget(mark_lbl)

    def _mark_text(self, tgt):
        return self._MARKS[min(self.state.marks.get(tgt, 0), 3)]

    def _mark_color(self, tgt):
        n = min(self.state.marks.get(tgt, 0), 3)
        return self._COLORS[n] if self._COLORS[n] is not None else ACCENT

    def refresh(self):
        for tgt, lbl in self._mark_lbls.items():
            lbl.text  = self._mark_text(tgt)
            lbl.color = self._mark_color(tgt)

# ─────────────────────────────────────────────────────────────────────────────
# KvToggle — custom sliding toggle switch
# ─────────────────────────────────────────────────────────────────────────────
class KvToggle(Widget):
    """iOS-style toggle switch with smooth knob + track animation."""
    active = False

    def __init__(self, active=False, on_change=None, **kwargs):
        kwargs.setdefault('size_hint', (None, None))
        kwargs.setdefault('size', (dp(48), dp(28)))
        super().__init__(**kwargs)
        self.active     = active
        self._on_change = on_change
        self._track_ci  = None
        self._knob_rr   = None
        # Animated properties
        self._knob_x    = 0.0
        self._track_r   = 0.0
        self._track_g   = 0.0
        self._track_b   = 0.0
        self.bind(pos=self._redraw, size=self._redraw)
        Clock.schedule_once(lambda *_: self._snap_state(), 0)

    def _snap_state(self):
        """Set initial state without animation."""
        col = ACCENT if self.active else SEP
        self._track_r, self._track_g, self._track_b = col[0], col[1], col[2]
        self._knob_x = float((self.x + self.width - dp(26)) if self.active
                             else (self.x + dp(2)))
        self._redraw()

    def _redraw(self, *_):
        self.canvas.clear()
        knob_x = self._knob_x if self._knob_x else (
            (self.x + self.width - dp(26)) if self.active else (self.x + dp(2)))
        with self.canvas:
            self._track_ci = Color(self._track_r, self._track_g, self._track_b, 1)
            RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(14)])
            Color(1, 1, 1, 1)
            self._knob_rr = RoundedRectangle(
                pos=(knob_x, self.y + dp(2)),
                size=(dp(24), dp(24)), radius=[dp(12)])

    def _animate_to(self, new_active):
        self.active = new_active
        col = ACCENT if new_active else SEP
        target_x = float((self.x + self.width - dp(26)) if new_active
                         else (self.x + dp(2)))
        anim = Animation(
            _knob_x=target_x,
            _track_r=col[0], _track_g=col[1], _track_b=col[2],
            duration=0.2, transition='out_quad',
        )
        anim.bind(on_progress=lambda *_: self._redraw())
        anim.start(self)

    def on_touch_down(self, touch):
        if self.collide_point(*touch.pos):
            self._animate_to(not self.active)
            if self._on_change:
                self._on_change(self.active)
            return True
        return super().on_touch_down(touch)


# ─────────────────────────────────────────────────────────────────────────────
# Settings overlay
# ─────────────────────────────────────────────────────────────────────────────
class SettingsOverlay(FloatLayout):
    """Slide-up settings panel. Touch-blocks the game UI beneath it."""

    def __init__(self, cfg, save_cb, apply_theme_cb, **kwargs):
        kwargs.setdefault('pos_hint', {'x': 0, 'y': -1})
        kwargs.setdefault('size_hint', (1, 1))
        super().__init__(**kwargs)
        self._cfg          = cfg
        self._save_cb      = save_cb
        self._apply_theme  = apply_theme_cb
        self._build()

    # ── touch blocking ────────────────────────────────────────────────────────
    def on_touch_down(self, touch): super().on_touch_down(touch); return True
    def on_touch_move(self, touch): super().on_touch_move(touch); return True
    def on_touch_up(self, touch):   super().on_touch_up(touch);   return True

    # ── entrance / exit ───────────────────────────────────────────────────────
    def enter(self):
        Animation(pos_hint={'x': 0, 'y': 0}, duration=0.35, transition='out_back').start(self)

    def _close(self):
        def _remove(*_):
            if self.parent:
                self.parent.remove_widget(self)
        anim = Animation(pos_hint={'x': 0, 'y': -1}, duration=0.25, transition='in_quad')
        anim.bind(on_complete=lambda *_: _remove())
        anim.start(self)

    # ── build UI ──────────────────────────────────────────────────────────────
    def _build(self):
        # Dim backdrop (tappable to close)
        backdrop = Button(size_hint=(1, 1), background_normal='',
                          background_color=(0, 0, 0, 0.55),
                          on_press=lambda *_: self._close())
        self.add_widget(backdrop)

        # Panel card — bottom 72% of screen, rounded top
        panel = FloatLayout(size_hint=(1, 0.72), pos_hint={'x': 0, 'y': 0})
        with panel.canvas.before:
            Color(*SEP)
            panel._bdr = RoundedRectangle(pos=panel.pos, size=panel.size,
                                          radius=[dp(20), dp(20), 0, 0])
            Color(*CARD)
            panel._bg = RoundedRectangle(
                pos=(panel.x + dp(1), panel.y),
                size=(panel.width - dp(2), panel.height - dp(1)),
                radius=[dp(19), dp(19), 0, 0])
        def _upd_panel(*_):
            panel._bdr.pos  = panel.pos;  panel._bdr.size = panel.size
            p = dp(1)
            panel._bg.pos   = (panel.x + p, panel.y)
            panel._bg.size  = (panel.width - p*2, panel.height - p)
        panel.bind(pos=_upd_panel, size=_upd_panel)
        self.add_widget(panel)

        scroll = ScrollView(size_hint=(1, 1), do_scroll_x=False)
        panel.add_widget(scroll)

        content = BoxLayout(orientation='vertical', size_hint_y=None,
                            padding=[dp(24), dp(12), dp(24), dp(24)],
                            spacing=dp(6))
        content.bind(minimum_height=content.setter('height'))
        scroll.add_widget(content)

        # ── Header ────────────────────────────────────────────────────────────
        hdr = BoxLayout(size_hint_y=None, height=dp(48))
        hdr.add_widget(Label(text='Settings', font_size=sp(17), bold=True,
                             color=FG, halign='left', valign='middle',
                             size_hint_x=1, text_size=(None, None)))
        close_btn = Button(text='✕', font_size=sp(14),
                           size_hint=(None, None), size=(dp(32), dp(32)),
                           background_normal='', background_color=(0, 0, 0, 0),
                           color=FG2, on_press=lambda *_: self._close())
        with close_btn.canvas.before:
            Color(*CARD2)
            close_btn._bg = RoundedRectangle(pos=close_btn.pos,
                                             size=close_btn.size, radius=[dp(8)])
        close_btn.bind(pos=lambda *_: setattr(close_btn._bg, 'pos', close_btn.pos),
                       size=lambda *_: setattr(close_btn._bg, 'size', close_btn.size))
        hdr.add_widget(close_btn)
        content.add_widget(hdr)

        # ── Section: Player Theme ─────────────────────────────────────────────
        content.add_widget(self._section_label('COLOUR THEME'))

        active_theme = self._cfg.get('theme', 'Littler')
        theme_grid = GridLayout(cols=3, size_hint_y=None, spacing=dp(8))
        theme_grid.bind(minimum_height=theme_grid.setter('height'))

        for t_name, t_data in THEMES.items():
            is_selected = (t_name == active_theme)
            accent_col  = hex_to_kivy(t_data['accent'])
            surname = t_data['player'].split()[-1] if not t_data.get('_custom') else 'Custom'

            card = BoxLayout(orientation='vertical', size_hint_y=None,
                             height=dp(72), padding=[dp(6), dp(8), dp(6), dp(4)],
                             spacing=dp(4))
            with card.canvas.before:
                Color(*BG)
                card._bg = RoundedRectangle(pos=card.pos, size=card.size,
                                            radius=[dp(10)])
                if is_selected:
                    Color(*accent_col[:3], 0.55)
                else:
                    Color(*SEP)
                card._bdr = RoundedRectangle(pos=card.pos, size=card.size,
                                             radius=[dp(10)])

            def _make_upd(c):
                def _upd(w, v):
                    c._bg.pos  = (c.x + dp(1), c.y + dp(1))
                    c._bg.size = (c.width - dp(2), c.height - dp(2))
                    c._bdr.pos  = c.pos
                    c._bdr.size = c.size
                return _upd
            _upd = _make_upd(card)
            card.bind(pos=_upd, size=_upd)

            # Accent dot (centred)
            dot_wrap = Widget(size_hint=(1, None), height=dp(28))
            with dot_wrap.canvas:
                if is_selected:
                    Color(*FG)
                else:
                    Color(*SEP)
                dot_wrap._ring = Ellipse(pos=(0, 0), size=(dp(26), dp(26)))
                Color(*accent_col)
                dot_wrap._dot = Ellipse(pos=(0, 0), size=(dp(22), dp(22)))

            def _make_dot_upd(d):
                def _upd(*_):
                    d._ring.pos = (d.center_x - dp(13), d.center_y - dp(13))
                    d._ring.size = (dp(26), dp(26))
                    d._dot.pos  = (d.center_x - dp(11), d.center_y - dp(11))
                    d._dot.size = (dp(22), dp(22))
                return _upd
            dot_wrap.bind(pos=_make_dot_upd(dot_wrap), size=_make_dot_upd(dot_wrap))
            card.add_widget(dot_wrap)

            # Surname label
            card.add_widget(Label(
                text=surname, font_size=sp(8), bold=False,
                color=FG if is_selected else FG3,
                halign='center', valign='middle',
                size_hint_y=None, height=dp(16),
            ))

            # Tap handler
            touch_btn = Button(size_hint=(None, None), size=card.size,
                               background_normal='', background_color=(0, 0, 0, 0),
                               on_press=lambda *_, n=t_name: self._pick_theme(n))
            card.bind(size=lambda w, v, b=touch_btn: setattr(b, 'size', v))
            card.add_widget(touch_btn)
            theme_grid.add_widget(card)

        content.add_widget(theme_grid)

        # Custom hex row
        content.add_widget(self._section_label('CUSTOM COLOUR'))
        hex_row = BoxLayout(size_hint_y=None, height=dp(44), spacing=dp(8))
        self._hex_input = TextInput(
            hint_text='Hex colour  e.g. #E8007A',
            text=self._cfg.get('custom_accent', ''),
            font_size=sp(12), multiline=False,
            background_normal='', background_color=(*BG[:3], 1),
            foreground_color=FG, hint_text_color=FG2,
            cursor_color=ACCENT[:3] + (1,),
            size_hint_x=1,
        )
        hex_row.add_widget(self._hex_input)
        apply_btn = Button(text='Apply', font_size=sp(11), bold=True,
                           size_hint=(None, 1), width=dp(70),
                           background_normal='', background_color=(0, 0, 0, 0),
                           color=PRI_FG, on_press=lambda *_: self._on_apply_custom())
        with apply_btn.canvas.before:
            Color(*ACCENT)
            apply_btn._bg = RoundedRectangle(pos=apply_btn.pos,
                                             size=apply_btn.size, radius=[dp(10)])
        apply_btn.bind(
            pos=lambda *_: setattr(apply_btn._bg, 'pos', apply_btn.pos),
            size=lambda *_: setattr(apply_btn._bg, 'size', apply_btn.size),
        )
        hex_row.add_widget(apply_btn)
        content.add_widget(hex_row)

        # ── Section: Voice ────────────────────────────────────────────────────
        content.add_widget(self._section_label('VOICE'))

        content.add_widget(self._switch_row(
            'Read back scores (TTS)', '',
            self._cfg.get('voice_confirm', True),
            lambda v: self._save('voice_confirm', v)))
        content.add_widget(self._switch_row(
            'Announce session average', 'X01 mode',
            self._cfg.get('voice_stats', True),
            lambda v: self._save('voice_stats', v)))

        # ── Voice volume slider ───────────────────────────────────────────────
        content.add_widget(self._section_label('VOICE VOLUME'))
        vol = self._cfg.get('voice_volume', 0.9)
        self._vol_lbl = Label(text=f'{int(vol * 100)}%', font_size=sp(11),
                              bold=True, color=FG, size_hint_y=None, height=dp(22),
                              halign='right', valign='middle')
        self._vol_lbl.bind(size=lambda i, v: setattr(i, 'text_size', v))
        content.add_widget(self._vol_lbl)
        content.add_widget(self._slider(
            val=vol, min_val=0.1, max_val=1.0,
            on_change=lambda v: self._on_slider('voice_volume', v,
                                                self._vol_lbl, '%', 100)))

        # ── Speech speed slider ───────────────────────────────────────────────
        content.add_widget(self._section_label('SPEECH SPEED'))
        rate = self._cfg.get('voice_rate', 170)
        self._rate_lbl = Label(text=f'{int(rate)} wpm', font_size=sp(11),
                               bold=True, color=FG, size_hint_y=None, height=dp(22),
                               halign='right', valign='middle')
        self._rate_lbl.bind(size=lambda i, v: setattr(i, 'text_size', v))
        content.add_widget(self._rate_lbl)
        content.add_widget(self._slider(
            val=rate, min_val=100, max_val=250,
            on_change=lambda v: self._on_slider('voice_rate', v,
                                                self._rate_lbl, 'wpm', 1)))

        # ── Section: Gameplay ─────────────────────────────────────────────────
        content.add_widget(self._section_label('GAMEPLAY'))

        content.add_widget(self._switch_row(
            'Per-dart scoring', 'Say each dart individually',
            self._cfg.get('per_dart_mode', False),
            lambda v: self._save('per_dart_mode', v)))
        content.add_widget(self._switch_row(
            'Live checkout tracking', 'Show remaining + checkout route',
            self._cfg.get('live_checkout', False),
            lambda v: self._save('live_checkout', v)))
        content.add_widget(self._switch_row(
            'Require trigger word', 'Only score when trigger is spoken',
            self._cfg.get('require_trigger', True),
            lambda v: self._save('require_trigger', v)))

        # ── Trigger word input ────────────────────────────────────────────────
        content.add_widget(self._section_label('TRIGGER WORD'))
        tw_input = TextInput(
            text=self._cfg.get('trigger', 'score'),
            hint_text='e.g. score', font_size=sp(12), multiline=False,
            size_hint_y=None, height=dp(44),
            background_normal='', background_color=(*BG[:3], 1),
            foreground_color=FG, hint_text_color=FG2,
            cursor_color=ACCENT[:3] + (1,),
        )
        tw_input.bind(text=lambda inst, v: self._save('trigger', v.strip() or 'score'))
        content.add_widget(tw_input)

        # ── Cancel word input ─────────────────────────────────────────────────
        content.add_widget(self._section_label('CANCEL WORD'))
        cw_sub = Label(text='Say to undo last dart / score', font_size=sp(9),
                       color=FG2, size_hint_y=None, height=dp(18),
                       halign='left', valign='middle')
        cw_sub.bind(size=lambda i, v: setattr(i, 'text_size', v))
        content.add_widget(cw_sub)
        cw_input = TextInput(
            text=self._cfg.get('cancel_word', 'wait'),
            hint_text='e.g. wait', font_size=sp(12), multiline=False,
            size_hint_y=None, height=dp(44),
            background_normal='', background_color=(*BG[:3], 1),
            foreground_color=FG, hint_text_color=FG2,
            cursor_color=ACCENT[:3] + (1,),
        )
        cw_input.bind(text=lambda inst, v: self._save('cancel_word', v.strip() or 'wait'))
        content.add_widget(cw_input)

        # Bottom padding
        content.add_widget(Widget(size_hint_y=None, height=dp(20)))

    # ── helpers ───────────────────────────────────────────────────────────────
    def _section_label(self, text):
        """Section header with accent bar (matches Windows _section helper)."""
        row = BoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8),
                        padding=[0, dp(10), 0, dp(2)])
        # Accent bar
        bar = Widget(size_hint=(None, None), size=(dp(3), dp(14)))
        with bar.canvas:
            Color(*ACCENT)
            bar._rr = RoundedRectangle(pos=bar.pos, size=bar.size, radius=[dp(2)])
        bar.bind(pos=lambda *_: setattr(bar._rr, 'pos', bar.pos),
                 size=lambda *_: setattr(bar._rr, 'size', bar.size))
        row.add_widget(bar)
        lbl = Label(text=text, font_size=sp(8), bold=True, color=FG2,
                    halign='left', valign='middle', size_hint_x=1)
        lbl.bind(size=lambda inst, v: setattr(inst, 'text_size', v))
        row.add_widget(lbl)
        return row

    def _switch_row(self, label, sublabel, initial, on_change):
        """Bordered toggle-switch row (matches Windows _switch_row)."""
        row = BoxLayout(size_hint_y=None, height=dp(58),
                        padding=[dp(14), dp(10), dp(14), dp(10)])
        with row.canvas.before:
            Color(*SEP)
            row._bdr = RoundedRectangle(pos=row.pos, size=row.size, radius=[dp(10)])
            Color(*BG)
            row._bg = RoundedRectangle(
                pos=(row.x + dp(1), row.y + dp(1)),
                size=(row.width - dp(2), row.height - dp(2)),
                radius=[dp(9)])
        def _upd(w, *_):
            w._bdr.pos = w.pos; w._bdr.size = w.size
            w._bg.pos  = (w.x + dp(1), w.y + dp(1))
            w._bg.size = (w.width - dp(2), w.height - dp(2))
        row.bind(pos=_upd, size=_upd)

        text_col = BoxLayout(orientation='vertical', size_hint_x=1)
        title_lbl = Label(text=label, font_size=sp(12), bold=True, color=FG,
                          halign='left', valign='middle',
                          size_hint_y=None, height=dp(22))
        title_lbl.bind(size=lambda i, v: setattr(i, 'text_size', v))
        text_col.add_widget(title_lbl)
        if sublabel:
            sub_lbl = Label(text=sublabel, font_size=sp(9), color=FG2,
                            halign='left', valign='top',
                            size_hint_y=None, height=dp(16))
            sub_lbl.bind(size=lambda i, v: setattr(i, 'text_size', v))
            text_col.add_widget(sub_lbl)
        row.add_widget(text_col)
        row.add_widget(KvToggle(active=initial, on_change=on_change))
        return row

    def _slider(self, val, min_val, max_val, on_change):
        """Horizontal slider styled to match Windows sliders."""
        sl = Slider(min=min_val, max=max_val, value=val,
                    size_hint_y=None, height=dp(36),
                    cursor_size=(dp(22), dp(22)))
        # Style the slider via canvas
        sl.background_color = (*SEP[:3], 1)
        sl.cursor_image = ''
        sl.bind(value=lambda inst, v: on_change(v))
        return sl

    def _on_slider(self, key, value, lbl, unit, scale):
        """Update label + save config on slider change."""
        display = int(value * scale)
        lbl.text = f'{display} {unit}' if unit != '%' else f'{display}%'
        self._save(key, round(value, 2) if scale > 1 else int(value))

    def _save(self, key, value):
        self._cfg[key] = value
        self._save_cb()

    def _pick_theme(self, theme_name):
        custom_hex = self._cfg.get('custom_accent', '#FFFFFF')
        self._apply_theme(theme_name, custom_hex)

    def _on_apply_custom(self):
        raw = self._hex_input.text.strip()
        if not raw.startswith('#'):
            raw = '#' + raw
        if len(raw) in (4, 7):
            self._apply_theme('Custom', raw)


# ─────────────────────────────────────────────────────────────────────────────
# Paywall overlay
# ─────────────────────────────────────────────────────────────────────────────
class PaywallOverlay(FloatLayout):
    """
    Full-screen overlay shown when the demo has expired and the user has
    no active subscription.  Two modes:
      - Subscribe: opens Stripe Checkout, polls for confirmation.
      - Sign In: email OTP flow, signs in and re-checks subscription.

    Slides up from below on entry and blocks all touch events underneath.
    """

    def __init__(self, on_unlocked, **kwargs):
        # Start below the screen; animate to y=0 after build
        kwargs.setdefault('pos_hint', {'x': 0, 'y': -1})
        super().__init__(**kwargs)
        self._on_unlocked = on_unlocked
        self._poll_event  = None
        self._card        = None
        self._build()

    def on_touch_down(self, touch):
        """Absorb all touches — nothing beneath us should be reachable."""
        super().on_touch_down(touch)
        return True

    def on_touch_move(self, touch):
        super().on_touch_move(touch)
        return True

    def on_touch_up(self, touch):
        super().on_touch_up(touch)
        return True

    def enter(self):
        """Slide up from off-screen. Call after adding to parent."""
        Animation(
            pos_hint={'x': 0, 'y': 0},
            duration=0.4,
            transition='out_back',
        ).start(self)

    def _build(self):
        # Dark dim background with faint radial glow from card centre
        with self.canvas.before:
            Color(0, 0, 0, 0.92)
            self._bg = RoundedRectangle(pos=self.pos, size=self.size, radius=[0])
        self.bind(pos=lambda *_: setattr(self._bg, 'pos', self.pos),
                  size=lambda *_: setattr(self._bg, 'size', self.size))

        card = BoxLayout(
            orientation='vertical',
            size_hint=(0.88, None),
            height=dp(420),
            pos_hint={'center_x': 0.5, 'center_y': 0.5},
            padding=[dp(24), dp(20), dp(24), dp(20)], spacing=dp(10),
        )

        # Card bg + accent border + radial glow overlay
        with card.canvas.before:
            # Card fill
            Color(*CARD)
            card._bg_rect = RoundedRectangle(pos=card.pos, size=card.size, radius=[dp(20)])
            # Accent border
            ar, ag, ab = ACCENT[0], ACCENT[1], ACCENT[2]
            Color(ar, ag, ab, 0.45)
            card._border = RoundedRectangle(pos=card.pos, size=card.size, radius=[dp(20)])
            # Radial glow (faint, at top-centre)
            Color(ar * 0.28, ag * 0.02, ab * 0.06, 1)
            card._glow = Ellipse(size=(dp(260), dp(200)), pos=(0, 0))  # positioned on bind
        def _upd_card(*_):
            card._bg_rect.pos  = card.pos
            card._bg_rect.size = card.size
            card._border.pos   = (card.x - dp(0.5), card.y - dp(0.5))
            card._border.size  = (card.width + dp(1), card.height + dp(1))
            card._glow.pos     = (card.center_x - dp(130), card.top - dp(60))
        card.bind(pos=_upd_card, size=_upd_card)

        # Lock icon (matches Windows lock circle)
        icon_wrap = Widget(size_hint_y=None, height=dp(72))
        def _draw_lock(w, *_):
            w.canvas.clear()
            cx, cy = w.center_x, w.center_y
            r = dp(36)
            with w.canvas:
                # Circle background
                Color(*ACCENT)
                Ellipse(pos=(cx - r, cy - r), size=(r * 2, r * 2))
                # Shackle (arc)
                Color(1, 1, 1, 1)
                Line(ellipse=(cx - dp(10), cy - dp(2), dp(20), dp(20), 0, 180),
                     width=dp(2.5), cap='round')
                # Body
                Rectangle(pos=(cx - dp(14), cy - dp(12)),
                          size=(dp(28), dp(18)))
                # Keyhole
                Color(*ACCENT)
                Ellipse(pos=(cx - dp(4), cy - dp(6)), size=(dp(8), dp(8)))
                Rectangle(pos=(cx - dp(2), cy - dp(8)),
                           size=(dp(4), dp(6)))
        icon_wrap.bind(pos=_draw_lock, size=_draw_lock)
        card.add_widget(icon_wrap)

        # Title
        card.add_widget(Label(
            text='Free Preview Ended.',
            font_size=sp(22), bold=True, color=FG,
            size_hint_y=None, height=dp(32),
            halign='center', valign='middle',
        ))

        # Description
        card.add_widget(Label(
            text=(
                'Hope you enjoyed the warm-up.\n'
                'Start your 7-Day Free Trial to keep scoring.\n'
                'Auto-bills \u00a36.99/mo after trial. Cancel anytime.'
            ),
            font_size=sp(10), color=FG2,
            halign='center', valign='middle',
            size_hint_y=None, height=dp(72),
        ))

        # Subscribe button
        self._sub_btn = _accent_btn(
            'Start 7-Day Free Trial', self._open_checkout
        )
        card.add_widget(self._sub_btn)

        # Secondary CTA
        signin_btn = _ghost_btn(
            "I've already subscribed \u2014 Sign In", self._show_signin
        )
        card.add_widget(signin_btn)

        # Status label
        self._status_lbl = Label(
            text='', font_size=sp(10), color=FG2,
            size_hint_y=None, height=dp(18),
        )
        card.add_widget(self._status_lbl)

        # Security note
        sec_lbl = Label(
            text='\U0001f512  Secured via Stripe & Supabase',
            font_size=sp(9), color=FG3,
            size_hint_y=None, height=dp(20),
            halign='center', valign='middle',
        )
        card.add_widget(sec_lbl)

        self._card = card
        self.add_widget(card)

    def _open_checkout(self):
        import webbrowser
        webbrowser.open('https://dartvoice.com')
        self._sub_btn.text = 'Waiting for payment…'
        # Auto-poll after a short delay (checks Supabase for active subscription)
        self._start_polling(max_attempts=12, interval=8)

    def _check_now(self):
        self._status_lbl.text = 'Checking…'
        self._start_polling(max_attempts=5, interval=4)

    def _start_polling(self, max_attempts: int, interval: float):
        if self._poll_event:
            self._poll_event.cancel()
        self._remaining = max_attempts
        self._poll_event = Clock.schedule_interval(
            lambda dt: self._poll_once(), interval
        )

    def _poll_once(self):
        try:
            from billing import check_subscription_async
        except ImportError:
            return
        self._remaining -= 1

        def _got(subscribed, account=None):
            if subscribed:
                if self._poll_event:
                    self._poll_event.cancel()
                Clock.schedule_once(lambda dt: self._on_unlocked())
            elif self._remaining <= 0:
                if self._poll_event:
                    self._poll_event.cancel()
                Clock.schedule_once(lambda dt: setattr(
                    self._status_lbl, 'text',
                    'Not activated yet — retry or check your email.'
                ))
                Clock.schedule_once(lambda dt: setattr(
                    self._sub_btn, 'text', 'Start 7-Day Free Trial'
                ))

        check_subscription_async(_got)

    # ── Sign-in flow ──────────────────────────────────────────────────────────

    def _show_signin(self):
        """Replace the subscribe card with an email-OTP sign-in card."""
        from kivy.uix.textinput import TextInput

        if self._card:
            self.remove_widget(self._card)

        ar, ag, ab = ACCENT[0], ACCENT[1], ACCENT[2]

        panel = BoxLayout(
            orientation='vertical',
            size_hint=(0.88, None),
            height=dp(380),
            pos_hint={'center_x': 0.5, 'center_y': 0.5},
            padding=[dp(24), dp(20), dp(24), dp(20)], spacing=dp(10),
        )
        with panel.canvas.before:
            Color(*CARD)
            panel._bg = RoundedRectangle(pos=panel.pos, size=panel.size, radius=[dp(20)])
            Color(ar, ag, ab, 0.45)
            panel._border = RoundedRectangle(pos=panel.pos, size=panel.size, radius=[dp(20)])
        def _upd_panel(*_):
            panel._bg.pos = panel.pos; panel._bg.size = panel.size
            panel._border.pos = (panel.x - dp(0.5), panel.y - dp(0.5))
            panel._border.size = (panel.width + dp(1), panel.height + dp(1))
        panel.bind(pos=_upd_panel, size=_upd_panel)
        self._signin_panel = panel

        panel.add_widget(Label(
            text='SIGN IN', font_size=sp(20), bold=True, color=FG,
            size_hint_y=None, height=dp(30), halign='center', valign='middle',
        ))
        panel.add_widget(Label(
            text="Enter your email — we'll send a 6-digit code.",
            font_size=sp(11), color=FG2,
            size_hint_y=None, height=dp(24),
            halign='center', valign='middle',
        ))

        self._si_email = TextInput(
            hint_text='your@email.com',
            font_size=sp(13), multiline=False,
            background_normal='', background_color=(*BG[:3], 1),
            foreground_color=FG, hint_text_color=FG2,
            cursor_color=ACCENT[:3] + (1,),
            size_hint_y=None, height=dp(50),
        )
        panel.add_widget(self._si_email)

        self._si_send_btn = _accent_btn('CONTINUE  →', self._si_send)
        panel.add_widget(self._si_send_btn)

        # OTP step (hidden initially)
        self._si_code = TextInput(
            hint_text='0 0 0 0 0 0',
            font_size=sp(28), multiline=False,
            halign='center',
            background_normal='', background_color=(*BG[:3], 1),
            foreground_color=FG, hint_text_color=FG2,
            cursor_color=ACCENT[:3] + (1,),
            input_filter='int',
            size_hint_y=None, height=dp(64),
            opacity=0, disabled=True,
        )
        panel.add_widget(self._si_code)

        self._si_verify_btn = _accent_btn('VERIFY CODE  →', self._si_verify)
        self._si_verify_btn.opacity  = 0
        self._si_verify_btn.disabled = True
        panel.add_widget(self._si_verify_btn)

        self._si_msg = Label(
            text='', font_size=sp(10), color=(1.0, 0.333, 0.333, 1),
            size_hint_y=None, height=dp(20),
            halign='center', valign='middle',
        )
        panel.add_widget(self._si_msg)

        back_btn = _ghost_btn('← Back', self._show_subscribe)
        panel.add_widget(back_btn)

        self.add_widget(panel)

    def _si_send(self):
        try:
            from billing import send_otp
        except ImportError:
            self._si_msg.text = 'Billing module not available.'
            return
        email = self._si_email.text.strip()
        if not email or '@' not in email:
            self._si_msg.text = 'Enter a valid email address.'
            return
        self._si_send_btn.text = 'Sending…'
        self._si_msg.text = ''

        def _do():
            ok, err = send_otp(email)
            def _ui(dt):
                self._si_send_btn.text = 'Resend code'
                if ok:
                    self._si_msg.text = f'Code sent to {email}'
                    self._si_email.disabled  = True
                    self._si_code.opacity    = 1
                    self._si_code.disabled   = False
                    self._si_verify_btn.opacity  = 1
                    self._si_verify_btn.disabled = False
                    Clock.schedule_once(lambda dt2: self._si_code.focus_next, 0.1)
                else:
                    self._si_msg.text = f'Error: {err}'
            Clock.schedule_once(_ui)
        threading.Thread(target=_do, daemon=True).start()

    def _si_verify(self):
        try:
            from billing import verify_otp, check_subscription_async
        except ImportError:
            self._si_msg.text = 'Billing module not available.'
            return
        email = self._si_email.text.strip()
        code  = self._si_code.text.strip()
        if len(code) < 6:
            self._si_msg.text = 'Enter the full 6-digit code.'
            return
        self._si_verify_btn.text = 'Verifying…'
        self._si_msg.text = ''

        def _do():
            ok, err = verify_otp(email, code)
            def _ui(dt):
                self._si_verify_btn.text = 'VERIFY CODE  →'
                if ok:
                    self._si_msg.text = 'Signed in — checking subscription…'
                    check_subscription_async(self._on_signin_checked)
                else:
                    self._si_msg.text = 'Invalid code — try again.'
                    self._si_code.text = ''
            Clock.schedule_once(_ui)
        threading.Thread(target=_do, daemon=True).start()

    def _on_signin_checked(self, subscribed: bool, account=None):
        if subscribed:
            Clock.schedule_once(lambda dt: self._on_unlocked())
        else:
            Clock.schedule_once(lambda dt: self._show_subscribe(
                msg='Signed in — no active subscription found.\nStart a trial to continue.'
            ))

    def _show_subscribe(self, msg=''):
        """Return to the subscribe card (from sign-in)."""
        if hasattr(self, '_signin_panel') and self._signin_panel.parent:
            self.remove_widget(self._signin_panel)
        if self._card and not self._card.parent:
            self.add_widget(self._card)
        if msg and hasattr(self, '_status_lbl'):
            self._status_lbl.text = msg


# ─────────────────────────────────────────────────────────────────────────────
# Main UI
# ─────────────────────────────────────────────────────────────────────────────
class DartVoiceLayout(FloatLayout):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        Window.clearcolor = BG

        self.cfg = load_config()
        # Apply saved theme before building UI
        _apply_theme(
            self.cfg.get('theme', 'Littler'),
            self.cfg.get('custom_accent', '#FFFFFF'),
        )
        self.state = GameState(
            mode  = self.cfg.get('game_mode', 'X01'),
            start = int(self.cfg.get('x01_start', 501)),
        )
        self._listener      = None
        self._active        = False
        self._status_ev     = None
        self._current_darts = []      # per-dart accumulation
        self._x01_remaining = None    # live checkout tracking

        self._build()
        Clock.schedule_once(lambda dt: self._billing_gate(), 0.5)

    def _billing_gate(self):
        try:
            from billing import billing_status, check_subscription_async
        except ImportError:
            return

        try:
            bs = billing_status()
        except Exception:
            return
        # Background server verification regardless of local state
        check_subscription_async(self._on_billing_checked)

        if bs['subscribed']:
            return

        if bs['demo_active']:
            mins = int(bs['demo_secs'] // 60)
            self.status_lbl.text = (
                f"Demo — {mins} min{'s' if mins != 1 else ''} remaining"
            )
            return

        # Demo expired — show blocking paywall
        self._show_paywall()

    def _on_billing_checked(self, subscribed: bool, account=None):
        if subscribed:
            Clock.schedule_once(
                lambda dt: setattr(self.status_lbl, 'text', 'Ready')
            )
            # Remove paywall overlay if it's showing
            if hasattr(self, '_paywall_overlay') and \
               self._paywall_overlay.parent:
                Clock.schedule_once(
                    lambda dt: self._remove_paywall()
                )
            return
        try:
            from billing import billing_status
        except ImportError:
            return
        bs = billing_status()
        if bs['locked']:
            Clock.schedule_once(lambda dt: self._show_paywall())

    def _apply_theme_cb(self, theme_name, custom_hex='#FFFFFF'):
        _apply_theme(theme_name, custom_hex)
        self._save_cfg({'theme': theme_name, 'custom_accent': custom_hex})
        for child in list(self.children):
            if isinstance(child, (SettingsOverlay, PaywallOverlay)):
                self.remove_widget(child)
        self.clear_widgets()
        self._build()

    def _show_settings(self):
        if any(isinstance(c, SettingsOverlay) for c in self.children):
            return
        overlay = SettingsOverlay(
            cfg=self.cfg,
            save_cb=lambda: self._save_cfg({}),
            apply_theme_cb=self._apply_theme_cb,
            size_hint=(1, 1),
        )
        self.add_widget(overlay)
        Clock.schedule_once(lambda dt: overlay.enter(), 0)

    def _save_cfg(self, extra):
        self.cfg.update(extra)
        save_config(self.cfg)

    def _show_paywall(self):
        if hasattr(self, '_paywall_overlay') and self._paywall_overlay.parent:
            return
        overlay = PaywallOverlay(
            on_unlocked=self._remove_paywall,
            size_hint=(1, 1),
        )
        self._paywall_overlay = overlay
        self.add_widget(overlay)
        # Trigger slide-up entrance on next frame (after layout pass)
        Clock.schedule_once(lambda dt: overlay.enter(), 0)

    def _remove_paywall(self):
        if hasattr(self, '_paywall_overlay') and self._paywall_overlay.parent:
            self.remove_widget(self._paywall_overlay)
        self.status_lbl.text = 'Subscription active — welcome!'

    def _build(self):
        import math
        # ── Background fill ───────────────────────────────────────────────
        with self.canvas.before:
            Color(*BG)
            self._bg_fill = RoundedRectangle(pos=self.pos, size=self.size, radius=[0])
        self.bind(pos=lambda *_: setattr(self._bg_fill, 'pos', self.pos),
                  size=lambda *_: setattr(self._bg_fill, 'size', self.size))

        # ── Dartboard wire background (subtle overlay) ────────────────────
        def _draw_wire(*_):
            if not self.width or not self.height:
                return
            cw, ch = self.width, self.height
            cx = cw / 2
            cy = ch + dp(40)
            self.canvas.after.clear()
            with self.canvas.after:
                wire_col = (0.075, 0.075, 0.09, 1)
                for r in (dp(80), dp(140), dp(200), dp(270), dp(360), dp(460), dp(570)):
                    Color(*wire_col)
                    pts = []
                    for i in range(65):
                        a = math.radians(i * 360 / 64)
                        pts += [cx + r * math.cos(a), cy + r * math.sin(a)]
                    Line(points=pts, width=dp(0.6))
                for i in range(20):
                    ang = math.radians(i * 18)
                    Line(points=[cx, cy,
                                 cx + dp(570) * math.cos(ang),
                                 cy + dp(570) * math.sin(ang)], width=dp(0.5))
        self.bind(size=_draw_wire, pos=_draw_wire)

        # ── Layout constants ──────────────────────────────────────────────
        ACCENT_H  = dp(3)
        HDR_H     = dp(52)
        DECK_FRAC = 0.44   # bottom deck is 44% of screen height

        # ── Top accent bar ────────────────────────────────────────────────
        accent_bar = Widget(size_hint=(1, None), height=ACCENT_H,
                            pos_hint={'x': 0, 'top': 1})
        with accent_bar.canvas:
            Color(*ACCENT)
            accent_bar._rect = RoundedRectangle(pos=accent_bar.pos,
                                                 size=accent_bar.size, radius=[0])
        accent_bar.bind(pos=lambda *_: setattr(accent_bar._rect, 'pos', accent_bar.pos),
                        size=lambda *_: setattr(accent_bar._rect, 'size', accent_bar.size))
        self._accent_bar = accent_bar
        self.add_widget(accent_bar)

        # ── Header nav bar ────────────────────────────────────────────────
        hdr = BoxLayout(
            orientation='horizontal', size_hint=(1, None), height=HDR_H,
            padding=[dp(14), dp(8), dp(14), dp(8)], spacing=dp(10),
        )
        def _pos_hdr(*_):
            hdr.x = 0
            hdr.y = self.height - ACCENT_H - HDR_H
        self.bind(size=_pos_hdr, pos=_pos_hdr)
        _card_bg(hdr, color=CARD, radius=0)

        from kivy.graphics import Ellipse as KvEllipse
        logo = Widget(size_hint=(None, None), size=(dp(28), dp(28)))
        def _redraw_logo(w, *_):
            w.canvas.clear()
            with w.canvas:
                for r, col in [(dp(14), (0.2,0.2,0.24,1)), (dp(9), ACCENT),
                               (dp(6), (0.2,0.2,0.24,1)), (dp(3), ACCENT),
                               (dp(1.2), (0.94,0.94,0.96,1))]:
                    Color(*col)
                    KvEllipse(pos=(w.center_x-r, w.center_y-r), size=(r*2, r*2))
        logo.bind(pos=_redraw_logo, size=_redraw_logo)
        hdr.add_widget(logo)

        hdr.add_widget(Label(text='DARTVOICE', font_size=sp(18), bold=True,
                             color=FG, halign='left', valign='middle', size_hint_x=1))

        self.mode_spinner = Spinner(
            text=self.cfg.get('game_mode', 'X01'), values=['X01', 'Cricket'],
            size_hint=(None, None), size=(dp(90), dp(34)),
            font_size=sp(12), bold=True,
            background_normal='', background_color=(0, 0, 0, 0), color=FG2,
        )
        with self.mode_spinner.canvas.before:
            Color(*SEP)
            self.mode_spinner._bg = RoundedRectangle(
                pos=self.mode_spinner.pos, size=self.mode_spinner.size, radius=[dp(8)])
        self.mode_spinner.bind(
            pos=lambda *_: setattr(self.mode_spinner._bg, 'pos', self.mode_spinner.pos),
            size=lambda *_: setattr(self.mode_spinner._bg, 'size', self.mode_spinner.size),
        )
        self.mode_spinner.bind(text=self._on_mode_change)
        hdr.add_widget(self.mode_spinner)
        self._hdr = hdr
        self.add_widget(hdr)

        # ── Top stage: score display ──────────────────────────────────────
        top_stage = BoxLayout(
            orientation='vertical', spacing=dp(6),
            padding=[dp(24), dp(8), dp(24), dp(8)],
            size_hint=(1, None),
        )
        def _pos_stage(*_):
            deck_h = self.height * DECK_FRAC
            top_stage.y      = deck_h
            top_stage.height = self.height - ACCENT_H - HDR_H - deck_h
        self.bind(size=_pos_stage, pos=_pos_stage)

        self.maximum_lbl = Label(text='', font_size=sp(9), bold=True, color=ACCENT,
                                  halign='center', valign='middle',
                                  size_hint=(1, None), height=dp(18))
        top_stage.add_widget(self.maximum_lbl)

        # Score area label (REMAINING or LAST SCORE depending on mode)
        self._score_area_lbl = Label(
            text='REMAINING', font_size=sp(10), bold=True, color=FG2,
            halign='center', valign='middle',
            size_hint=(1, None), height=dp(20),
        )
        top_stage.add_widget(self._score_area_lbl)

        # Score area: FloatLayout with glow widget + score label layered
        self._score_float = FloatLayout(size_hint=(1, 1))

        # Glow canvas widget (radial glow + corner brackets)
        self._glow_widget = Widget(size_hint=(1, 1))
        self._score_float.add_widget(self._glow_widget)

        # Glow text label (translucent accent behind main score)
        self._glow_lbl = Label(
            text='', font_size=sp(76), bold=True,
            color=(0, 0, 0, 0),
            halign='center', valign='middle',
            size_hint=(1, 1),
        )
        self._score_float.add_widget(self._glow_lbl)

        self.score_lbl = Label(
            text=str(self.state.remaining), font_size=sp(76), bold=True,
            color=FG, halign='center', valign='middle',
            size_hint=(1, 1),
        )
        self._score_float.add_widget(self.score_lbl)
        top_stage.add_widget(self._score_float)

        # Bind glow redraw to layout changes and score updates
        self._glow_widget.bind(pos=lambda *_: self._redraw_score_glow(),
                               size=lambda *_: self._redraw_score_glow())
        self.score_lbl.bind(text=lambda *_: self._redraw_score_glow(),
                            font_size=lambda *_: self._redraw_score_glow())

        # Per-dart slot display (hidden when not in per-dart mode)
        self.dart_row_lbl = Label(
            text='', font_size=sp(22), bold=True, color=FG2,
            halign='center', valign='middle',
            size_hint=(1, None), height=dp(32), opacity=0,
        )
        top_stage.add_widget(self.dart_row_lbl)

        # Live checkout hint
        self.checkout_lbl = Label(
            text='', font_size=sp(13), bold=True, color=ACCENT,
            halign='center', valign='middle',
            size_hint=(1, None), height=dp(24),
        )
        top_stage.add_widget(self.checkout_lbl)

        self.status_lbl = Label(text='Ready', font_size=sp(11), color=FG2,
                                 halign='center', valign='middle',
                                 size_hint=(1, None), height=dp(26))
        top_stage.add_widget(self.status_lbl)
        self._top_stage = top_stage
        self.add_widget(top_stage)

        # ── Cricket grid (hidden initially, overlays top stage) ───────────
        self.cricket_card = BoxLayout(
            orientation='vertical', size_hint=(1, None),
            height=dp(260), padding=dp(10), spacing=dp(4), opacity=0,
        )
        def _pos_cricket(*_):
            self.cricket_card.y = self.height * DECK_FRAC
        self.bind(size=_pos_cricket, pos=_pos_cricket)
        _card_bg(self.cricket_card)
        self.cricket_grid = CricketGrid(self.state)
        self.cricket_card.add_widget(self.cricket_grid)
        self.add_widget(self.cricket_card)

        # ── History box (hidden; exists for _add_history compatibility) ────
        self.history_box = BoxLayout(
            orientation='vertical', size_hint=(None, None),
            size=(0, 0), spacing=0, opacity=0,
        )
        self.history_box.bind(minimum_height=self.history_box.setter('height'))
        self.add_widget(self.history_box)

        # ── Bottom deck (44% screen, rounded top card) ────────────────────
        # Extra bottom padding on Android to clear the system navigation bar
        _nav_pad = dp(48) if ANDROID else 0
        deck = BoxLayout(
            orientation='vertical', spacing=dp(12),
            padding=[dp(16), dp(16), dp(16), dp(16) + _nav_pad],
            size_hint=(1, DECK_FRAC), pos_hint={'x': 0, 'y': 0},
        )
        with deck.canvas.before:
            Color(*SEP)
            deck._bdr = RoundedRectangle(pos=deck.pos, size=deck.size,
                                          radius=[dp(24), dp(24), 0, 0])
            Color(*CARD)
            deck._bg = RoundedRectangle(
                pos=(deck.x + dp(1), deck.y),
                size=(deck.width - dp(2), deck.height - dp(1)),
                radius=[dp(23), dp(23), 0, 0],
            )
        def _upd_deck(*_):
            deck._bdr.pos  = deck.pos;  deck._bdr.size = deck.size
            p = dp(1)
            deck._bg.pos   = (deck.x + p, deck.y)
            deck._bg.size  = (deck.width - p*2, deck.height - p)
        deck.bind(pos=_upd_deck, size=_upd_deck)

        # ── Stats grid: [AVG] [DARTS] [LAST] ─────────────────────────────
        stats_grid = GridLayout(cols=3, spacing=dp(8),
                                size_hint_y=None, height=dp(82))

        def _stat_card(header_text):
            card = BoxLayout(orientation='vertical', spacing=dp(2),
                             padding=[dp(6), dp(8), dp(6), dp(6)])
            with card.canvas.before:
                Color(*SEP)
                card._bdr = RoundedRectangle(pos=card.pos, size=card.size, radius=[dp(12)])
                Color(*BG)
                card._bg = RoundedRectangle(
                    pos=(card.x + dp(1), card.y + dp(1)),
                    size=(card.width - dp(2), card.height - dp(2)),
                    radius=[dp(11)])
            def _upd(w, *_):
                w._bdr.pos = w.pos; w._bdr.size = w.size
                w._bg.pos  = (w.x + dp(1), w.y + dp(1))
                w._bg.size = (w.width - dp(2), w.height - dp(2))
            card.bind(pos=_upd, size=_upd)
            card.add_widget(Label(text=header_text, font_size=sp(9), bold=True,
                                   color=FG2, halign='center', valign='middle',
                                   size_hint=(1, None), height=dp(16)))
            val = Label(text='—', font_size=sp(17), bold=True, color=FG,
                        halign='center', valign='middle')
            card.add_widget(val)
            return card, val

        avg_card,   self.avg_lbl   = _stat_card('AVG')
        darts_card, self.darts_lbl = _stat_card('DARTS')
        last_card,  self.last_lbl  = _stat_card('LAST')
        self.last_lbl.color = ACCENT

        stats_grid.add_widget(avg_card)
        stats_grid.add_widget(darts_card)
        stats_grid.add_widget(last_card)
        deck.add_widget(stats_grid)

        # ── Button row: [Settings icon] [Listen btn] [Undo icon] ─────────
        btn_row = BoxLayout(orientation='horizontal', spacing=dp(12),
                            size_hint_y=None, height=dp(62))

        def _icon_area(icon_name, on_press_cb):
            """Square icon button using FloatLayout (icon widget + transparent Button)."""
            area = FloatLayout(size_hint=(None, 1), width=dp(62))
            with area.canvas.before:
                Color(*SEP)
                area._bdr = RoundedRectangle(pos=area.pos, size=area.size, radius=[dp(14)])
                Color(*BG)
                area._bg = RoundedRectangle(
                    pos=(area.x + dp(1), area.y + dp(1)),
                    size=(area.width - dp(2), area.height - dp(2)),
                    radius=[dp(13)])
            def _upd(w, *_):
                w._bdr.pos = w.pos;  w._bdr.size = w.size
                w._bg.pos  = (w.x + dp(1), w.y + dp(1))
                w._bg.size = (w.width - dp(2), w.height - dp(2))
            area.bind(pos=_upd, size=_upd)

            icon_w = self._create_icon_widget(icon_name, FG2, dp(22))
            icon_w.size_hint = (None, None)
            icon_w.size = (dp(40), dp(40))
            icon_w.pos_hint = {'center_x': 0.5, 'center_y': 0.5}
            area.add_widget(icon_w)

            touch_btn = Button(size_hint=(1, 1), background_normal='',
                               background_color=(0, 0, 0, 0),
                               on_press=lambda *_: on_press_cb())
            area.add_widget(touch_btn)
            return area

        btn_row.add_widget(_icon_area('settings', self._show_settings))

        # Center: Toggle listen button + floating mic icon overlay
        toggle_wrap = FloatLayout()
        self.toggle_btn = Button(
            text='START LISTENING', font_size=sp(13), bold=True,
            size_hint=(1, 1),
            background_normal='', background_color=(0, 0, 0, 0),
            color=FG, on_press=lambda *_: self._toggle(),
        )
        toggle_wrap.add_widget(self.toggle_btn)

        self._mic_icon = self._create_icon_widget('mic', FG, dp(20))
        self._mic_icon.size_hint = (None, None)
        self._mic_icon.size = (dp(28), dp(28))
        self._mic_icon.pos_hint = {'center_x': 0.18, 'center_y': 0.5}
        self._mic_icon.opacity = 0  # shown only when active
        toggle_wrap.add_widget(self._mic_icon)

        self._set_toggle_style(active=False)
        btn_row.add_widget(toggle_wrap)

        btn_row.add_widget(_icon_area('rotate-ccw', self._reset))
        deck.add_widget(btn_row)
        self._deck = deck
        self.add_widget(deck)

        self._refresh_mode_ui()

        # ── PiP mode detection ────────────────────────────────────────────
        self._pip_mode = False
        self._pip_dot = None
        Window.bind(size=lambda *_: Clock.schedule_once(
            lambda dt: self._check_pip_mode(), 0.1))

    # ── Icon widget factory ───────────────────────────────────────────────────
    def _create_icon_widget(self, icon_name, color=None, size=None):
        """Return a Widget with the named icon drawn via Kivy canvas primitives."""
        import math as _math
        if size is None:
            size = dp(20)
        if color is None:
            color = FG2

        w = Widget()

        def _draw(widget, *_):
            widget.canvas.clear()
            cx = widget.center_x
            cy = widget.center_y
            s  = size / 24.0
            lw = max(dp(1.2), size / 14.0)
            with widget.canvas:
                Color(*color)
                if icon_name == 'mic':
                    # Body: rounded rectangle outline
                    # SVG rect (9,2)-(15,14) → Kivy bottom-left (cx-3s, cy-2s), 6s×12s
                    Line(rounded_rectangle=(cx - 3*s, cy - 2*s, 6*s, 12*s, 3*s), width=lw)
                    # Stand arc: bottom semicircle centred at SVG(12,11) → Kivy(cx, cy+s)
                    # radius 7s; angle_start=180, angle_end=360 draws the lower half
                    Line(ellipse=(cx - 7*s, cy + s - 7*s, 14*s, 14*s, 180, 360), width=lw)
                    # Stem: SVG (12,19)→(12,23) → Kivy (cx, cy-7s)→(cx, cy-11s)
                    Line(points=[cx, cy - 7*s, cx, cy - 11*s], width=lw)
                    # Base: SVG (8,23)→(16,23) → Kivy (cx-4s, cy-11s)→(cx+4s, cy-11s)
                    Line(points=[cx - 4*s, cy - 11*s, cx + 4*s, cy - 11*s], width=lw)

                elif icon_name == 'settings':
                    # Gear: 8-tooth polygon (alternating outer / inner radius)
                    ro = 9.5 * s; ri = 6.0 * s; teeth = 8
                    pts = []
                    for i in range(teeth * 2):
                        angle = _math.radians(i * 180.0 / teeth - 90)
                        r = ro if i % 2 == 0 else ri
                        pts.extend([cx + r * _math.cos(angle),
                                    cy + r * _math.sin(angle)])
                    Line(points=pts, width=lw, close=True)
                    # Centre hole
                    Line(ellipse=(cx - 3.5*s, cy - 3.5*s, 7*s, 7*s), width=lw)

                elif icon_name == 'rotate-ccw':
                    # 270° counterclockwise arc (Kivy angles: 0=right, 90=up)
                    # Start at 60°, sweep CCW to 330° (= 270° of arc)
                    Line(ellipse=(cx - 8*s, cy - 8*s, 16*s, 16*s, 60, 330), width=lw)
                    # L-shaped arrowhead at arc start (SVG top-left, ~(3,7))
                    # SVG (3,7) → Kivy (cx-9s, cy+5s); (9,7)→(cx-3s, cy+5s); (3,13)→(cx-9s, cy-s)
                    Line(points=[cx - 3*s, cy + 5*s,
                                 cx - 9*s, cy + 5*s,
                                 cx - 9*s, cy - s], width=lw)

        w.bind(pos=_draw, size=_draw)
        return w

    # ── Mode switching ────────────────────────────────────────────────────────
    def _on_mode_change(self, spinner, value):
        self.cfg['game_mode'] = value
        save_config(self.cfg)
        self.state.mode = value
        self._reset()
        self._refresh_mode_ui()

    def _refresh_mode_ui(self):
        mode     = self.cfg.get('game_mode', 'X01')
        is_live  = self.cfg.get('live_checkout', False) and mode == 'X01'
        is_pdart = self.cfg.get('per_dart_mode', False) and mode == 'X01'
        if mode == 'Cricket':
            self.cricket_card.height  = dp(260)
            self.cricket_card.opacity = 1
            self.score_lbl.text      = 'CRICKET'
            self.score_lbl.font_size = sp(48)
        else:
            self.cricket_card.height  = 0
            self.cricket_card.opacity = 0
            self.score_lbl.text      = str(self.state.remaining)
            self.score_lbl.font_size = sp(76 if not is_pdart else 52)
        if hasattr(self, '_score_area_lbl'):
            self._score_area_lbl.text = 'REMAINING' if is_live else 'LAST SCORE'
        if hasattr(self, 'dart_row_lbl'):
            self.dart_row_lbl.opacity = 1 if is_pdart else 0

    # ── Listening toggle ──────────────────────────────────────────────────────
    def _toggle(self):
        if self._active:
            self._stop_listening()
        else:
            self._start_listening()

    def _redraw_score_glow(self):
        """Redraw radial background glow, corner brackets, and text glow
        behind the score label — mirrors the Windows _redraw_score canvas."""
        gw = self._glow_widget
        gw.canvas.clear()

        if not gw.width or not gw.height:
            return

        x0, y0 = gw.x, gw.y
        x1, y1 = gw.right, gw.top
        w, h = gw.width, gw.height

        with gw.canvas:
            # ── Radial background glow (only when listening) ──────────────
            if self._active:
                ar, ag, ab = ACCENT[0], ACCENT[1], ACCENT[2]
                bgr, bgg, bgb = BG[0], BG[1], BG[2]
                for wf, hf, alpha in [(0.9, 1.6, 0.06),
                                      (0.65, 1.1, 0.10),
                                      (0.42, 0.7, 0.13)]:
                    ew = w * wf
                    eh = h * hf
                    Color(ar * alpha + bgr * (1 - alpha),
                          ag * alpha + bgg * (1 - alpha),
                          ab * alpha + bgb * (1 - alpha), 1)
                    Ellipse(pos=(gw.center_x - ew / 2, gw.center_y - eh / 2),
                            size=(ew, eh))

            # ── Corner brackets ───────────────────────────────────────────
            arm = dp(14)
            lw = dp(1.5)
            col = ACCENT if self._active else SEP
            Color(*col)
            Line(points=[x0, y0 + arm, x0, y0, x0 + arm, y0],
                 width=lw, cap='round')
            Line(points=[x1 - arm, y0, x1, y0, x1, y0 + arm],
                 width=lw, cap='round')
            Line(points=[x0, y1 - arm, x0, y1, x0 + arm, y1],
                 width=lw, cap='round')
            Line(points=[x1 - arm, y1, x1, y1, x1, y1 - arm],
                 width=lw, cap='round')

        # ── Text glow label ───────────────────────────────────────────────
        if hasattr(self, '_glow_lbl'):
            self._glow_lbl.text = self.score_lbl.text
            self._glow_lbl.font_size = self.score_lbl.font_size
            if self._active:
                self._glow_lbl.color = (*ACCENT_GLO[:3], 0.35)
            else:
                self._glow_lbl.color = (0, 0, 0, 0)

    # ── PiP mode (compact pill) ─────────────────────────────────────────────
    def _check_pip_mode(self):
        """Detect Picture-in-Picture by window size and toggle layout."""
        w, h = Window.size
        # Ignore zero-size events during init (Android hasn't sized the window yet)
        if w <= 0 or h <= 0:
            return
        is_pip = w < dp(300) and h < dp(400)
        if is_pip and not self._pip_mode:
            self._enter_pip()
        elif not is_pip and self._pip_mode:
            self._exit_pip()

    def _enter_pip(self):
        """Switch to compact pill layout: score + darts + checkout + dot."""
        self._pip_mode = True
        # Hide everything except the score stage
        for w in (self._accent_bar, self._hdr, self._deck,
                  self.cricket_card, self.history_box):
            w.opacity = 0
            w.size_hint_y = None
            w.height = 0

        # Reconfigure top_stage to fill entire screen
        self._top_stage.y = 0
        self._top_stage.height = self.height
        self._top_stage.padding = [dp(8), dp(4), dp(8), dp(4)]
        self._top_stage.spacing = dp(2)

        # Enlarge score and show dart row always in per-dart mode
        self.score_lbl.font_size = sp(52)
        if self.cfg.get('per_dart_mode', False):
            self.dart_row_lbl.opacity = 1

        # Show checkout hint
        if self.cfg.get('live_checkout', False):
            self.checkout_lbl.font_size = sp(11)

        # Shrink or hide non-essential labels
        if hasattr(self, '_score_area_lbl'):
            self._score_area_lbl.height = 0
            self._score_area_lbl.opacity = 0
        self.maximum_lbl.height = 0
        self.maximum_lbl.opacity = 0

        # Add status dot
        if not self._pip_dot:
            self._pip_dot = Widget(size_hint=(None, None),
                                   size=(dp(10), dp(10)))
            def _draw_dot(w, *_):
                w.canvas.clear()
                col = ACCENT if self._active else FG3
                with w.canvas:
                    Color(*col)
                    Ellipse(pos=w.pos, size=w.size)
            self._pip_dot.bind(pos=_draw_dot, size=_draw_dot)
            self._pip_dot._draw = _draw_dot
        self._pip_dot.pos = (self.width - dp(18), self.height - dp(18))
        self.add_widget(self._pip_dot)

        # Compact status label
        self.status_lbl.font_size = sp(9)
        self.status_lbl.height = dp(14)

    def _exit_pip(self):
        """Restore full layout from PiP mode."""
        self._pip_mode = False
        ACCENT_H = dp(3)
        HDR_H    = dp(52)
        DECK_FRAC = 0.44

        # Restore hidden widgets
        for w in (self._accent_bar, self._hdr, self._deck,
                  self.cricket_card, self.history_box):
            w.opacity = 1
            w.size_hint_y = None  # keep explicit

        self._accent_bar.height = ACCENT_H
        self._hdr.height = HDR_H
        self._deck.size_hint_y = DECK_FRAC

        # Restore cricket card height based on mode
        mode = self.cfg.get('game_mode', 'X01')
        if mode == 'Cricket':
            self.cricket_card.height = dp(260)
            self.cricket_card.opacity = 1
        else:
            self.cricket_card.height = 0
            self.cricket_card.opacity = 0

        self.history_box.size = (0, 0)
        self.history_box.opacity = 0

        # Restore top_stage positioning
        self._top_stage.padding = [dp(24), dp(8), dp(24), dp(8)]
        self._top_stage.spacing = dp(6)

        # Restore score sizing
        self._refresh_mode_ui()

        # Restore labels
        if hasattr(self, '_score_area_lbl'):
            self._score_area_lbl.height = dp(20)
            self._score_area_lbl.opacity = 1
        self.maximum_lbl.height = dp(18)
        self.maximum_lbl.opacity = 1
        self.status_lbl.font_size = sp(11)
        self.status_lbl.height = dp(26)

        # Remove PiP dot
        if self._pip_dot and self._pip_dot.parent:
            self.remove_widget(self._pip_dot)

    def _redraw_pip_dot(self):
        """Refresh the PiP status dot color."""
        if self._pip_dot and hasattr(self._pip_dot, '_draw'):
            self._pip_dot._draw(self._pip_dot)

    def _set_toggle_style(self, active):
        """Animate the toggle button background into the new active/inactive state."""
        btn = self.toggle_btn

        if active:
            target_bg = STOP_BG
            target_fg = ACCENT
        else:
            target_bg = ACCENT
            target_fg = PRI_FG

        # Build the canvas instruction objects (or reuse if already present)
        if not hasattr(btn, '_anim_color_instr'):
            btn.canvas.before.clear()
            with btn.canvas.before:
                if active:
                    Color(*ACCENT)
                    btn._border_instr = RoundedRectangle(
                        pos=btn.pos, size=btn.size, radius=[dp(12)])
                btn._anim_color_instr = Color(*target_bg)
                pad = dp(1.5) if active else 0
                btn._bg = RoundedRectangle(
                    pos=(btn.x + pad, btn.y + pad),
                    size=(btn.width - pad * 2, btn.height - pad * 2),
                    radius=[dp(12 if not active else 11)],
                )
        else:
            # Canvas already exists — just update border presence and rebuild
            btn.canvas.before.clear()
            with btn.canvas.before:
                if active:
                    Color(*ACCENT)
                    btn._border_instr = RoundedRectangle(
                        pos=btn.pos, size=btn.size, radius=[dp(12)])
                btn._anim_color_instr = Color(*target_bg)
                pad = dp(1.5) if active else 0
                btn._bg = RoundedRectangle(
                    pos=(btn.x + pad, btn.y + pad),
                    size=(btn.width - pad * 2, btn.height - pad * 2),
                    radius=[dp(12 if not active else 11)],
                )

        # Rebind size/pos updates — remove previous binding first
        prev = getattr(btn, '_toggle_upd_cb', None)
        if prev is not None:
            btn.unbind(pos=prev, size=prev)

        if active:
            def _upd_active(*_):
                p = dp(1.5)
                if hasattr(btn, '_border_instr'):
                    btn._border_instr.pos  = btn.pos
                    btn._border_instr.size = btn.size
                btn._bg.pos  = (btn.x + p, btn.y + p)
                btn._bg.size = (btn.width - p*2, btn.height - p*2)
            btn._toggle_upd_cb = _upd_active
            btn.bind(pos=_upd_active, size=_upd_active)
        else:
            def _upd_inactive(*_):
                if hasattr(btn, '_bg'):
                    btn._bg.pos  = btn.pos
                    btn._bg.size = btn.size
            btn._toggle_upd_cb = _upd_inactive
            btn.bind(pos=_upd_inactive, size=_upd_inactive)

        # Animate the canvas Color r/g/b over 0.3 s
        ci = btn._anim_color_instr
        anim = Animation(r=target_bg[0], g=target_bg[1], b=target_bg[2],
                         duration=0.3, transition='out_quad')
        anim.start(ci)

        # Animate text colour
        txt_anim = Animation(color=target_fg, duration=0.3, transition='out_quad')
        txt_anim.start(btn)

        # Mic icon visibility
        if hasattr(self, '_mic_icon'):
            Animation(opacity=1 if active else 0,
                      duration=0.2, transition='out_quad').start(self._mic_icon)

        # Redraw score glow (radial bg + brackets + text shadow)
        if hasattr(self, '_glow_widget'):
            self._redraw_score_glow()
        # Redraw PiP status dot
        if self._pip_mode:
            self._redraw_pip_dot()

    def _start_listening(self):
        if ANDROID:
            # Ensure mic permission is granted before starting
            try:
                from android.permissions import request_permissions, Permission, check_permission  # type: ignore
                if not check_permission(Permission.RECORD_AUDIO):
                    request_permissions(
                        [Permission.RECORD_AUDIO],
                        callback=lambda perms, results: (
                            Clock.schedule_once(lambda dt: self._start_listening())
                            if results and results[0] else
                            Clock.schedule_once(lambda dt: self._set_status('Mic permission denied'))
                        ),
                    )
                    self._set_status('Requesting mic permission…')
                    return
            except Exception:
                pass
            # Use the background service; it writes to dv_scores.json
            _start_foreground_service()
            self._poll_ev = Clock.schedule_interval(self._poll_service, 0.5)
        else:
            model_path = self._find_model()
            if not model_path:
                return
            self._listener = SpeechListener(
                model_path, self.cfg, self._on_score, self._set_status,
                on_cancel=self._on_cancel, on_new_leg=self._on_new_leg,
            )
            self._listener.start()
        self._active = True
        self.toggle_btn.text = 'STOP LISTENING'
        self._set_toggle_style(active=True)
        # Initialise live checkout on first start
        if self.cfg.get('live_checkout', False) and self._x01_remaining is None:
            self._x01_remaining = self.cfg.get('x01_start', 501)
            self._update_checkout_display()
        # Pulse mic icon while listening
        if hasattr(self, '_mic_icon'):
            self._mic_icon.opacity = 1
            _mic_anim = (Animation(opacity=0.3, duration=0.7) +
                         Animation(opacity=1.0, duration=0.7))
            _mic_anim.repeat = True
            _mic_anim.start(self._mic_icon)

    def _stop_listening(self):
        if ANDROID:
            _stop_foreground_service()
            if hasattr(self, '_poll_ev') and self._poll_ev:
                self._poll_ev.cancel()
                self._poll_ev = None
        else:
            if self._listener:
                self._listener.stop()
                self._listener = None
        self._active = False
        self.toggle_btn.text = 'START LISTENING'
        self._set_toggle_style(active=False)
        self._set_status('Stopped')
        # Stop mic pulse animation
        if hasattr(self, '_mic_icon'):
            Animation.cancel_all(self._mic_icon)
            self._mic_icon.opacity = 0

    # ── Service score polling (Android only) ──────────────────────────────────
    def _poll_service(self, dt):
        """Read scores written by service/main.py and apply them to game state."""
        if not ANDROID:
            return
        try:
            from android.storage import app_storage_path  # type: ignore
            score_file  = os.path.join(app_storage_path(), 'dv_scores.json')
            status_file = os.path.join(app_storage_path(), 'dv_status.txt')

            # Status
            if os.path.exists(status_file):
                with open(status_file) as f:
                    msg = f.read().strip()
                if msg:
                    self.status_lbl.text = msg
                    open(status_file, 'w').close()   # consume

            # Scores
            if not os.path.exists(score_file):
                return
            with open(score_file) as f:
                events = json.load(f)
            if not events:
                return

            # Consume all pending events
            open(score_file, 'w').write('[]')
            for ev_wrap in events:
                ev = ev_wrap.get('data', ev_wrap)
                # Action events (cancel, new_leg, dart_submit)
                action = ev.get('action')
                if action == 'cancel':
                    self._on_cancel(); continue
                if action == 'new_leg':
                    self._on_new_leg(); continue
                if action == 'dart_submit':
                    self._on_score(('dart_submit',)); continue
                # Cricket
                if ev.get('mode') == 'Cricket':
                    darts = [tuple(d) for d in ev.get('darts', [])]
                    if darts:
                        self._apply_cricket(darts)
                # X01 per-dart
                elif ev.get('mode') == 'X01' and 'dart' in ev:
                    dart_val, dart_disp = ev['dart']
                    self._on_score(('dart', dart_val, dart_disp))
                # X01 standard
                elif ev.get('mode') == 'X01':
                    score = ev.get('score')
                    if score is not None:
                        self._apply_x01(score)
        except Exception:
            pass

    def _find_model(self):
        """Locate (and extract if needed) the Vosk model directory."""
        self._set_status('Loading model…')
        path = _ensure_model()
        if not path:
            self._set_status('Vosk model not found')
        return path

    # ── Score callbacks ───────────────────────────────────────────────────────
    @staticmethod
    def _haptic_pulse():
        """Short 50 ms vibration — silently skipped on non-Android platforms."""
        try:
            from plyer import vibrator
            vibrator.vibrate(time=0.05)
        except Exception:
            pass

    def _on_score(self, data):
        self._haptic_pulse()
        mode = self.cfg.get('game_mode', 'X01')
        if mode == 'Cricket':
            Clock.schedule_once(lambda dt: self._apply_cricket(data))
            return
        # X01 per-dart: submit signal
        if isinstance(data, tuple) and data[0] == 'dart_submit':
            if self._current_darts:
                Clock.schedule_once(lambda dt: self._submit_current_visit())
            return
        # X01 per-dart: single dart
        if isinstance(data, tuple) and data[0] == 'dart':
            _, dart_val, dart_disp = data
            Clock.schedule_once(lambda dt: self._apply_dart(dart_val, dart_disp))
            return
        # X01 standard (total score)
        Clock.schedule_once(lambda dt: self._apply_x01(data))

    def _on_cancel(self):
        """Undo the last dart (per-dart mode) or last visit (standard mode)."""
        def _do(dt):
            if self.cfg.get('per_dart_mode', False) and self._current_darts:
                removed_val, removed_disp = self._current_darts.pop()
                if self.cfg.get('live_checkout', False) and self._x01_remaining is not None:
                    self._x01_remaining += removed_val
                self._update_dart_display()
                self._update_checkout_display()
                self._set_status(f"Cancelled: {removed_disp}")
            elif self.state.scores:
                removed = self.state.scores.pop()
                self.state.remaining += removed
                if self.cfg.get('live_checkout', False):
                    self._x01_remaining = self.state.remaining
                self.score_lbl.text = str(self.state.remaining)
                self._update_checkout_display()
                if self.state.scores:
                    avg   = sum(self.state.scores) / len(self.state.scores)
                    darts = len(self.state.scores) * 3
                    self.avg_lbl.text   = f'Avg {avg:.1f}'
                    self.darts_lbl.text = f'Darts {darts}'
                else:
                    self.avg_lbl.text   = 'Avg —'
                    self.darts_lbl.text = 'Darts 0'
                self._set_status(f"Undid {removed}")
            else:
                self._set_status("Nothing to cancel")
        Clock.schedule_once(_do)

    def _on_new_leg(self):
        def _do(dt):
            start = self.cfg.get('x01_start', 501)
            self.state.remaining = start
            self._x01_remaining = start
            self._current_darts = []
            self.score_lbl.text = str(start)
            if self.cfg.get('per_dart_mode', False) and hasattr(self, 'dart_row_lbl'):
                self.dart_row_lbl.text    = ''
                self.dart_row_lbl.opacity = 0
            self._update_checkout_display()
            self._set_status(f"New leg — {start} remaining")
        Clock.schedule_once(_do)

    def _apply_dart(self, dart_val, dart_disp):
        """Accept one dart in per-dart mode."""
        self._current_darts.append((dart_val, dart_disp))
        if self.cfg.get('live_checkout', False) and self._x01_remaining is not None:
            self._x01_remaining -= dart_val
        self._update_dart_display()
        self._update_checkout_display()
        if self.cfg.get('voice_confirm', True):
            speak(dart_disp, self.cfg)
        if len(self._current_darts) >= 3:
            self._submit_current_visit()

    def _submit_current_visit(self):
        """Submit the accumulated darts as one visit."""
        if not self._current_darts:
            return
        total = sum(v for v, _ in self._current_darts)
        self._current_darts = []
        self._apply_x01(total)
        if self.cfg.get('voice_confirm', True):
            speak(str(total), self.cfg)
        if self.cfg.get('voice_stats', True) and len(self.state.scores) >= 3:
            avg = sum(self.state.scores) / len(self.state.scores)
            speak(f"Average {avg:.0f}", self.cfg)

    def _update_dart_display(self):
        """Show current dart slots (e.g. 'T19  15  —') in per-dart mode."""
        if not self.cfg.get('per_dart_mode', False):
            return
        slots = [d for _, d in self._current_darts]
        while len(slots) < 3:
            slots.append('—')
        self.dart_row_lbl.text    = '   '.join(slots)
        self.dart_row_lbl.opacity = 1

    def _update_checkout_display(self):
        """Update score label and checkout hint for live checkout mode."""
        if not self.cfg.get('live_checkout', False):
            return
        rem = self._x01_remaining if self._x01_remaining is not None else self.state.remaining
        self.score_lbl.text = str(max(0, rem))
        hint = checkout_hint(rem)
        self.checkout_lbl.text = hint or ('—' if isinstance(rem, int) and 2 <= rem <= 170 else '')

    def _apply_x01(self, score):
        result = self.state.apply_x01(score)
        # Update live checkout remaining
        if self.cfg.get('live_checkout', False):
            self._x01_remaining = self.state.remaining
            self._update_checkout_display()
        else:
            self.score_lbl.text = str(self.state.remaining)
        # In per-dart mode, clear dart row after submit
        if self.cfg.get('per_dart_mode', False):
            self.dart_row_lbl.text    = ''
            self.dart_row_lbl.opacity = 0
        # MAXIMUM treatment for 180
        if score == 180:
            self.maximum_lbl.text = 'M A X I M U M'
            self.score_lbl.color  = ACCENT
        else:
            self.maximum_lbl.text = ''
            self.score_lbl.color  = FG
        if self.state.scores:
            avg   = sum(self.state.scores) / len(self.state.scores)
            darts = len(self.state.scores) * 3
            self.avg_lbl.text   = f'Avg {avg:.1f}'
            self.darts_lbl.text = f'Darts {darts}'
        self._add_history(self.state.history[-1] if self.state.history else '')
        if result == 'bust':
            self._set_status('BUST!')
            if self.cfg.get('voice_confirm', True):
                speak('Bust', self.cfg)
        elif result == 'win':
            self._set_status('GAME SHOT!')
            if self.cfg.get('voice_confirm', True):
                speak('Game shot!', self.cfg)
        else:
            self._set_status(f'Score: {score}')
            if self.cfg.get('voice_confirm', True) and not self.cfg.get('per_dart_mode', False):
                speak(str(score), self.cfg)
            if self.cfg.get('voice_stats', True) and len(self.state.scores) >= 3 and not self.cfg.get('per_dart_mode', False):
                avg = sum(self.state.scores) / len(self.state.scores)
                speak(f"Average {avg:.0f}", self.cfg)

    def _apply_cricket(self, darts):
        results = self.state.apply_cricket(darts)
        self.cricket_grid.refresh()
        label = '  '.join(r[2] for r in results)
        self._add_history(label)
        self._set_status(label)
        speak(label, self.cfg)
        if self.state.cricket_done:
            self._set_status('All closed!')
            speak('All closed!', self.cfg)

    # ── History ───────────────────────────────────────────────────────────────
    def _add_history(self, text):
        # Try to split "label  →  remaining" or just show full text
        row = BoxLayout(
            orientation='horizontal', size_hint_y=None, height=dp(38),
            padding=[dp(12), 0, dp(12), 0], spacing=dp(8),
        )
        _card_bg(row, color=(0.09, 0.09, 0.11, 1), radius=8)

        # Parse optional "score  →  remaining" format
        parts = text.split('→') if '→' in text else [text, '']
        left_text  = parts[0].strip()
        right_text = parts[1].strip() if len(parts) > 1 else ''

        # Update LAST stat card with the most recent score
        if hasattr(self, 'last_lbl'):
            self.last_lbl.text = left_text

        # Determine if score was 180 for special accent colour
        score_col = ACCENT if left_text == '180' else FG
        right_col = FG2

        row.add_widget(Label(
            text=left_text, font_size=sp(13), bold=True,
            color=score_col, halign='left', valign='middle',
            size_hint_x=0.55,
        ))
        if right_text:
            row.add_widget(Label(
                text=right_text, font_size=sp(11),
                color=right_col, halign='right', valign='middle',
                size_hint_x=0.45,
            ))

        # Separator line under the row
        sep = Widget(size_hint_y=None, height=dp(1))
        with sep.canvas:
            Color(*SEP)
            sep._r = RoundedRectangle(pos=sep.pos, size=sep.size, radius=[0])
        sep.bind(pos=lambda *_: setattr(sep._r, 'pos', sep.pos),
                 size=lambda *_: setattr(sep._r, 'size', sep.size))

        self.history_box.add_widget(sep,  index=0)
        self.history_box.add_widget(row,  index=0)  # newest at top

    # ── Status ────────────────────────────────────────────────────────────────
    def _set_status(self, msg):
        Clock.schedule_once(lambda dt: setattr(self.status_lbl, 'text', msg))

    # ── Reset ─────────────────────────────────────────────────────────────────
    def _reset(self):
        self.state.reset()
        self._current_darts = []
        self._x01_remaining = None
        if self.state.mode == 'X01':
            self.score_lbl.text      = str(self.state.remaining)
            self.score_lbl.font_size = sp(76)
        else:
            self.score_lbl.text      = 'CRICKET'
            self.score_lbl.font_size = sp(48)
        self.score_lbl.color = FG
        if hasattr(self, 'maximum_lbl'):
            self.maximum_lbl.text = ''
        if hasattr(self, 'dart_row_lbl'):
            self.dart_row_lbl.text    = ''
            self.dart_row_lbl.opacity = 0
        if hasattr(self, 'checkout_lbl'):
            self.checkout_lbl.text = ''
        self.avg_lbl.text    = 'Avg —'
        self.darts_lbl.text  = 'Darts 0'
        self.history_box.clear_widgets()
        if hasattr(self, 'cricket_grid'):
            self.cricket_grid.refresh()
        self._set_status('Ready')


# ─────────────────────────────────────────────────────────────────────────────
# Android foreground service helper
# ─────────────────────────────────────────────────────────────────────────────
_android_service = None   # global reference so we can stop it later

def _start_foreground_service():
    """
    Launch the python-for-android background service (service/main.py).
    The service writes scores to dv_scores.json; the UI polls that file.
    """
    global _android_service
    if not ANDROID:
        return
    try:
        from android import AndroidService  # type: ignore
        _android_service = AndroidService('DartVoice', 'Listening for scores…')
        _android_service.start('started')
    except Exception:
        pass

def _stop_foreground_service():
    global _android_service
    if not ANDROID or _android_service is None:
        return
    try:
        _android_service.stop()
    except Exception:
        pass
    _android_service = None

# ─────────────────────────────────────────────────────────────────────────────
# App entry point
# ─────────────────────────────────────────────────────────────────────────────
class DartVoiceAndroidApp(App):
    def build(self):
        if ANDROID:
            self._request_mic_permission()
        Window.clearcolor = BG
        return DartVoiceLayout()

    def _request_mic_permission(self):
        """Request RECORD_AUDIO at startup so the permission dialog shows immediately."""
        try:
            from android.permissions import request_permissions, Permission, check_permission  # type: ignore
            if not check_permission(Permission.RECORD_AUDIO):
                request_permissions([Permission.RECORD_AUDIO])
        except Exception:
            pass

    def on_pause(self):
        if ANDROID:
            try:
                from jnius import autoclass  # type: ignore
                Build = autoclass('android.os.Build$VERSION')
                if Build.SDK_INT >= 26:
                    PythonActivity = autoclass('org.kivy.android.PythonActivity')
                    Builder   = autoclass('android.app.PictureInPictureParams$Builder')
                    Rational  = autoclass('android.util.Rational')
                    params = Builder().setAspectRatio(Rational(9, 16)).build()
                    PythonActivity.mActivity.enterPictureInPictureMode(params)
            except Exception:
                pass
        return True

    def on_resume(self):
        # PiP exit is handled by Window.size binding in DartVoiceLayout
        pass


if __name__ == '__main__':
    DartVoiceAndroidApp().run()
