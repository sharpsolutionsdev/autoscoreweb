import sys, os, json, threading, time, re, math

_score_lock = threading.Lock()
import tkinter as tk
from tkinter import messagebox
import customtkinter as ctk
import pyautogui

pyautogui.FAILSAFE = False

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
def resource_path(relative):
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)

def config_path():
    if getattr(sys, 'frozen', False):
        return os.path.join(os.path.dirname(sys.executable), 'dartvoice_config.json')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dartvoice_config.json')

# ─────────────────────────────────────────────────────────────────────────────
# Font loading  (must run before any widget is created)
# ─────────────────────────────────────────────────────────────────────────────
def _load_fonts():
    try:
        import ctypes
        font_dir = resource_path('fonts')
        for f in ['UberMoveBold.otf', 'UberMoveMedium.otf', 'Rubik-VariableFont_wght.ttf']:
            p = os.path.join(font_dir, f)
            if os.path.exists(p):
                ctypes.windll.gdi32.AddFontResourceW(p)
    except Exception:
        pass

_load_fonts()

# ─────────────────────────────────────────────────────────────────────────────
# Palette
# ─────────────────────────────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")

BG         = '#08080A'
CARD       = '#111114'
CARD2      = '#18181C'
SEP        = '#252530'
FG         = '#F0F0F5'
FG2        = '#6E6E82'
FG3        = '#2E2E3A'
SEC_BG     = '#18181C'
SEC_HOV    = '#222228'

# ── Theme presets ────────────────────────────────────────────────────────────
# Each entry: display name → accent colours.
# 'player' and 'nickname' are shown in the theme picker UI.
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

def _derive_shades(hex_accent: str) -> dict:
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

    dim   = _to_hex(*colorsys.hsv_to_rgb(hh, s, v * 0.55))
    glow  = _to_hex(*colorsys.hsv_to_rgb(hh, max(0, s - 0.15), min(1, v * 1.25)))
    hov   = _to_hex(*colorsys.hsv_to_rgb(hh, s, min(1, v * 1.12)))
    # dark tinted background colours
    stop  = _to_hex(*[c * 0.07 + r * 0.03 for c, r in zip((r, g, b), (1, 0, 0))])
    wire  = _to_hex(*[c * 0.09 for c in (r, g, b)])
    bdr   = _to_hex(*[c * 0.22 for c in (r, g, b)])
    # light accent needs dark text
    pri_fg = '#06060A' if v > 0.80 and s < 0.25 else '#FFFFFF'
    return {
        'accent': hex_accent, 'accent_dim': dim, 'accent_glo': glow,
        'pri_hov': hov, 'pri_fg': pri_fg,
        'stop_bg': stop, 'stop_hov': stop, 'stop_bdr': bdr,
        'wire_hint': wire,
    }

def _apply_theme(name: str, custom_accent: str = '#FFFFFF'):
    """Apply a theme by name, updating global colour variables."""
    global ACCENT, ACCENT_DIM, ACCENT_GLO, PRI_BG, PRI_FG, PRI_HOV
    global STOP_BG, STOP_HOV, STOP_BDR, _WIRE_HINT
    base = THEMES.get(name, THEMES['Littler'])
    if base.get('_custom'):
        t = _derive_shades(custom_accent)
    else:
        t = base
    ACCENT     = t['accent']
    ACCENT_DIM = t['accent_dim']
    ACCENT_GLO = t['accent_glo']
    PRI_BG     = t['accent']
    PRI_FG     = t.get('pri_fg', '#FFFFFF')
    PRI_HOV    = t['pri_hov']
    STOP_BG    = t['stop_bg']
    STOP_HOV   = t['stop_hov']
    STOP_BDR   = t['stop_bdr']
    _WIRE_HINT = t['wire_hint']

# Initialise defaults — will be overridden once config loads
ACCENT = ACCENT_DIM = ACCENT_GLO = PRI_BG = PRI_HOV = ''
PRI_FG = '#FFFFFF'
STOP_BG = STOP_HOV = STOP_BDR = _WIRE_HINT = ''
_apply_theme('Littler')

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
CONFIG_FILE = config_path()
DEFAULT_CONFIG = {
    'input_box': {}, 'cricket_grid': {},
    'trigger': 'score', 'require_trigger': True,
    'speed': 'Fast', 'game_mode': 'X01',
    'model': 'vosk-model-small-en-us', 'mic_index': None,
    'video_region': {}, 'video_board_cal': {}, 'video_scoring': False,
    'voice_assist': False, 'voice_confirm': True, 'voice_stats': True,
    'voice_rate': 170, 'voice_volume': 0.9,
    'theme': 'Littler', 'custom_accent': '#FFFFFF',
    # X01 game tracking
    'per_dart_mode': False,   # say each dart individually instead of the total
    'live_checkout': False,   # track remaining score + show checkout route
    'x01_start': 501,         # starting score (501 / 301 / 170)
    'cancel_word': 'wait',    # speak this to undo the last dart / score
    # Cricket settings
    'cricket_offset_x': 0,      # pixel offset to nudge all grid clicks horizontally
    'cricket_offset_y': 0,      # pixel offset to nudge all grid clicks vertically
    'cricket_click_delay': 500, # extra ms delay between cell clicks
    'cricket_auto_submit': True, # auto-click submit after entering darts
    'cricket_include_bull': True, # grid has 7 rows (20-15+bull) vs 6 (20-15 only)
}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                return {**DEFAULT_CONFIG, **json.load(f)}
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)

def save_config(cfg):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(cfg, f, indent=2)

# ─────────────────────────────────────────────────────────────────────────────
# Voice assistant (TTS)
# ─────────────────────────────────────────────────────────────────────────────
_tts_lock = threading.Lock()
_tts_engine = None

def _get_tts():
    global _tts_engine
    if _tts_engine is None:
        try:
            import pyttsx3
            _tts_engine = pyttsx3.init()
        except Exception:
            return None
    return _tts_engine

def speak(text, cfg):
    """Speak text in a background thread if voice assistant is enabled."""
    if not cfg.get('voice_assist', False):
        return
    def _do():
        with _tts_lock:
            eng = _get_tts()
            if not eng:
                return
            eng.setProperty('rate', cfg.get('voice_rate', 170))
            eng.setProperty('volume', cfg.get('voice_volume', 0.9))
            eng.say(text)
            eng.runAndWait()
    threading.Thread(target=_do, daemon=True).start()

_CRICKET_SPOKEN = {
    '20':'twenty','19':'nineteen','18':'eighteen',
    '17':'seventeen','16':'sixteen','15':'fifteen','b':'bullseye',
}
_MOD_SPOKEN = {'s':'single','d':'double','t':'treble'}

def _cricket_speech(darts):
    """Build a natural speech string for cricket darts."""
    parts = []
    for tgt, mod in darts:
        if tgt == 'miss':
            parts.append('miss')
        else:
            parts.append(f"{_MOD_SPOKEN.get(mod, '')} {_CRICKET_SPOKEN.get(tgt, tgt)}")
    return ', '.join(parts)

# ─────────────────────────────────────────────────────────────────────────────
# Vosk speech correction — common misrecognitions for short words
# ─────────────────────────────────────────────────────────────────────────────
_VOSK_CORRECTIONS = {
    # "four" misheard as:
    'for': 'four', 'fore': 'four', 'far': 'four', 'fur': 'four',
    'fall': 'four', 'foe': 'four', 'ford': 'four', 'fort': 'four',
    'floor': 'four', 'poor': 'four', 'war': 'four',
    # "zero" misheard as:
    'the row': 'zero', 'hero': 'zero', 'nero': 'zero',
    'arrow': 'zero', 'era': 'zero', 'z row': 'zero',
    'see row': 'zero', 'a row': 'zero',
}

def _fix_vosk(text):
    """Apply Vosk misrecognition corrections to raw transcript."""
    t = text.lower().strip()
    if t in _VOSK_CORRECTIONS:
        return _VOSK_CORRECTIONS[t]
    # Also check if the score portion (after trigger removal) matches
    for bad, good in _VOSK_CORRECTIONS.items():
        if t.endswith(' ' + bad):
            return t[: -len(bad)] + good
    return t

# ─────────────────────────────────────────────────────────────────────────────
# Parsers
# ─────────────────────────────────────────────────────────────────────────────
_ONES = {'zero':0,'oh':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,
         'for':4,'fore':4,'far':4,'fur':4,'foe':4,'ford':4,'fort':4,'floor':4,'poor':4,'war':4,
         'hero':0,'nero':0,'arrow':0,'era':0}
_TENS = {'twenty':20,'thirty':30,'forty':40,'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90}

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
_CRICKET_MODS = {'single':'s','double':'d','treble':'t','triple':'t',
                 'travel':'t','trouble':'t','tribal':'t','tremble':'t','trickle':'t',
                 'tripled':'t','tripple':'t','trebble':'t','trible':'t','tripe':'t',
                 'devil':'d','doubles':'d','doubled':'d','dabble':'d','dbl':'d',
                 'singles':'s','singled':'s','sgl':'s'}

_SHORTHAND_RE = re.compile(r'^([sdt])(\d{2}|bull?)$')
_SHORTHAND_TARGETS = {'20':'20','19':'19','18':'18','17':'17','16':'16','15':'15','bul':'b','bull':'b','b':'b'}

# ─────────────────────────────────────────────────────────────────────────────
# Single-dart parser  (for per-dart X01 mode)
# ─────────────────────────────────────────────────────────────────────────────
_SINGLE_DART_SH = re.compile(r'^([sdt])(\d{1,2})$')

def parse_single_dart(text):
    """Parse one spoken dart.  Returns (value: int, display: str) or None.
    Examples: 'triple twenty' → (60, 'T20'), 'double six' → (12, 'D6'),
              'fifteen' → (15, '15'), 'bull' → (50, 'Bull'), 't20' → (60, 'T20').
    """
    t = re.sub(r'\s+', ' ', text.lower().strip())
    # shorthand: t20 d6 s15
    m = _SINGLE_DART_SH.match(t)
    if m:
        mc, num = m.group(1), int(m.group(2))
        if 1 <= num <= 20:
            if mc == 't': return (num * 3, f"T{num}")
            if mc == 'd': return (num * 2, f"D{num}")
            return (num, str(num))
    # special names
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
    # modifier + number
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
    # No modifier: try reverse-mapping raw score to a dart (e.g. "51" → T17)
    if mod == 1:
        if val % 3 == 0 and 1 <= val // 3 <= 20:
            return (val, f"T{val // 3}")
        if val % 2 == 0 and 1 <= val // 2 <= 20:
            return (val, f"D{val // 2}")
    return None

# ─────────────────────────────────────────────────────────────────────────────
# Checkout suggestion table  (built once at import)
# ─────────────────────────────────────────────────────────────────────────────
def _build_checkout_table():
    # dart options in priority order (prefer high trebles → bull → doubles → singles)
    opts = [(t * 3, f"T{t}") for t in range(20, 0, -1)]
    opts.append((50, 'Bull'))
    opts += [(d * 2, f"D{d}") for d in range(20, 0, -1)]
    opts += [(s, str(s)) for s in range(20, 0, -1)]
    opts.append((25, '25'))
    doubles = [(d * 2, f"D{d}") for d in range(1, 21)] + [(50, 'Bull')]
    table = {}
    for n in range(2, 171):
        # 1-dart finish (must be a double)
        for dv, dn in doubles:
            if dv == n:
                table[n] = dn; break
        if n in table:
            continue
        # 2-dart finish
        found = False
        for fv, fn in opts:
            rem = n - fv
            if rem <= 0: continue
            for dv, dn in doubles:
                if dv == rem:
                    table[n] = f"{fn} {dn}"; found = True; break
            if found: break
        if found: continue
        # 3-dart finish
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
    """Return checkout route string for remaining, or None if not possible."""
    if not isinstance(remaining, int) or remaining < 2 or remaining > 170:
        return None
    return CHECKOUT.get(remaining)


def _glow_layers(accent_hex):
    """Return 5 hex colours from darkest-glow to brightest-glow for the score canvas.
    Scales the accent colour from ~27 % to 100 % brightness so the effect looks right
    regardless of which theme is active (red, blue, green, purple, etc.)."""
    h = accent_hex.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return [
        '#{:02X}{:02X}{:02X}'.format(max(1, int(r * s)), max(1, int(g * s)), max(1, int(b * s)))
        for s in (0.27, 0.44, 0.67, 0.83, 1.0)
    ]


def parse_cricket_darts(text):
    words = text.lower().replace('-', ' ').split()
    darts, mod = [], 's'
    for w in words:
        # shorthand like t20, d18, s15
        sh = _SHORTHAND_RE.match(w)
        if sh:
            m = {'s':'s','d':'d','t':'t'}[sh.group(1)]
            tgt = _SHORTHAND_TARGETS.get(sh.group(2))
            if tgt:
                darts.append((tgt, ('s' if tgt == 'b' and m == 't' else m)))
                continue
        if w in _CRICKET_MODS: mod = _CRICKET_MODS[w]
        elif w in _CRICKET_TARGETS:
            tgt = _CRICKET_TARGETS[w]
            darts.append(('miss', 'none') if tgt == 'miss' else (tgt, ('s' if tgt == 'b' and mod == 't' else mod)))
            mod = 's'
    return darts[:3]

# ─────────────────────────────────────────────────────────────────────────────
# Automation
# ─────────────────────────────────────────────────────────────────────────────
def enter_score(score, input_box, speed):
    with _score_lock:
        cfg = {'Lightning':(0.01,0.01,0.2),'Fast':(0.02,0.02,0.3),'Normal':(0.05,0.05,0.5),'Slow':(0.1,0.1,0.8)}.get(speed,(0.02,0.02,0.3))
        pyautogui.PAUSE = cfg[0]
        pyautogui.click(input_box['x'], input_box['y'], clicks=3, interval=cfg[1])
        pyautogui.write(str(score)); pyautogui.press('enter')
        time.sleep(cfg[1]); pyautogui.press('enter')

def enter_cricket_score(darts, grid, speed, cfg=None):
    with _score_lock:
        if cfg is None: cfg = {}
        pause = {'Lightning':0.08,'Fast':0.12,'Normal':0.20,'Slow':0.35}.get(speed,0.12)
        pyautogui.PAUSE = pause
        if not grid or not all(k in grid for k in ('s20','t15','submit')): return
        s20, t15, submit = grid['s20'], grid['t15'], grid['submit']
        # Grid offset fine-tuning
        off_x = cfg.get('cricket_offset_x', 0)
        off_y = cfg.get('cricket_offset_y', 0)
        extra_delay = cfg.get('cricket_click_delay', 0) / 1000.0  # ms → s
        include_bull = cfg.get('cricket_include_bull', True)
        dx = (t15['x'] - s20['x']) / 2.0
        dy = (t15['y'] - s20['y']) / 5.0  # always 5 gaps (rows 20→15)
        row = {'20':0,'19':1,'18':2,'17':3,'16':4,'15':5}
        if include_bull:
            row['b'] = 6
        col = {'s':0,'d':1,'t':2}
        for tgt, mod in darts:
            if tgt == 'miss': continue
            if tgt not in row: continue  # skip bull if grid has no bull row
            cx = s20['x'] + col[mod]*dx + off_x
            cy = s20['y'] + row[tgt]*dy + off_y
            pyautogui.click(cx, cy)
            time.sleep(0.5 + extra_delay)
        # Auto-submit
        if cfg.get('cricket_auto_submit', True):
            time.sleep(0.25)
            pyautogui.click(submit['x'], submit['y'])
            time.sleep(0.3)

# ─────────────────────────────────────────────────────────────────────────────
# Calibration overlays
# ─────────────────────────────────────────────────────────────────────────────
class X01CalibrationWizard(tk.Toplevel):
    def __init__(self, parent, on_complete):
        super().__init__(parent)
        self.attributes('-fullscreen', True); self.attributes('-alpha', 0.55); self.attributes('-topmost', True)
        self.configure(bg='black', cursor='crosshair')
        self._cb = on_complete
        tk.Label(self, text="Click the X01 score input box\n\nPress  ESC  to cancel",
                 font=("Uber Move Bold", 26, "bold"), fg='#ffffff', bg='black', justify='center'
                 ).place(relx=0.5, rely=0.3, anchor='center')
        self.bind('<Button-1>', self._click); self.bind('<Escape>', lambda e: self.destroy())

    def _click(self, e):
        self.destroy(); self._cb({'x': e.x_root, 'y': e.y_root})

class CricketCalibrationWizard(tk.Toplevel):
    def __init__(self, parent, on_complete):
        super().__init__(parent)
        self.attributes('-fullscreen', True); self.attributes('-alpha', 0.55); self.attributes('-topmost', True)
        self.configure(bg='black', cursor='crosshair')
        self._cb = on_complete; self.step = 0; self.coords = {}
        self._prompts = [
            "Step 1 of 3\n\nClick  SINGLE 20  — top-left of the grid\n\nPress  ESC  to cancel",
            "Step 2 of 3\n\nClick  TREBLE 15  — bottom-right of numbers\n\nPress  ESC  to cancel",
            "Step 3 of 3\n\nClick the  SUBMIT  button\n\nPress  ESC  to cancel",
        ]
        self._lbl = tk.Label(self, text=self._prompts[0],
                             font=("Uber Move Bold", 26, "bold"), fg='#ffffff', bg='black', justify='center')
        self._lbl.place(relx=0.5, rely=0.3, anchor='center')
        self.bind('<Button-1>', self._click); self.bind('<Escape>', lambda e: self.destroy())

    def _click(self, e):
        keys = ['s20', 't15', 'submit']
        self.coords[keys[self.step]] = {'x': e.x_root, 'y': e.y_root}
        self.step += 1
        if self.step == 3:
            self.destroy(); self._cb(self.coords)
        else:
            self._lbl.config(text=self._prompts[self.step])

# ─────────────────────────────────────────────────────────────────────────────
# Board geometry helper
# ─────────────────────────────────────────────────────────────────────────────
_BOARD_SEGS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

def _pos_to_score(dx, dy, dist, radius, rot_deg=0):
    """Map board-relative coords to a dart score.
    dx/dy from board centre; radius = outer double ring radius.
    rot_deg = clockwise rotation of the board in the video frame
              (measured as the angle from centre to the 20-top click)."""
    if radius <= 0: return None
    n = dist / radius
    if n > 1.0:    return 0   # outside board
    if n < 0.037:  return 50  # bull
    if n < 0.094:  return 25  # bull25
    # atan2(dx, -dy) → 0 = straight up, clockwise positive
    # subtract rot_deg so the user's clicked 20-top becomes angle 0
    ang = (math.degrees(math.atan2(dx, -dy)) - rot_deg + 360 + 9) % 360
    seg = _BOARD_SEGS[int(ang / 18) % 20]
    if 0.565 <= n <= 0.624: return seg * 3  # treble
    if 0.941 <= n <= 1.0:   return seg * 2  # double
    return seg


# ─────────────────────────────────────────────────────────────────────────────
# Screen region selector  (drag-to-draw transparent overlay)
# ─────────────────────────────────────────────────────────────────────────────
class ScreenRegionSelector(tk.Toplevel):
    """Fullscreen dim overlay — user drags to define a rectangle."""

    def __init__(self, parent, on_complete):
        super().__init__(parent)
        self.attributes('-fullscreen', True)
        self.attributes('-alpha', 0.45)
        self.attributes('-topmost', True)
        self.configure(bg='black', cursor='crosshair')
        self._cb    = on_complete
        self._start = None
        self._rid   = None

        self._cv = tk.Canvas(self, bg='black', highlightthickness=0, cursor='crosshair')
        self._cv.pack(fill='both', expand=True)
        self._hint = self._cv.create_text(
            0, 0,
            text="Drag to select the camera / board region\n\nPress  ESC  to cancel",
            font=("Uber Move Bold", 22, "bold"), fill='#ffffff', justify='center',
        )
        self._cv.bind('<Configure>',       lambda e: self._cv.coords(self._hint, e.width // 2, int(e.height * 0.12)))
        self._cv.bind('<ButtonPress-1>',   self._press)
        self._cv.bind('<B1-Motion>',       self._drag)
        self._cv.bind('<ButtonRelease-1>', self._release)
        self.bind('<Escape>', lambda e: self.destroy())

    def _press(self, e):
        self._start = (e.x, e.y)
        if self._rid: self._cv.delete(self._rid); self._rid = None

    def _drag(self, e):
        if not self._start: return
        x0, y0 = self._start
        if self._rid: self._cv.delete(self._rid)
        self._rid = self._cv.create_rectangle(
            x0, y0, e.x, e.y,
            outline='#ffffff', width=2, fill='#ffffff', stipple='gray12',
        )

    def _release(self, e):
        if not self._start: return
        x0, y0 = self._start; self._start = None
        w, h = abs(e.x - x0), abs(e.y - y0)
        if w < 20 or h < 20: return  # accidental click
        region = {
            'x': min(x0, e.x) + self.winfo_x(),
            'y': min(y0, e.y) + self.winfo_y(),
            'w': int(w), 'h': int(h),
        }
        self.destroy()
        self._cb(region)


# ─────────────────────────────────────────────────────────────────────────────
# Video board calibrator  (live preview of captured region + 2 clicks)
# ─────────────────────────────────────────────────────────────────────────────
class VideoBoardCalibrator(ctk.CTkToplevel):
    """Live preview of the screen region — 5-click calibration for full
    board geometry including perspective / ellipse distortion.

    Clicks:
        1. Bull (dead centre)
        2. Outer wire of D20  (12 o'clock — top)
        3. Outer wire of D6   ( 3 o'clock — right)
        4. Outer wire of D3   ( 6 o'clock — bottom)
        5. Outer wire of D11  ( 9 o'clock — left)

    Produces  {cx, cy, r_top, r_right, r_bottom, r_left, r_v, r_h, rot}.
    """

    _PROMPTS = [
        "Step 1 / 5 — Click the  BULL  (dead centre of the board)",
        "Step 2 / 5 — Click the  OUTER WIRE  at  DOUBLE 20\n"
        "(top of the board, 12 o'clock — where the outermost wire\n"
        "crosses the middle of the 20 segment)",
        "Step 3 / 5 — Click the  OUTER WIRE  at  DOUBLE 6\n"
        "(right side, 3 o'clock)",
        "Step 4 / 5 — Click the  OUTER WIRE  at  DOUBLE 3\n"
        "(bottom, 6 o'clock)",
        "Step 5 / 5 — Click the  OUTER WIRE  at  DOUBLE 11\n"
        "(left side, 9 o'clock)",
    ]
    _COLOURS = ['#ff4444', '#44ff44', '#4488ff', '#ffaa00', '#ff44ff']

    def __init__(self, parent, region, on_complete):
        super().__init__(parent)
        self._cb     = on_complete
        self._region = region
        self._step   = 0
        self._cal    = {}
        self._marks  = []
        self._live   = True

        rw, rh = region['w'], region['h']
        self.title("Calibrate Board — Video")
        self.geometry(f"{rw}x{rh + 100}")
        self.configure(fg_color=BG)
        self.attributes('-topmost', True)
        self.resizable(False, False)
        self.after(50, lambda: (self.lift(), self.focus_force()))

        self._cv = tk.Canvas(self, width=rw, height=rh,
                             bg='#111111', highlightthickness=0, cursor='crosshair')
        self._cv.pack()

        self._lbl = ctk.CTkLabel(
            self, text=self._PROMPTS[0], wraplength=rw - 30,
            font=("Uber Move Bold", 12, "bold"), text_color=FG,
        )
        self._lbl.pack(pady=(8, 0))
        ctk.CTkLabel(self, text="Press  ESC  to cancel",
                     font=("Rubik", 10), text_color=FG2).pack()

        self._cv.bind('<Button-1>', self._click)
        self.bind('<Escape>', lambda e: self.destroy())
        self._refresh()

    def _grab(self):
        try:
            from PIL import ImageGrab
            r = self._region
            return ImageGrab.grab(bbox=(r['x'], r['y'],
                                        r['x'] + r['w'], r['y'] + r['h']))
        except Exception:
            return None

    def _refresh(self):
        if not self.winfo_exists() or not self._live: return
        img = self._grab()
        if img:
            try:
                from PIL import ImageTk
                self._tkimg = ImageTk.PhotoImage(img)
                self._cv.create_image(0, 0, anchor='nw', image=self._tkimg)
            except Exception:
                pass
        cx = self._cal.get('cx'); cy = self._cal.get('cy')
        for mx, my, col in self._marks:
            self._cv.create_oval(mx-7, my-7, mx+7, my+7, outline=col, width=2)
            self._cv.create_line(mx-14, my, mx+14, my, fill=col, width=1)
            self._cv.create_line(mx, my-14, mx, my+14, fill=col, width=1)
        # Draw connecting line from centre to each perimeter click
        if cx is not None:
            for mx, my, col in self._marks[1:]:
                self._cv.create_line(cx, cy, mx, my, fill=col, width=1, dash=(4, 4))
        self.after(120, self._refresh)

    def _dist(self, x, y):
        dx = x - self._cal['cx']; dy = y - self._cal['cy']
        return math.sqrt(dx*dx + dy*dy)

    def _click(self, e):
        col = self._COLOURS[self._step]
        self._marks.append((e.x, e.y, col))

        if self._step == 0:
            self._cal['cx'] = e.x; self._cal['cy'] = e.y
        elif self._step == 1:  # D20 — top
            self._cal['r_top'] = self._dist(e.x, e.y)
            dx = e.x - self._cal['cx']; dy = e.y - self._cal['cy']
            self._cal['rot'] = math.degrees(math.atan2(dx, -dy))
        elif self._step == 2:  # D6 — right
            self._cal['r_right'] = self._dist(e.x, e.y)
        elif self._step == 3:  # D3 — bottom
            self._cal['r_bottom'] = self._dist(e.x, e.y)
        elif self._step == 4:  # D11 — left
            self._cal['r_left'] = self._dist(e.x, e.y)
            # Compute averaged vertical / horizontal radii
            self._cal['r_v'] = (self._cal['r_top'] + self._cal['r_bottom']) / 2
            self._cal['r_h'] = (self._cal['r_right'] + self._cal['r_left']) / 2
            self._live = False
            self.destroy()
            self._cb(self._cal); return

        self._step += 1
        self._lbl.configure(text=self._PROMPTS[self._step])


# ─────────────────────────────────────────────────────────────────────────────
# Video scorer thread
# ─────────────────────────────────────────────────────────────────────────────
class VideoScorerThread(threading.Thread):
    """Watches a screen region for darts landing one at a time.

    State machine:
      WATCHING → dart 1 lands (stable) → score it, snapshot
               → dart 2 lands (stable) → score it, snapshot
               → dart 3 lands (stable) → score it, submit total
               → wait for darts removed → reset → WATCHING

    Detection pipeline (per frame):
      1. RGB sum-of-channels diff (beats webcam compression noise)
      2. Density filter: remove isolated noise pixels
      3. Innermost 5 % of dense pixels → dart tip centroid
    """

    _INTERVAL   = 0.12   # seconds between captures
    _STABLE     = 4      # frames a new dart must be stable before scoring
    _TIP_SETTLE = 8.0    # px — max tip movement between frames = stable
    _RGB_THR    = 90     # sum-of-channels diff threshold (R+G+B)
    _MIN_PX     = 35     # min changed pixels to consider a new dart
    _CLEAR_THR  = 25     # max changed pixels vs clean baseline → removed
    _BLOCK      = 6      # density grid block size (px)
    _BLOCK_MIN  = 3      # min changed pixels per block to survive filter

    def __init__(self, region, cfg, on_score, on_status):
        super().__init__(daemon=True)
        self._region   = region
        self._cfg      = cfg
        self._on_score = on_score
        self._on_st    = on_status
        self._stop_ev  = threading.Event()
        self.debug_img = None      # latest annotated PIL Image (polled by UI)

    def stop(self): self._stop_ev.set()

    # ── helpers ───────────────────────────────────────────────────────────
    def _grab(self):
        try:
            from PIL import ImageGrab
            r = self._region
            return ImageGrab.grab(bbox=(r['x'], r['y'],
                                        r['x'] + r['w'], r['y'] + r['h']))
        except Exception:
            return None

    def _rgb_diff(self, img, ref):
        """Per-pixel sum of |R|+|G|+|B| differences. Returns (diff_2d, count)."""
        import numpy as np
        a = np.asarray(img, dtype=np.int16)   # (H, W, 3)
        b = np.asarray(ref, dtype=np.int16)
        d = np.sum(np.abs(a - b), axis=2)     # (H, W) range 0-765
        return d, int(np.count_nonzero(d > self._RGB_THR))

    def _density_filter(self, xs, ys, shape):
        """Remove isolated noise pixels — only keep those in dense blocks."""
        import numpy as np
        by, bx = ys // self._BLOCK, xs // self._BLOCK
        gh = shape[0] // self._BLOCK + 1
        gw = shape[1] // self._BLOCK + 1
        grid = np.zeros((gh, gw), dtype=np.int32)
        np.add.at(grid, (by, bx), 1)
        keep = grid[by, bx] >= self._BLOCK_MIN
        return xs[keep], ys[keep]

    # ── main loop ─────────────────────────────────────────────────────────
    def run(self):
        import numpy as np
        self._on_st("Video: initialising…")
        time.sleep(0.6)
        clean = self._grab()
        if clean is None:
            self._on_st("Video: capture failed — install Pillow"); return

        prev     = clean          # reference for detecting the *next* dart
        scores   = []             # individual dart scores this visit
        tips     = []             # tip coords for each scored dart (debug)
        stable   = 0
        last_tip = None
        self._on_st("Video: watching board…")

        while not self._stop_ev.is_set():
            time.sleep(self._INTERVAL)
            frame = self._grab()
            if frame is None: continue

            if len(scores) < 3:
                # ── looking for next dart ─────────────────────────────
                diff2d, new_px = self._rgb_diff(frame, prev)

                if new_px >= self._MIN_PX:
                    tip = self._find_tip(diff2d, frame)
                    if tip is None:
                        stable = 0; continue

                    if last_tip is not None:
                        d = math.sqrt((tip[0]-last_tip[0])**2 +
                                      (tip[1]-last_tip[1])**2)
                        if d < self._TIP_SETTLE:
                            stable += 1
                        else:
                            stable = 1
                    else:
                        stable = 1
                    last_tip = tip

                    if stable >= self._STABLE:
                        score = self._score_tip(tip)
                        if score is not None:
                            scores.append(score); tips.append(tip)
                            prev = frame
                            stable = 0; last_tip = None
                            running = " + ".join(str(s) for s in scores)
                            if len(scores) < 3:
                                self._on_st(
                                    f"Video: dart {len(scores)} → {score}  ({running})")
                            else:
                                total = sum(scores)
                                self._on_st(f"Video: {running} = {total}")
                                self._on_score(total)
                            self._make_debug(frame, tips, scores)
                        else:
                            self._on_st("Video: dart outside board?")
                            stable = 0; last_tip = None
                else:
                    stable = 0; last_tip = None

            else:
                # ── all 3 scored — wait for darts removed ─────────────
                _, total_diff = self._rgb_diff(frame, clean)
                if total_diff < self._CLEAR_THR:
                    clean = frame; prev = frame
                    scores = []; tips = []
                    stable = 0; last_tip = None
                    self.debug_img = None
                    self._on_st("Video: watching board…")

    # ── find tip of newest dart ──────────────────────────────────────────
    def _find_tip(self, diff2d, frame):
        """
        1. Threshold the RGB diff → changed pixels
        2. Density-filter scattered noise
        3. Take the innermost 5 % (closest to board centre) → centroid = tip
        """
        cal = self._cfg.get('video_board_cal', {})
        if not cal: return None
        try:
            import numpy as np
            ys, xs = np.where(diff2d > self._RGB_THR)
            if len(xs) < self._MIN_PX: return None

            # Density filter
            xs, ys = self._density_filter(xs, ys, diff2d.shape)
            if len(xs) < 10: return None

            # Innermost 5 % of dense pixels → tip region
            bcx, bcy = float(cal['cx']), float(cal['cy'])
            dists = (xs.astype(float) - bcx)**2 + (ys.astype(float) - bcy)**2
            n_tip = max(5, len(xs) // 20)
            idx   = np.argpartition(dists, n_tip)[:n_tip]
            return (float(np.mean(xs[idx])), float(np.mean(ys[idx])))
        except ImportError:
            return None

    # ── score a detected tip ─────────────────────────────────────────────
    def _score_tip(self, tip):
        cal = self._cfg.get('video_board_cal', {})
        if not cal: return None
        dx = tip[0] - cal['cx']
        dy = tip[1] - cal['cy']
        dist = math.sqrt(dx*dx + dy*dy)
        r = self._radius_at(cal, dx, dy)
        return _pos_to_score(dx, dy, dist, r, cal.get('rot', 0))

    @staticmethod
    def _radius_at(cal, dx, dy):
        """Effective outer-ring radius at the angle of (dx, dy),
        using the ellipse from the 4 perimeter calibration clicks."""
        r_v = cal.get('r_v')
        r_h = cal.get('r_h')
        if not r_v or not r_h:
            return cal.get('r', cal.get('r_top', 1))
        rot = math.radians(cal.get('rot', 0))
        ang = math.atan2(dx, -dy) - rot
        cos_a, sin_a = math.cos(ang), math.sin(ang)
        return (r_v * r_h) / math.sqrt((r_h * cos_a)**2 + (r_v * sin_a)**2)

    # ── debug overlay ────────────────────────────────────────────────────
    def _make_debug(self, frame, tips, scores):
        """Annotate a frame copy with board geometry + detected tips."""
        try:
            from PIL import ImageDraw, ImageFont
            cal = self._cfg.get('video_board_cal', {})
            if not cal: return
            img = frame.copy()
            draw = ImageDraw.Draw(img)
            cx, cy = int(cal['cx']), int(cal['cy'])

            # Board outline (ellipse)
            r_v = cal.get('r_v', cal.get('r_top', 100))
            r_h = cal.get('r_h', r_v)
            draw.ellipse((cx-int(r_h), cy-int(r_v),
                          cx+int(r_h), cy+int(r_v)),
                         outline='red', width=1)
            # Treble ring
            tv, th = int(r_v * 0.594), int(r_h * 0.594)
            draw.ellipse((cx-th, cy-tv, cx+th, cy+tv),
                         outline='yellow', width=1)
            # Bull rings
            bv1, bh1 = int(r_v * 0.094), int(r_h * 0.094)
            bv2, bh2 = int(r_v * 0.037), int(r_h * 0.037)
            draw.ellipse((cx-bh1, cy-bv1, cx+bh1, cy+bv1),
                         outline='cyan', width=1)
            draw.ellipse((cx-bh2, cy-bv2, cx+bh2, cy+bv2),
                         outline='cyan', width=1)
            # Centre cross
            draw.line((cx-12, cy, cx+12, cy), fill='red', width=1)
            draw.line((cx, cy-12, cx, cy+12), fill='red', width=1)

            # Detected tips
            for i, (t, s) in enumerate(zip(tips, scores)):
                tx, ty = int(t[0]), int(t[1])
                col = ['lime', '#00ccff', '#ff66ff'][i % 3]
                draw.ellipse((tx-6, ty-6, tx+6, ty+6), outline=col, width=2)
                draw.line((tx-10, ty, tx+10, ty), fill=col, width=1)
                draw.line((tx, ty-10, tx, ty+10), fill=col, width=1)
                draw.text((tx+10, ty-12), f"D{i+1}: {s}", fill=col)

            self.debug_img = img
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Screen recorder thread
# ─────────────────────────────────────────────────────────────────────────────
class _RecordThread(threading.Thread):
    """Captures a screen region and writes an MP4 using mss + opencv."""

    LOGO_TEXT = "● DARTVOICE"

    def __init__(self, region: dict, out_path: str, fps: int = 30, mic: bool = False):
        super().__init__(daemon=True)
        self.region   = region    # {'left','top','width','height'}
        self.out_path = out_path
        self.fps      = fps
        self.mic      = mic
        self._stop_evt = threading.Event()
        self._audio_frames = []

    def stop(self):
        self._stop_evt.set()

    def run(self):
        try:
            import mss
            import cv2
            import numpy as np
        except ImportError:
            return

        w, h = self.region['width'], self.region['height']
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        # Write video to a temp path; we'll mux audio in afterwards if needed
        vid_path = self.out_path if not self.mic else self.out_path + '_vid.mp4'
        writer = cv2.VideoWriter(vid_path, fourcc, self.fps, (w, h))

        # Pre-render watermark once
        _font      = cv2.FONT_HERSHEY_SIMPLEX
        _scale     = 0.45
        _thickness = 1
        (tw, th), _ = cv2.getTextSize(self.LOGO_TEXT, _font, _scale, _thickness)
        _wx = w - tw - 10
        _wy = h - 10
        _interval = 1.0 / self.fps

        # Start mic capture thread if requested
        _pa = _pa_stream = None
        _audio_frames = []
        _CHUNK = 1024; _RATE = 44100; _CHANNELS = 1
        if self.mic:
            try:
                import pyaudio as _pyaudio
                _pa = _pyaudio.PyAudio()
                _pa_stream = _pa.open(format=_pyaudio.paInt16,
                                      channels=_CHANNELS, rate=_RATE,
                                      input=True, frames_per_buffer=_CHUNK)
                def _audio_loop():
                    while not self._stop_evt.is_set():
                        try:
                            _audio_frames.append(_pa_stream.read(_CHUNK, exception_on_overflow=False))
                        except Exception:
                            break
                threading.Thread(target=_audio_loop, daemon=True).start()
            except Exception:
                _pa = None  # mic unavailable — record video only

        with mss.mss() as sct:
            while not self._stop_evt.is_set():
                t0 = time.time()
                img   = sct.grab(self.region)
                frame = cv2.cvtColor(np.array(img), cv2.COLOR_BGRA2BGR)
                # Watermark: shadow then white text
                cv2.putText(frame, self.LOGO_TEXT, (_wx+1, _wy+1),
                            _font, _scale, (0, 0, 0), _thickness+1, cv2.LINE_AA)
                cv2.putText(frame, self.LOGO_TEXT, (_wx, _wy),
                            _font, _scale, (220, 200, 255), _thickness, cv2.LINE_AA)
                writer.write(frame)
                elapsed = time.time() - t0
                leftover = _interval - elapsed
                if leftover > 0:
                    time.sleep(leftover)

        writer.release()

        # Mux audio if captured
        if _pa_stream:
            try:
                _pa_stream.stop_stream(); _pa_stream.close(); _pa.terminate()
            except Exception:
                pass
        if self.mic and _audio_frames:
            try:
                import wave as _wave, subprocess as _sp, os as _os
                wav_path = self.out_path + '_audio.wav'
                with _wave.open(wav_path, 'wb') as wf:
                    wf.setnchannels(_CHANNELS)
                    wf.setsampwidth(2)
                    wf.setframerate(_RATE)
                    wf.writeframes(b''.join(_audio_frames))
                # Mux with ffmpeg if available
                result = _sp.run(
                    ['ffmpeg', '-y', '-i', vid_path, '-i', wav_path,
                     '-c:v', 'copy', '-c:a', 'aac', '-shortest', self.out_path],
                    capture_output=True, timeout=60)
                if result.returncode == 0:
                    _os.remove(vid_path)
                    _os.remove(wav_path)
                else:
                    # ffmpeg failed — rename video as final output
                    _os.replace(vid_path, self.out_path)
                    _os.remove(wav_path)
            except Exception:
                import os as _os
                try: _os.replace(vid_path, self.out_path)
                except Exception: pass

# ─────────────────────────────────────────────────────────────────────────────
# Speech thread
# ─────────────────────────────────────────────────────────────────────────────
class SpeechListener(threading.Thread):
    def __init__(self, model_path, mic_index, cfg, on_score, on_status,
                 on_cancel=None, on_new_leg=None):
        super().__init__(daemon=True)
        self.model_path = model_path; self.mic_index = mic_index
        self.cfg = cfg; self.on_score = on_score; self.on_status = on_status
        self.on_cancel = on_cancel; self.on_new_leg = on_new_leg
        self._stop_evt = threading.Event()

    def stop(self): self._stop_evt.set()

    def run(self):
        try:
            import vosk, pyaudio
            model  = vosk.Model(self.model_path)
            rec    = vosk.KaldiRecognizer(model, 16000)
            pa     = pyaudio.PyAudio()
            stream = pa.open(format=pyaudio.paInt16, channels=1, rate=16000,
                             input=True, input_device_index=self.mic_index, frames_per_buffer=8000)
            stream.start_stream()
        except Exception as e:
            self.on_status(f"Mic error: {e}"); return

        self.on_status("Listening")
        while not self._stop_evt.is_set():
            try:
                data = stream.read(4000, exception_on_overflow=False)
                if rec.AcceptWaveform(data):
                    self._process(json.loads(rec.Result()).get('text', ''))
                else:
                    partial = json.loads(rec.PartialResult()).get('partial', '')
                    if self.cfg.get('require_trigger', True) and self.cfg.get('trigger','score').lower() in partial:
                        self.on_status("Trigger heard...")
            except Exception: continue
        stream.stop_stream(); stream.close(); pa.terminate()

    def _process(self, text):
        text = _fix_vosk(text)

        # ── Cancel word (no trigger required) ─────────────────────────────
        cancel = self.cfg.get('cancel_word', 'wait').lower().strip()
        if cancel and text == cancel:
            if self.on_cancel: self.on_cancel()
            self.on_status("Cancelled")
            return

        # ── New leg / new game (no trigger required) ───────────────────────
        if any(p in text for p in ('new leg', 'new game', 'next leg', 'reset leg',
                                   'reset game', 'restart leg')):
            if self.on_new_leg: self.on_new_leg()
            return

        # ── Trigger word ───────────────────────────────────────────────────
        trigger = self.cfg.get('trigger', 'score').lower()
        require = self.cfg.get('require_trigger', True)
        if require:
            if trigger not in text: return
            after = _fix_vosk(text.split(trigger, 1)[-1].strip())
        else:
            after = _fix_vosk(text.replace(trigger, '').strip())

        mode = self.cfg.get('game_mode', 'X01')

        # ── "enter" command ────────────────────────────────────────────────
        if after == 'enter' or text.strip() == 'enter':
            self.on_status("Enter pressed")
            if mode == 'Cricket':
                grid = self.cfg.get('cricket_grid', {})
                fn = (lambda: pyautogui.click(grid['submit']['x'], grid['submit']['y'])) if grid and 'submit' in grid else (lambda: pyautogui.press('enter'))
            elif self.cfg.get('per_dart_mode', False):
                # submit accumulated darts early (e.g. finished on a double with < 3 darts)
                fn = lambda: self.on_score(('dart_submit',))
            else:
                fn = lambda: pyautogui.press('enter')
            threading.Thread(target=fn, daemon=True).start()
            return

        # ── Cricket ────────────────────────────────────────────────────────
        if mode == 'Cricket':
            darts = parse_cricket_darts(after)
            if darts: self.on_score(darts); self.on_status("Darts sent")
            elif require: self.on_status(f"No match: {after}")
            return

        # ── X01 ────────────────────────────────────────────────────────────
        if self.cfg.get('per_dart_mode', False):
            dart = parse_single_dart(after)
            if dart is not None:
                self.on_score(('dart', dart[0], dart[1]))
                self.on_status(f"Dart: {dart[1]}")
            elif require:
                self.on_status(f"No match: {after}")
        else:
            score = parse_score(after)
            if score is not None and 0 <= score <= 180:
                self.on_score(score); self.on_status(f"Sent  {score}")
            elif require: self.on_status(f"No match: {after}")

# ─────────────────────────────────────────────────────────────────────────────
# Main app
# ─────────────────────────────────────────────────────────────────────────────
class DartVoiceApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("DartVoice")
        self.geometry("1024x600")
        self.configure(fg_color=BG)
        self.resizable(True, True)
        self.minsize(720, 480)

        # ── Borderless / Discord-style chrome ────────────────────────────────
        self.overrideredirect(True)
        # Keep Windows drop shadow + rounded corners (DWM)
        if sys.platform == 'win32':
            try:
                import ctypes
                HWND = int(self.wm_frame(), 16) if hasattr(self, 'wm_frame') else None
                # Use win32api via ctypes to set window style (shadow, no standard frame)
                GWL_STYLE   = -16
                WS_POPUP    = 0x80000000
                WS_VISIBLE  = 0x10000000
                WS_THICKFRAME = 0x00040000
                WS_MINIMIZEBOX = 0x00020000
                WS_MAXIMIZEBOX = 0x00010000
                self.update_idletasks()
                hwnd = ctypes.windll.user32.FindWindowW(None, "DartVoice")
                if hwnd:
                    style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_STYLE)
                    ctypes.windll.user32.SetWindowLongW(
                        hwnd, GWL_STYLE,
                        (style | WS_POPUP | WS_VISIBLE | WS_THICKFRAME
                               | WS_MINIMIZEBOX | WS_MAXIMIZEBOX) & ~0x00C00000)
                    # Add WS_EX_APPWINDOW so window always shows on taskbar
                    GWL_EXSTYLE      = -20
                    WS_EX_APPWINDOW  = 0x00040000
                    es = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
                    ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE,
                                                        es | WS_EX_APPWINDOW)
                    # Apply DWM shadow
                    DWMWA_NCRENDERING_POLICY = 2
                    ctypes.windll.dwmapi.DwmSetWindowAttribute(
                        hwnd, DWMWA_NCRENDERING_POLICY,
                        ctypes.byref(ctypes.c_int(2)), ctypes.sizeof(ctypes.c_int))
            except Exception:
                pass

        # ── Drag / resize state ───────────────────────────────────────────────
        self._drag_data = {'x': 0, 'y': 0, 'dragging': False}

        # Set a blank icon
        try:
            self.iconbitmap('')
        except Exception:
            pass

        self.cfg             = load_config()
        _apply_theme(self.cfg.get('theme', 'Littler'),
                     self.cfg.get('custom_accent', '#FFFFFF'))
        self._listener       = None
        self._video_scorer   = None
        self._active         = False
        self._score_str      = tk.StringVar(value="")
        self._avg_str        = tk.StringVar(value="—")
        self._darts_str      = tk.StringVar(value="0")
        self._status         = tk.StringVar(value="Ready")
        self._session_scores = []
        self._visit_history  = []
        # X01 game tracking
        self._x01_remaining  = None
        self._current_darts  = []
        self._remaining_str  = tk.StringVar(value="")
        self._checkout_str   = tk.StringVar(value="")

        self._tray = None
        self._cached_mic_list = None   # populated in background at startup
        self.protocol("WM_DELETE_WINDOW", self._hide_to_tray)
        if sys.platform == 'win32':
            self._setup_tray()

        self.attributes('-alpha',   self.cfg.get('ghost_opacity',  1.0))
        self.attributes('-topmost', self.cfg.get('always_on_top',  True))
        # Pre-scan mics in background so settings opens instantly
        threading.Thread(target=self._prefetch_mics, daemon=True).start()
        self._show_splash()

    def _show_splash(self):
        """Animated splash that dissolves into the main UI after ~1.4 s."""
        splash = tk.Frame(self, bg=BG)
        splash.place(x=0, y=0, relwidth=1, relheight=1)
        splash.lift()

        # Bullseye SVG-style canvas drawn with primitives
        c = tk.Canvas(splash, bg=BG, highlightthickness=0, width=80, height=80)
        c.place(relx=0.5, rely=0.42, anchor='center')
        _r = [36, 27, 18, 9]
        _cols = [SEP, SEP, ACCENT_DIM, ACCENT]
        for r2, col in zip(_r, _cols):
            c.create_oval(40-r2, 40-r2, 40+r2, 40+r2, outline=col, width=2)
        # Dart wire: diagonal line from upper-right
        c.create_line(60, 16, 40, 40, fill=FG, width=3, capstyle='round')
        c.create_oval(37, 37, 43, 43, fill=ACCENT, outline='')

        name_lbl = tk.Label(splash, text="DARTVOICE", bg=BG, fg=FG,
                            font=("Uber Move Bold", 22, "bold"))
        name_lbl.place(relx=0.5, rely=0.56, anchor='center')

        tag_lbl = tk.Label(splash, text="Voice-activated scoring", bg=BG, fg=FG2,
                           font=("Rubik", 10))
        tag_lbl.place(relx=0.5, rely=0.63, anchor='center')

        # Animated loading bar
        bar_bg = tk.Frame(splash, bg=SEP, height=2, width=160)
        bar_bg.place(relx=0.5, rely=0.72, anchor='center')
        bar_fill = tk.Frame(bar_bg, bg=ACCENT, height=2, width=0)
        bar_fill.place(x=0, y=0)

        def _animate_bar(step=0):
            if step > 40:
                self._build_ui()
                splash.destroy()
                self._pulse()
                self.after(100, self._billing_gate)
                return
            bar_fill.config(width=int(160 * step / 40))
            self.after(28, lambda: _animate_bar(step + 1))

        self.after(120, lambda: _animate_bar(0))

    # ── Billing gate (called 200ms after launch) ──────────────────────────────
    def _billing_gate(self):
        try:
            from billing import billing_status, check_subscription_async
        except ImportError:
            return

        bs = billing_status()
        check_subscription_async(self._on_billing_checked)

        # Admin bypass — skip all access checks
        if bs.get('admin'):
            self._status.set("Admin mode — full access")
            return

        if bs['subscribed']:
            email = bs['account']['email'] if bs.get('account') else ''
            label = f"Member  ·  {email}" if email else "Member"
            self._status.set(label)
            return

        if bs['demo_active']:
            secs = int(bs['demo_secs'])
            mins, s = divmod(secs, 60)
            self._status.set(f"Free demo  ·  {mins}:{s:02d} remaining")
            # Schedule paywall for when demo expires
            self.after(secs * 1000, self._show_paywall)
            return

        self._show_paywall()

    def _on_billing_checked(self, subscribed: bool, account):
        if subscribed:
            email = account['email'] if account else ''
            msg   = f"Member  ·  {email}" if email else "Member"
            self.after(0, lambda: self._status.set(msg))
            if hasattr(self, '_paywall') and self._paywall.winfo_exists():
                self.after(0, self._paywall.destroy)
            return
        try:
            from billing import billing_status
        except ImportError:
            return
        if billing_status()['locked']:
            self.after(0, self._show_paywall)

    # ── Account dialog (sign in / sign out from Settings) ────────────────────
    def _open_account_dialog(self):
        try:
            from billing import get_account, send_otp, verify_otp, sign_out, \
                                 billing_status, check_subscription_async
        except ImportError:
            return

        if hasattr(self, '_acct_overlay') and self._acct_overlay.winfo_exists():
            self._acct_overlay.lift(); return

        import webbrowser

        # ── Full-window dim overlay ───────────────────────────────────────
        ov = tk.Frame(self, bg='#05050A')
        ov.place(x=0, y=0, relwidth=1.0, relheight=1.0)
        ov.lift()
        self._acct_overlay = ov
        ov.update_idletasks()   # paint dim before network fetch

        def _close(refocus=True):
            ov.destroy()
            if hasattr(self, '_acct_overlay'):
                del self._acct_overlay
            if refocus:
                self.focus_force()

        ov.bind('<Button-1>', lambda e: _close() if e.widget is ov else None)
        self.bind('<Escape>', lambda e: _close())

        # ── Centered modal card ───────────────────────────────────────────
        modal = ctk.CTkFrame(ov, fg_color=CARD, corner_radius=18,
                             border_width=1, border_color=SEP,
                             width=400, height=520)
        modal.pack_propagate(False)
        modal.place(relx=0.5, rely=0.5, anchor='center')

        # Accent top bar
        ctk.CTkFrame(modal, fg_color=ACCENT, height=3, corner_radius=0,
                     ).pack(fill='x')

        # Header row
        hdr = ctk.CTkFrame(modal, fg_color='transparent', height=52)
        hdr.pack(fill='x', padx=20, pady=(10, 0))
        hdr.pack_propagate(False)
        lc = tk.Canvas(hdr, width=22, height=22, bg=CARD, highlightthickness=0)
        lc.place(x=0, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 11, 11, [9, 6, 3, 1])
        ctk.CTkLabel(hdr, text="  ACCOUNT", text_color=FG,
                     font=("Uber Move Bold", 15, "bold")).place(x=28, rely=0.5, anchor='w')
        close_btn = ctk.CTkButton(hdr, text="✕", width=28, height=28,
                                  fg_color='transparent', hover_color=CARD2,
                                  text_color=FG2, font=("Rubik", 12),
                                  corner_radius=6, command=_close)
        close_btn.place(relx=1.0, rely=0.5, anchor='e')

        ctk.CTkFrame(modal, fg_color=SEP, height=1).pack(fill='x', pady=(8, 0))

        body = ctk.CTkFrame(modal, fg_color='transparent')
        body.pack(fill='both', expand=True, padx=28, pady=20)

        # ── Show skeleton immediately; load account data in background ──────
        _load_lbl = ctk.CTkLabel(body, text="Loading…", text_color=FG2,
                                 font=("Rubik", 11))
        _load_lbl.pack(pady=30)

        def _populate_body(account, bs):
            if not body.winfo_exists(): return
            _load_lbl.destroy()

            if account:
                # ── Signed-in view ────────────────────────────────────────
                av_row = ctk.CTkFrame(body, fg_color='transparent')
                av_row.pack(anchor='w', pady=(0, 16))

                av_canvas = tk.Canvas(av_row, width=42, height=42, bg=CARD, highlightthickness=0)
                av_canvas.pack(side='left', padx=(0, 12))
                av_canvas.create_oval(2, 2, 40, 40, fill=CARD2, outline=SEP, width=1)
                av_canvas.create_text(21, 21, text=account['email'][0].upper(),
                                      fill=FG, font=("Uber Move Bold", 16, "bold"))

                txt_col = ctk.CTkFrame(av_row, fg_color='transparent')
                txt_col.pack(side='left')
                ctk.CTkLabel(txt_col, text=account['email'], text_color=FG,
                             font=("Uber Move Bold", 12, "bold")).pack(anchor='w')

                if bs['subscribed']:
                    badge_text, badge_fg, badge_bg = "● MEMBER", '#22CC66', '#0A1F0E'
                elif bs.get('admin'):
                    badge_text, badge_fg, badge_bg = "● ADMIN", ACCENT, '#1A0608'
                elif bs['demo_active']:
                    badge_text, badge_fg, badge_bg = "● DEMO ACTIVE", '#D4A017', '#1A1606'
                else:
                    badge_text, badge_fg, badge_bg = "● INACTIVE", FG2, CARD2
                ctk.CTkLabel(txt_col, text=badge_text, text_color=badge_fg,
                             font=("Rubik", 9, "bold"),
                             fg_color=badge_bg, corner_radius=6,
                             ).pack(anchor='w', ipadx=7, ipady=3, pady=(3, 0))

                ctk.CTkFrame(body, fg_color=SEP, height=1).pack(fill='x', pady=(0, 14))

                if not bs['subscribed']:
                    ctk.CTkButton(
                        body, text="START 7-DAY FREE TRIAL  →  £6.99/mo",
                        font=("Uber Move Bold", 13, "bold"),
                        fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
                        height=50, corner_radius=12,
                        command=lambda: webbrowser.open('https://dartvoice.com'),
                    ).pack(fill='x', pady=(0, 8))

                    def _refresh_status():
                        check_subscription_async(self._on_billing_checked)
                        self._status.set("Checking subscription…")
                        _close(refocus=False)

                    ctk.CTkButton(
                        body, text="I just subscribed — refresh",
                        font=("Rubik", 10), fg_color=CARD2, hover_color=SEP,
                        text_color=FG2, height=36, corner_radius=8,
                        command=_refresh_status,
                    ).pack(fill='x', pady=(0, 8))

                ctk.CTkButton(
                    body, text="Manage subscription / billing  ↗",
                    font=("Rubik", 11), fg_color=CARD2, hover_color=SEP,
                    text_color=FG2, height=42, corner_radius=10,
                    command=lambda: webbrowser.open(
                        f"{os.environ.get('DV_BILLING_URL','https://billing.dartvoice.com')}"
                        f"/portal?user_id={account['user_id']}"
                    ),
                ).pack(fill='x', pady=(0, 8))

                def _do_signout():
                    sign_out()
                    _close(refocus=False)
                    self._status.set("Signed out")

                ctk.CTkButton(
                    body, text="Sign out",
                    font=("Rubik", 11), fg_color='transparent', hover_color=CARD2,
                    text_color=FG2, height=36, corner_radius=8,
                    border_width=1, border_color=SEP,
                    command=_do_signout,
                ).pack(fill='x')

            else:
                # ── Sign-in view — two-step: email → OTP ─────────────────
                email_var = tk.StringVar()
                code_var  = tk.StringVar()
                msg_var   = tk.StringVar()

                ctk.CTkLabel(body, text="Welcome to DartVoice",
                             text_color=FG, font=("Uber Move Bold", 17, "bold"),
                             ).pack(anchor='w', pady=(0, 4))
                ctk.CTkLabel(body, text="Sign in or create an account to continue.",
                             text_color=FG2, font=("Rubik", 10),
                             ).pack(anchor='w', pady=(0, 18))

                step1 = ctk.CTkFrame(body, fg_color='transparent')
                step1.pack(fill='x')
                ctk.CTkLabel(step1, text="EMAIL ADDRESS", text_color=FG2,
                             font=("Rubik", 8, "bold")).pack(anchor='w', pady=(0, 4))
                email_entry = ctk.CTkEntry(
                    step1, textvariable=email_var,
                    placeholder_text="your@email.com",
                    font=("Rubik", 13), height=50, corner_radius=12,
                    border_color=SEP, border_width=1,
                    fg_color=BG, text_color=FG,
                    placeholder_text_color=FG2,
                )
                email_entry.pack(fill='x', pady=(0, 12))
                email_entry.focus()
                send_btn = ctk.CTkButton(
                    step1, text="CONTINUE  →",
                    font=("Uber Move Bold", 13, "bold"),
                    fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
                    height=50, corner_radius=12,
                )
                send_btn.pack(fill='x')

                step2 = ctk.CTkFrame(body, fg_color='transparent')
                confirm_lbl = ctk.CTkLabel(step2, text="", text_color=FG2,
                                           font=("Rubik", 10), wraplength=320, justify='left')
                confirm_lbl.pack(anchor='w', pady=(0, 12))
                ctk.CTkLabel(step2, text="MAGIC CODE", text_color=FG2,
                             font=("Rubik", 8, "bold")).pack(anchor='w', pady=(0, 4))
                code_entry = ctk.CTkEntry(
                    step2, textvariable=code_var,
                    placeholder_text="0 0 0 0 0 0",
                    font=("Courier New", 30, "bold"),
                    height=64, corner_radius=12,
                    border_color=ACCENT, border_width=2,
                    fg_color=BG, text_color=FG,
                    justify='center',
                )
                code_entry.pack(fill='x', pady=(0, 12))
                verify_btn = ctk.CTkButton(
                    step2, text="VERIFY CODE  →",
                    font=("Uber Move Bold", 13, "bold"),
                    fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
                    height=50, corner_radius=12,
                )
                verify_btn.pack(fill='x', pady=(0, 8))
                back_btn = ctk.CTkButton(
                    step2, text="← Use a different email",
                    font=("Rubik", 10), fg_color='transparent',
                    hover_color=CARD2, text_color=FG2,
                    height=30, corner_radius=8,
                )
                back_btn.pack()

                msg_lbl = ctk.CTkLabel(body, textvariable=msg_var,
                                       text_color='#FF5555', font=("Rubik", 10),
                                       wraplength=320)
                msg_lbl.pack(pady=(10, 0))

                def _go_step1():
                    step2.pack_forget(); step1.pack(fill='x')
                    msg_var.set(''); email_entry.focus()

                def _send():
                    email = email_var.get().strip()
                    if not email or '@' not in email:
                        msg_var.set("Please enter a valid email address."); return
                    send_btn.configure(state='disabled', text='Sending…')
                    msg_var.set('')
                    def _do():
                        ok, err = send_otp(email)
                        def _ui():
                            send_btn.configure(state='normal', text='Resend code →')
                            if ok:
                                msg_var.set('')
                                confirm_lbl.configure(
                                    text=f"Code sent to {email}\nEnter it below — expires in 10 minutes.")
                                step1.pack_forget(); step2.pack(fill='x'); code_entry.focus()
                            else:
                                msg_var.set(f"Error: {err}")
                        self.after(0, _ui)
                    threading.Thread(target=_do, daemon=True).start()

                def _verify():
                    email = email_var.get().strip()
                    code  = code_var.get().strip()
                    if not code:
                        msg_var.set("Enter the 6-digit code from your email."); return
                    verify_btn.configure(state='disabled', text='Verifying…')
                    msg_var.set('')
                    def _do():
                        ok, _ = verify_otp(email, code)
                        def _ui():
                            verify_btn.configure(state='normal', text='VERIFY CODE  →')
                            if ok:
                                _close(refocus=False); self._billing_gate()
                            else:
                                msg_var.set("Invalid code — try again or resend.")
                                code_var.set('')
                        self.after(0, _ui)
                    threading.Thread(target=_do, daemon=True).start()

                send_btn.configure(command=_send)
                verify_btn.configure(command=_verify)
                back_btn.configure(command=_go_step1)
                email_entry.bind('<Return>', lambda e: _send())
                code_entry.bind('<Return>',  lambda e: _verify())

        def _fetch():
            try:
                _acct = get_account()
                _bs   = billing_status() if _acct else None
            except Exception:
                _acct = None; _bs = None
            self.after(0, lambda: _populate_body(_acct, _bs))

        threading.Thread(target=_fetch, daemon=True).start()

    # ── Paywall (trial expired, not signed in / not subscribed) ──────────────
    def _show_paywall(self):
        if hasattr(self, '_paywall') and self._paywall.winfo_exists():
            self._paywall.lift(); return

        import webbrowser
        try:
            from billing import get_account, get_checkout_url
        except ImportError:
            get_account = lambda: None
            get_checkout_url = lambda: ''

        # ── Full-screen overlay on top of the main window ─────────────────
        win = ctk.CTkToplevel(self)
        self._paywall = win
        win.title("DartVoice")
        # Match main window size/position exactly
        self.update_idletasks()
        x, y = self.winfo_x(), self.winfo_y()
        w, h = self.winfo_width(), self.winfo_height()
        win.geometry(f"{w}x{h}+{x}+{y}")
        win.configure(fg_color='#0A0204')
        win.resizable(False, False)
        win.attributes('-topmost', True)
        win.protocol("WM_DELETE_WINDOW", lambda: None)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        # ── Blurred/dark background canvas ────────────────────────────────
        bg_c = tk.Canvas(win, bg='#0A0204', highlightthickness=0)
        bg_c.place(x=0, y=0, relwidth=1, relheight=1)

        def _draw_blur_bg(c, cw, ch):
            c.delete('all')
            # Dark radial glow from centre (simulated blur)
            cx, cy = cw // 2, ch // 2
            for r, col in [(600,'#1A0305'),(450,'#160204'),(300,'#120103'),(150,'#0E0102')]:
                c.create_oval(cx-r, cy-r, cx+r, cy+r, outline='', fill=col)
            # Subtle grid
            for gx in range(0, cw + 40, 40):
                c.create_line(gx, 0, gx, ch, fill='#150103', width=1)
            for gy in range(0, ch + 40, 40):
                c.create_line(0, gy, cw, gy, fill='#150103', width=1)

        bg_c.bind('<Configure>', lambda e: _draw_blur_bg(bg_c, e.width, e.height))

        # ── Card — centred ────────────────────────────────────────────────
        card_wrap = ctk.CTkFrame(win, fg_color='transparent')
        card_wrap.place(relx=0.5, rely=0.5, anchor='center')

        card = ctk.CTkFrame(
            card_wrap, fg_color=CARD,
            corner_radius=24,
            border_width=2, border_color=ACCENT,
        )
        card.pack(ipadx=2, ipady=2)
        card.configure(width=400)

        inner = ctk.CTkFrame(card, fg_color='transparent')
        inner.pack(padx=36, pady=32)

        # Lock icon circle
        icon_frame = ctk.CTkFrame(inner, fg_color=ACCENT, corner_radius=999,
                                   width=72, height=72)
        icon_frame.pack(pady=(0, 20))
        icon_frame.pack_propagate(False)
        icon_c = tk.Canvas(icon_frame, width=72, height=72,
                           bg=ACCENT, highlightthickness=0)
        icon_c.place(relx=0.5, rely=0.5, anchor='center')
        # Lock SVG as canvas shapes
        def _draw_lock(c):
            cx, cy = 36, 38
            # shackle
            c.create_arc(24, 14, 48, 38, start=0, extent=180,
                         outline='white', width=3, style='arc')
            # body
            c.create_rectangle(18, 36, 54, 58, fill='white', outline='')
            # keyhole
            c.create_oval(32, 42, 40, 50, fill=ACCENT, outline='')
            c.create_rectangle(34, 47, 38, 54, fill=ACCENT, outline='')
        _draw_lock(icon_c)

        # Heading
        ctk.CTkLabel(inner, text="Free Preview Ended.",
                     text_color=FG, font=("Uber Move Bold", 22, "bold"),
                     justify='center').pack()

        # Body copy
        ctk.CTkLabel(
            inner,
            text="Hope you enjoyed the warm-up.\nStart your 7-Day Free Trial to keep scoring.\nAuto-bills £6.99/mo after trial. Cancel anytime.",
            text_color=FG2, font=("Rubik", 10),
            justify='center', wraplength=320,
        ).pack(pady=(8, 24))

        # Primary CTA
        def _start_trial():
            acct = get_account()
            if acct:
                webbrowser.open(get_checkout_url())
            else:
                win.withdraw()
                self._open_account_dialog()

        ctk.CTkButton(
            inner, text="Start 7-Day Free Trial",
            font=("Uber Move Bold", 14, "bold"),
            fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
            height=52, corner_radius=12,
            command=_start_trial,
        ).pack(fill='x', pady=(0, 10))

        # Secondary CTA
        def _sign_in():
            win.withdraw()
            self._open_account_dialog()

        ctk.CTkButton(
            inner, text="I've already subscribed — Sign In",
            font=("Rubik", 11), fg_color=CARD2,
            hover_color=SEP, text_color=FG,
            border_width=1, border_color=SEP,
            height=46, corner_radius=12,
            command=_sign_in,
        ).pack(fill='x', pady=(0, 12))

        # Security note
        sec_row = ctk.CTkFrame(inner, fg_color='transparent')
        sec_row.pack()
        ctk.CTkLabel(sec_row, text="🔒", font=("Rubik", 9),
                     text_color=FG3).pack(side='left', padx=(0, 4))
        ctk.CTkLabel(sec_row, text="Secured via Stripe & Supabase",
                     font=("Rubik", 9), text_color=FG3).pack(side='left')

    # ── System tray (Windows background) ─────────────────────────────────────
    def _make_tray_icon(self):
        from PIL import Image, ImageDraw
        size = 64
        img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx = cy = size // 2
        for r, fill in [(30, ACCENT), (22, BG), (15, ACCENT), (8, BG), (4, ACCENT)]:
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)
        return img

    def _setup_tray(self):
        try:
            import pystray
        except ImportError:
            return
        icon_img = self._make_tray_icon()

        def _show():
            self.after(0, self._show_from_tray)

        def _toggle_listen():
            self.after(0, self._toggle)

        def _quit():
            self.after(0, self._quit_app)

        menu = pystray.Menu(
            pystray.MenuItem('Show DartVoice', _show, default=True),
            pystray.MenuItem('Start / Stop Listening', _toggle_listen),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Quit', _quit),
        )
        self._tray = pystray.Icon('DartVoice', icon_img, 'DartVoice', menu)
        threading.Thread(target=self._tray.run, daemon=True).start()

    def _hide_to_tray(self):
        self._tray_geo = self.geometry()   # remember position
        self.withdraw()

    def _show_from_tray(self):
        # overrideredirect windows need withdraw+deiconify+geometry restore
        self.withdraw()
        self.update_idletasks()
        if hasattr(self, '_tray_geo') and self._tray_geo:
            self.geometry(self._tray_geo)
        self.deiconify()
        self.update_idletasks()
        self.lift()
        self.focus_force()

    def _quit_app(self):
        if self._listener:
            self._listener.stop()
        if self._video_scorer:
            self._video_scorer.stop()
        if self._tray:
            self._tray.stop()
        self.destroy()

    def _prefetch_mics(self):
        """Scan audio devices once at startup so settings opens instantly."""
        try:
            import pyaudio as _pa
            pa = _pa.PyAudio()
            labels = ['Default']
            idx_map = {0: None}
            for i in range(pa.get_device_count()):
                inf = pa.get_device_info_by_index(i)
                if inf.get('maxInputChannels', 0) < 1:
                    continue
                raw = inf['name']
                try: raw = raw.encode('latin-1').decode('utf-8')
                except Exception: pass
                label = raw[:38]
                labels.append(label)
                idx_map[len(labels) - 1] = i
            pa.terminate()
            self._cached_mic_list = (labels, idx_map)
        except Exception:
            self._cached_mic_list = (['Default'], {0: None})

    # ── Build UI ─────────────────────────────────────────────────────────────
    def _build_ui(self):
        self._build_content()

    def _rebuild_ui(self):
        """Tear down and rebuild the entire UI (used after theme change)."""
        for w in self.winfo_children():
            w.destroy()
        self._build_content()
        self._redraw_score()

    def _build_content(self):
        # ── Background wire canvas ────────────────────────────────────────
        self.bg_canvas = tk.Canvas(self, bg=BG, highlightthickness=0)
        self.bg_canvas.place(x=0, y=0, relwidth=1, relheight=1)
        self._wire_redraw_job = None
        def _debounced_wire(e):
            if self._wire_redraw_job:
                self.after_cancel(self._wire_redraw_job)
            self._wire_redraw_job = self.after(120, lambda: (
                self.bg_canvas.delete('all'),
                self._draw_dartboard_wire(self.bg_canvas, e.width, e.height),
            ))
        self.bg_canvas.bind('<Configure>', _debounced_wire)

        # ── Custom borderless titlebar ────────────────────────────────────
        titlebar = tk.Frame(self, bg=CARD, height=48)
        titlebar.pack(fill='x')
        titlebar.pack_propagate(False)

        # Thin accent strip at very top
        acc_strip = tk.Frame(titlebar, bg=ACCENT, height=3)
        acc_strip.pack(fill='x', side='top')

        tb_inner = tk.Frame(titlebar, bg=CARD)
        tb_inner.pack(fill='both', expand=True)

        # Drag via native Win32 WM_NCLBUTTONDOWN — OS handles the move at
        # compositor level, no Python geometry() calls per pixel, buttery smooth.
        def _tb_drag_start(e):
            try:
                import ctypes
                hwnd = ctypes.windll.user32.GetParent(self.winfo_id()) or self.winfo_id()
                ctypes.windll.user32.ReleaseCapture()
                ctypes.windll.user32.PostMessageW(hwnd, 0xA1, 0x2, 0)
                # 0xA1 = WM_NCLBUTTONDOWN, 0x2 = HTCAPTION
            except Exception:
                # Fallback for non-Windows / ctypes failure
                self._drag_data['x'] = e.x_root - self.winfo_x()
                self._drag_data['y'] = e.y_root - self.winfo_y()
                self._drag_data['dragging'] = True
        def _tb_drag_move(e):
            if self._drag_data.get('dragging'):
                self.geometry(f"+{e.x_root - self._drag_data['x']}+{e.y_root - self._drag_data['y']}")
        def _tb_drag_stop(e):
            self._drag_data['dragging'] = False
        for _w in (titlebar, tb_inner, acc_strip):
            _w.bind('<ButtonPress-1>',   _tb_drag_start)
            _w.bind('<B1-Motion>',       _tb_drag_move)
            _w.bind('<ButtonRelease-1>', _tb_drag_stop)
        # Double-click titlebar to maximise / restore
        def _tb_dblclick(e):
            if self.winfo_width() >= self.winfo_screenwidth() - 10:
                self.geometry("1024x600")
            else:
                self.geometry(f"{self.winfo_screenwidth()}x{self.winfo_screenheight()}+0+0")
        titlebar.bind('<Double-Button-1>', _tb_dblclick)

        # Logo (bullseye canvas)
        lc = tk.Canvas(tb_inner, width=22, height=22, bg=CARD, highlightthickness=0)
        lc.place(x=16, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 11, 11, [9, 6, 3, 1])
        lc.bind('<ButtonPress-1>', _tb_drag_start)

        tb_title = tk.Label(tb_inner, text="  DARTVOICE", bg=CARD, fg=FG,
                            font=("Uber Move Bold", 15, "bold"))
        tb_title.place(x=44, rely=0.5, anchor='w')
        tb_title.bind('<ButtonPress-1>', _tb_drag_start)

        # Compat badges centred
        compat_f = ctk.CTkFrame(tb_inner, fg_color='transparent')
        compat_f.place(relx=0.5, rely=0.5, anchor='center')
        for badge_text in ["Target Dartcounter", "X01", "Cricket", "121"]:
            ctk.CTkLabel(compat_f, text=badge_text, text_color=FG2,
                         font=("Rubik", 8, "bold"), fg_color=CARD2, corner_radius=5,
                         ).pack(side='left', padx=2, ipadx=5, ipady=2)

        # Right side: app controls + window controls
        nav_r = ctk.CTkFrame(tb_inner, fg_color='transparent')
        nav_r.place(relx=1.0, x=-8, rely=0.5, anchor='e')

        # Window controls: close / max / min
        def _win_btn(parent, symbol, bg_hover, cmd):
            b = tk.Label(parent, text=symbol, bg=CARD, fg=FG2,
                         font=("Rubik", 11), padx=10, pady=4, cursor='hand2')
            b.pack(side='right')
            b.bind('<Enter>', lambda e: b.config(bg=bg_hover, fg=FG))
            b.bind('<Leave>', lambda e: b.config(bg=CARD, fg=FG2))
            b.bind('<Button-1>', lambda e: cmd())
            return b

        _win_btn(nav_r, "✕", '#CC2222', self._hide_to_tray)
        _win_btn(nav_r, "□", CARD2, lambda: self.geometry(
            f"{self.winfo_screenwidth()}x{self.winfo_screenheight()}+0+0"
            if self.winfo_width() < self.winfo_screenwidth() - 10
            else "1024x600"))
        def _minimise():
            try:
                import ctypes as _c
                _hwnd = _c.windll.user32.FindWindowW(None, "DartVoice")
                if _hwnd:
                    # Ensure taskbar entry exists before minimising
                    _GWL_EX = -20; _APPWIN = 0x00040000
                    _es = _c.windll.user32.GetWindowLongW(_hwnd, _GWL_EX)
                    _c.windll.user32.SetWindowLongW(_hwnd, _GWL_EX, _es | _APPWIN)
                    _c.windll.user32.ShowWindow(_hwnd, 6)   # SW_MINIMIZE
                    return
            except Exception:
                pass
            # Fallback for non-Win32
            self.overrideredirect(False)
            self.iconify()
            def _rewrap(e=None):
                self.overrideredirect(True)
                self.unbind('<Map>')
            self.bind('<Map>', _rewrap)
        _win_btn(nav_r, "—", CARD2, _minimise)

        # Sep line
        tk.Frame(nav_r, bg=SEP, width=1, height=24).pack(side='right', padx=4)

        self._acct_btn = ctk.CTkButton(
            nav_r, text='→', font=("Uber Move Bold", 11, "bold"),
            fg_color=CARD2, hover_color=SEP, text_color=ACCENT,
            border_width=1, border_color=SEP,
            width=32, height=32, corner_radius=8,
            command=self._open_account_dialog,
        )
        self._acct_btn.pack(side='right', padx=(0, 3))

        def _load_acct_label():
            try:
                from billing import get_account as _ga
                _acct = _ga()
                _lbl = _acct['email'][0].upper() if _acct else '→'
            except Exception:
                _lbl = '→'
            self.after(0, lambda: self._acct_btn.configure(text=_lbl)
                       if self._acct_btn.winfo_exists() else None)
        threading.Thread(target=_load_acct_label, daemon=True).start()


        settings_wrap = ctk.CTkFrame(nav_r, fg_color=CARD2, corner_radius=8,
                                      border_width=1, border_color=SEP,
                                      width=32, height=32)
        settings_wrap.pack(side='right', padx=(0, 3))
        settings_wrap.pack_propagate(False)
        settings_ic = tk.Canvas(settings_wrap, width=32, height=32, bg=CARD2, highlightthickness=0)
        settings_ic.pack(fill='both', expand=True)
        self._draw_svg_icon(settings_ic, 'settings', FG2, 18)
        settings_ic.bind('<Button-1>', lambda e: self._open_settings())
        settings_ic.bind('<Enter>', lambda e: self._draw_svg_icon(settings_ic, 'settings', FG, 18))
        settings_ic.bind('<Leave>', lambda e: self._draw_svg_icon(settings_ic, 'settings', FG2, 18))

        ctk.CTkButton(
            nav_r, text="⊞", font=("Rubik", 14),
            fg_color=CARD2, hover_color=SEP, text_color=FG2,
            border_width=1, border_color=SEP,
            width=32, height=32, corner_radius=8,
            command=self._open_ingame,
        ).pack(side='right', padx=(0, 3))

        self._rec_btn = ctk.CTkButton(
            nav_r, text="⏺", font=("Rubik", 14),
            fg_color=CARD2, hover_color=SEP, text_color='#CC2222',
            border_width=1, border_color=SEP,
            width=32, height=32, corner_radius=8,
            command=self._toggle_record,
        )
        self._rec_btn.pack(side='right', padx=(0, 3))

        tk.Frame(self, bg=SEP, height=1).pack(fill='x')

        # ── Three-column body (.grid layout: col 0 | sep | col 2 | sep | col 4) ──
        body = ctk.CTkFrame(self, fg_color='transparent')
        body.pack(fill='both', expand=True)
        body.grid_columnconfigure(0, weight=1, minsize=190)
        body.grid_columnconfigure(1, weight=0, minsize=1)
        body.grid_columnconfigure(2, weight=2)
        body.grid_columnconfigure(3, weight=0, minsize=1)
        body.grid_columnconfigure(4, weight=1, minsize=190)
        body.grid_rowconfigure(0, weight=1)

        # ── COLUMN 0: Session History ─────────────────────────────────────
        left_panel = ctk.CTkScrollableFrame(body, fg_color=CARD, corner_radius=0,
                                            scrollbar_button_color=ACCENT,
                                            scrollbar_button_hover_color=PRI_HOV)
        left_panel.grid(row=0, column=0, sticky='nsew')

        hist_hdr = ctk.CTkFrame(left_panel, fg_color='transparent', height=42)
        hist_hdr.pack(fill='x')
        hist_hdr.pack_propagate(False)
        h_dot_row = ctk.CTkFrame(hist_hdr, fg_color='transparent')
        h_dot_row.place(x=14, rely=0.5, anchor='w')
        ctk.CTkFrame(h_dot_row, fg_color=ACCENT, width=8, height=8,
                     corner_radius=4).pack(side='left', padx=(0, 6))
        ctk.CTkLabel(h_dot_row, text="SESSION HISTORY", text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(side='left')

        # Rotate-ccw undo icon at right of history header
        undo_ic = tk.Canvas(hist_hdr, width=20, height=20, bg=CARD, highlightthickness=0)
        undo_ic.place(relx=1.0, x=-14, rely=0.5, anchor='e')
        self._draw_svg_icon(undo_ic, 'rotate-ccw', FG2, 16)
        undo_ic.bind('<Button-1>', lambda e: self._on_cancel())
        undo_ic.bind('<Enter>', lambda e: self._draw_svg_icon(undo_ic, 'rotate-ccw', FG, 16))
        undo_ic.bind('<Leave>', lambda e: self._draw_svg_icon(undo_ic, 'rotate-ccw', FG2, 16))

        ctk.CTkFrame(left_panel, fg_color=SEP, height=1).pack(fill='x')

        # Mode selector
        mode_f = ctk.CTkFrame(left_panel, fg_color='transparent')
        mode_f.pack(fill='x', padx=12, pady=(10, 4))
        ctk.CTkLabel(mode_f, text="GAME MODE", text_color=FG2,
                     font=("Rubik", 7, "bold")).pack(anchor='w', pady=(0, 5))
        self.mode_var = ctk.StringVar(value=self.cfg.get('game_mode', 'X01'))
        ctk.CTkSegmentedButton(
            left_panel, values=["X01", "Cricket"], variable=self.mode_var,
            command=self._save_mode,
            font=("Uber Move Bold", 10, "bold"),
            fg_color=CARD2, selected_color=ACCENT, selected_hover_color=PRI_HOV,
            unselected_color=CARD2, unselected_hover_color=SEP,
            text_color=PRI_FG, corner_radius=8, height=30,
        ).pack(fill='x', padx=12, pady=(0, 8))
        ctk.CTkFrame(left_panel, fg_color=SEP, height=1).pack(fill='x', padx=12)

        hist_scroll = ctk.CTkScrollableFrame(left_panel, fg_color='transparent',
                                              scrollbar_button_color=SEP,
                                              scrollbar_button_hover_color=FG2)
        hist_scroll.pack(fill='both', expand=True)
        self._hist_scroll = hist_scroll
        self._redraw_history()

        # ── Trigger word quick-toggle ─────────────────────────────────────
        ctk.CTkFrame(left_panel, fg_color=SEP, height=1).pack(fill='x')
        trig_card = ctk.CTkFrame(left_panel, fg_color='transparent')
        trig_card.pack(fill='x', padx=12, pady=(8, 0))

        # Header row
        trig_hdr = ctk.CTkFrame(trig_card, fg_color='transparent')
        trig_hdr.pack(fill='x', pady=(0, 4))
        trig_ic = tk.Canvas(trig_hdr, width=12, height=12, bg=CARD, highlightthickness=0)
        trig_ic.pack(side='left', padx=(0, 5))
        self._draw_svg_icon(trig_ic, 'zap', FG2, 10)
        ctk.CTkLabel(trig_hdr, text="TRIGGER WORD", text_color=FG2,
                     font=("Rubik", 7, "bold")).pack(side='left')

        # Toggle row
        trig_row = ctk.CTkFrame(trig_card, fg_color=BG, corner_radius=8,
                                border_width=1, border_color=SEP)
        trig_row.pack(fill='x', pady=(0, 4))
        ctk.CTkLabel(trig_row, text="Require trigger", text_color=FG,
                     font=("Rubik", 10)).pack(side='left', padx=10, pady=6)
        _lt_rv = ctk.BooleanVar(value=self.cfg.get('require_trigger', True))
        ctk.CTkSwitch(
            trig_row, variable=_lt_rv, text='',
            onvalue=True, offvalue=False,
            fg_color=SEP, progress_color=ACCENT,
            button_color=FG, button_hover_color=FG2,
            width=36, height=18,
            command=lambda: self._save_setting('require_trigger', _lt_rv.get()),
        ).pack(side='right', padx=10)

        # Trigger word entry
        _lt_tw = ctk.CTkEntry(
            trig_card, font=("Rubik", 11), fg_color=BG,
            border_color=SEP, border_width=1, text_color=FG,
            placeholder_text="trigger word…",
            placeholder_text_color=FG2,
            justify='center', height=34, corner_radius=8,
        )
        _lt_tw.insert(0, self.cfg.get('trigger', 'score'))
        _lt_tw.pack(fill='x', pady=(0, 8))
        _lt_tw.bind('<KeyRelease>',
                    lambda e: self._save_setting('trigger', _lt_tw.get().strip().lower() or 'score'))

        # ── How To Use ────────────────────────────────────────────────────
        ctk.CTkFrame(left_panel, fg_color=SEP, height=1).pack(fill='x')
        how_hdr = ctk.CTkFrame(left_panel, fg_color='transparent', height=32)
        how_hdr.pack(fill='x')
        how_hdr.pack_propagate(False)
        how_ic = tk.Canvas(how_hdr, width=12, height=12, bg=CARD, highlightthickness=0)
        how_ic.place(x=14, rely=0.5, anchor='w')
        self._draw_svg_icon(how_ic, 'help-circle', FG2, 10)
        ctk.CTkLabel(how_hdr, text="  HOW TO USE", text_color=FG2,
                     font=("Rubik", 7, "bold")).place(x=30, rely=0.5, anchor='w')

        _how_steps = [
            ('mic',        'Say trigger word\n(default: "score")'),
            ('target',     'Call darts:\n"Treble 20, 5, Double 16"'),
            ('zap',        'Score types into app\nautomatically'),
            ('rotate-ccw', 'Say cancel word to\nundo last entry'),
        ]
        how_frame = ctk.CTkFrame(left_panel, fg_color='transparent')
        how_frame.pack(fill='x', padx=12, pady=(4, 10))
        for step_icon, step_text in _how_steps:
            sr = ctk.CTkFrame(how_frame, fg_color=BG, corner_radius=8,
                              border_width=1, border_color=SEP)
            sr.pack(fill='x', pady=2)
            si = tk.Canvas(sr, width=20, height=20, bg=BG, highlightthickness=0)
            si.pack(side='left', padx=(8, 6), pady=6)
            self._draw_svg_icon(si, step_icon, ACCENT, 13)
            ctk.CTkLabel(sr, text=step_text, text_color=FG2,
                         font=("Rubik", 9), justify='left',
                         wraplength=130).pack(side='left', anchor='w', padx=(0, 6), pady=4)

        # Left column separator
        tk.Frame(body, bg=SEP, width=1).grid(row=0, column=1, sticky='nsew')

        # ── COLUMN 2: Main Stage ──────────────────────────────────────────
        center = ctk.CTkFrame(body, fg_color='transparent')
        center.grid(row=0, column=2, sticky='nsew')

        chips_row = ctk.CTkFrame(center, fg_color='transparent')
        chips_row.pack(pady=(16, 0))
        mode_text = self.cfg.get('game_mode', 'X01')
        ctk.CTkLabel(chips_row, text=f"{mode_text} MODE", text_color=FG2,
                     font=("Rubik", 8, "bold"), fg_color=CARD2, corner_radius=20,
                     ).pack(side='left', padx=3, ipadx=8, ipady=4)
        if mode_text == 'X01':
            start_v = self.cfg.get('x01_start', 501)
            ctk.CTkLabel(chips_row, text=f"FIRST TO {start_v}", text_color=FG2,
                         font=("Rubik", 8, "bold"), fg_color=CARD2, corner_radius=20,
                         ).pack(side='left', padx=3, ipadx=8, ipady=4)

        is_live = (self.cfg.get('live_checkout', False) and mode_text == 'X01'
                   and not self.cfg.get('per_dart_mode', False))
        score_label_text = "REMAINING" if is_live else "LAST SCORE"
        ctk.CTkLabel(center, text=score_label_text, text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(pady=(14, 4))

        self._score_canvas = tk.Canvas(center, bg=BG, highlightthickness=0,
                                        width=400, height=160)
        self._score_canvas.pack(padx=36, fill='x')
        self._score_canvas.bind('<Configure>', lambda e: self._redraw_score())
        self._score_str.trace_add('write', lambda *_: self._redraw_score())
        self._remaining_str.trace_add('write', lambda *_: self._redraw_score())
        self._redraw_score()

        stat_wrap = ctk.CTkFrame(center, fg_color='transparent')
        stat_wrap.pack(pady=(10, 0))
        stat_pill = ctk.CTkFrame(stat_wrap, fg_color=CARD2, corner_radius=20,
                                  border_width=1, border_color=SEP)
        stat_pill.pack(ipadx=14, ipady=4)
        self._dot = ctk.CTkLabel(stat_pill, text="●", text_color=FG3, font=("Rubik", 8))
        self._dot.pack(side='left', padx=(0, 5))
        ctk.CTkLabel(stat_pill, textvariable=self._status, text_color=FG2,
                     font=("Rubik", 10)).pack(side='left')

        # LISTEN button
        self._toggle_btn = ctk.CTkButton(
            center, text="START LISTENING",
            font=("Uber Move Bold", 15, "bold"),
            fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
            height=60, corner_radius=14, command=self._toggle,
        )
        self._toggle_btn.pack(fill='x', padx=36, pady=(14, 0))

        # Right column separator
        tk.Frame(body, bg=SEP, width=1).grid(row=0, column=3, sticky='nsew')

        # ── COLUMN 4: Stats & Settings ────────────────────────────────────
        right_panel = ctk.CTkFrame(body, fg_color=CARD, corner_radius=0)
        right_panel.grid(row=0, column=4, sticky='nsew')

        co_hdr = ctk.CTkFrame(right_panel, fg_color=BG, corner_radius=0, height=42)
        co_hdr.pack(fill='x')
        co_hdr.pack_propagate(False)
        ctk.CTkLabel(co_hdr, text="LIVE CHECKOUT", text_color=FG2,
                     font=("Rubik", 7, "bold")).place(x=16, rely=0.5, anchor='w')
        ctk.CTkFrame(right_panel, fg_color=SEP, height=1).pack(fill='x')

        co_area = ctk.CTkFrame(right_panel, fg_color='transparent')
        co_area.pack(fill='x', padx=16, pady=(10, 0))
        ctk.CTkLabel(co_area, textvariable=self._remaining_str, text_color=FG,
                     font=("Uber Move Bold", 28, "bold")).pack(anchor='w')
        ctk.CTkLabel(co_area, textvariable=self._checkout_str, text_color=ACCENT,
                     font=("Uber Move Bold", 13, "bold"), wraplength=166,
                     justify='left').pack(anchor='w')
        ctk.CTkFrame(right_panel, fg_color=SEP, height=1).pack(fill='x', padx=12, pady=(10, 0))

        # ── Stats row ─────────────────────────────────────────────────────────
        stats_row = ctk.CTkFrame(right_panel, fg_color='transparent')
        stats_row.pack(fill='x', padx=14, pady=(10, 0))
        stats_row.grid_columnconfigure(0, weight=1)
        stats_row.grid_columnconfigure(1, weight=1)

        def _stat_col(parent, label, var, col):
            f = ctk.CTkFrame(parent, fg_color=BG, corner_radius=10,
                             border_width=1, border_color=SEP)
            f.grid(row=0, column=col, sticky='ew',
                   padx=(0, 5) if col == 0 else (5, 0), pady=0)
            ctk.CTkLabel(f, text=label, text_color=FG2,
                         font=("Rubik", 6, "bold")).pack(anchor='w', padx=8, pady=(6, 0))
            ctk.CTkLabel(f, textvariable=var, text_color=FG,
                         font=("Uber Move Bold", 26, "bold")).pack(anchor='w', padx=8, pady=(0, 6))

        _stat_col(stats_row, "SESSION AVG",   self._avg_str,   0)
        _stat_col(stats_row, "DARTS THROWN",  self._darts_str, 1)

        ctk.CTkFrame(right_panel, fg_color=SEP, height=1).pack(fill='x', padx=12, pady=(10, 0))

        # ── Scrollable quick-controls ─────────────────────────────────────────
        ctrl_scroll = ctk.CTkScrollableFrame(
            right_panel, fg_color='transparent',
            scrollbar_button_color=CARD2, scrollbar_button_hover_color=SEP,
        )
        ctrl_scroll.pack(fill='both', expand=True)

        # ─ helper: section header with icon ───────────────────────────────────
        def _ctrl_section(icon_name, title):
            row = ctk.CTkFrame(ctrl_scroll, fg_color='transparent')
            row.pack(fill='x', padx=12, pady=(10, 3))
            ic = tk.Canvas(row, width=12, height=12, bg=CARD, highlightthickness=0)
            ic.pack(side='left', padx=(0, 5))
            self._draw_svg_icon(ic, icon_name, FG2, 10)
            ctk.CTkLabel(row, text=title, text_color=FG2,
                         font=("Rubik", 7, "bold")).pack(side='left')

        # ─ helper: compact toggle row ─────────────────────────────────────────
        def _ctrl_toggle(label, cfg_key, default=False, on_change=None):
            row = ctk.CTkFrame(ctrl_scroll, fg_color=BG, corner_radius=8,
                               border_width=1, border_color=SEP)
            row.pack(fill='x', padx=12, pady=2)
            ctk.CTkLabel(row, text=label, text_color=FG,
                         font=("Rubik", 10)).pack(side='left', padx=10, pady=8)
            var = ctk.BooleanVar(value=self.cfg.get(cfg_key, default))
            sw = ctk.CTkSwitch(
                row, variable=var, text='',
                onvalue=True, offvalue=False,
                fg_color=SEP, progress_color=ACCENT,
                button_color=FG, button_hover_color=FG2,
                width=36, height=18,
                command=lambda: (
                    self._save_setting(cfg_key, var.get()),
                    on_change(var.get()) if on_change else None,
                ),
            )
            sw.pack(side='right', padx=10)
            return var

        # ── 1. MICROPHONE ─────────────────────────────────────────────────────
        _ctrl_section('mic', 'MICROPHONE')

        _mic_cache3 = self._cached_mic_list or (['Default'], {0: None})
        rp_mic_labels, rp_mic_index_map = _mic_cache3[0][:], dict(_mic_cache3[1])

        _rp_cur_lbl = 'Default'
        for _li3, _di3 in rp_mic_index_map.items():
            if _di3 == self.cfg.get('mic_index') and _li3 > 0:
                _rp_cur_lbl = rp_mic_labels[_li3]; break

        rp_mic_var = ctk.StringVar(value=_rp_cur_lbl)
        def _rp_on_mic(label):
            for _li3, _n3 in enumerate(rp_mic_labels):
                if _n3 == label:
                    self.cfg['mic_index'] = rp_mic_index_map.get(_li3)
                    save_config(self.cfg); break
        ctk.CTkOptionMenu(
            ctrl_scroll, variable=rp_mic_var, values=rp_mic_labels,
            font=("Rubik", 10),
            fg_color=BG, button_color=ACCENT_DIM, button_hover_color=ACCENT,
            text_color=FG, dropdown_fg_color=CARD, dropdown_text_color=FG,
            dropdown_hover_color=CARD2, corner_radius=8, height=36,
            command=_rp_on_mic,
        ).pack(fill='x', padx=12, pady=(0, 2))

        # ── 2. SCORING MODE ───────────────────────────────────────────────────
        _ctrl_section('target', 'SCORING MODE')

        seg2 = ctk.CTkFrame(ctrl_scroll, fg_color='transparent')
        seg2.pack(fill='x', padx=12, pady=(0, 2))
        seg2.grid_columnconfigure(0, weight=1)
        seg2.grid_columnconfigure(1, weight=1)

        _pd2 = self.cfg.get('per_dart_mode', False)

        def _set_mode2(per_dart):
            self._save_setting('per_dart_mode', per_dart)
            b_per2.configure(fg_color=ACCENT if per_dart else BG,
                             border_color=ACCENT if per_dart else SEP,
                             text_color=PRI_FG if per_dart else FG2)
            b_3d2.configure(fg_color=ACCENT if not per_dart else BG,
                            border_color=ACCENT if not per_dart else SEP,
                            text_color=PRI_FG if not per_dart else FG2)

        b_per2 = ctk.CTkButton(
            seg2, text="Per Dart", font=("Rubik", 10, "bold"), height=34,
            corner_radius=8, border_width=1,
            fg_color=ACCENT if _pd2 else BG,
            border_color=ACCENT if _pd2 else SEP,
            hover_color=PRI_HOV, text_color=PRI_FG if _pd2 else FG2,
            command=lambda: _set_mode2(True),
        )
        b_per2.grid(row=0, column=0, sticky='ew', padx=(0, 3))

        b_3d2 = ctk.CTkButton(
            seg2, text="3 Darts", font=("Rubik", 10, "bold"), height=34,
            corner_radius=8, border_width=1,
            fg_color=ACCENT if not _pd2 else BG,
            border_color=ACCENT if not _pd2 else SEP,
            hover_color=PRI_HOV, text_color=PRI_FG if not _pd2 else FG2,
            command=lambda: _set_mode2(False),
        )
        b_3d2.grid(row=0, column=1, sticky='ew', padx=(3, 0))

        # ── 3. GAME CALIBRATION ───────────────────────────────────────────────
        _ctrl_section('sliders', 'GAME CALIBRATION')
        cur_mode = self.cfg.get('game_mode', 'X01')

        calib_card = ctk.CTkFrame(ctrl_scroll, fg_color=BG, corner_radius=8,
                                   border_width=1, border_color=SEP)
        calib_card.pack(fill='x', padx=12, pady=2)

        if cur_mode == 'X01':
            ctk.CTkLabel(calib_card, text="Starting Score", text_color=FG2,
                         font=("Rubik", 9)).pack(anchor='w', padx=10, pady=(6, 0))
            start_var2 = ctk.StringVar(value=str(self.cfg.get('x01_start', 501)))
            ctk.CTkOptionMenu(
                calib_card, variable=start_var2,
                values=['170', '301', '501', '701', '1001'],
                font=("Rubik", 11, "bold"),
                fg_color=CARD, button_color=ACCENT_DIM, button_hover_color=ACCENT,
                text_color=FG, dropdown_fg_color=CARD, dropdown_text_color=FG,
                dropdown_hover_color=CARD2, corner_radius=8, height=36,
                command=lambda v: self._save_setting('x01_start', int(v)),
            ).pack(fill='x', padx=8, pady=(2, 8))
        else:
            # Cricket: live checkout toggle
            _ctrl_toggle('Live checkout tracking', 'live_checkout', False)

        # Bottom icon buttons: Settings + Account (canvas icons + label)
        ctk.CTkFrame(right_panel, fg_color=SEP, height=1).pack(side='bottom', fill='x')
        bot_row = ctk.CTkFrame(right_panel, fg_color='transparent', height=56)
        bot_row.pack(side='bottom', fill='x')
        bot_row.pack_propagate(False)
        bot_row.grid_columnconfigure(0, weight=1)
        bot_row.grid_columnconfigure(1, weight=1)
        bot_row.grid_rowconfigure(0, weight=1)

        def _make_icon_btn(parent, icon, label_text, command, col):
            f = ctk.CTkFrame(parent, fg_color=BG, corner_radius=8,
                              border_width=1, border_color=SEP)
            f.grid(row=0, column=col, sticky='nsew',
                   padx=(8, 4) if col == 0 else (4, 8), pady=8)
            ic = tk.Canvas(f, width=18, height=18, bg=BG, highlightthickness=0)
            ic.pack(pady=(5, 0))
            self._draw_svg_icon(ic, icon, FG2, 14)
            ctk.CTkLabel(f, text=label_text, text_color=FG2,
                         font=("Rubik", 7, "bold")).pack(pady=(1, 4))
            f.bind('<Button-1>', lambda e: command())
            ic.bind('<Button-1>', lambda e: command())

        _make_icon_btn(bot_row, 'settings', 'SETTINGS', self._open_settings, 0)
        _make_icon_btn(bot_row, 'user', 'ACCOUNT', self._open_account_dialog, 1)

    # ── Visit history panel ───────────────────────────────────────────────────
    def _push_history(self, label: str, score_str: str):
        """Prepend a new visit to the history list and refresh the panel."""
        self._visit_history.insert(0, (label, score_str))
        if len(self._visit_history) > 20:
            self._visit_history = self._visit_history[:20]
        self._redraw_history()

    def _redraw_history(self):
        if not hasattr(self, '_hist_scroll') or not self._hist_scroll.winfo_exists():
            return
        for w in self._hist_scroll.winfo_children():
            w.destroy()
        if not self._visit_history:
            ctk.CTkLabel(self._hist_scroll, text="No scores yet",
                         text_color=FG3, font=("Rubik", 9)).pack(pady=12)
            return
        for i, (label, score) in enumerate(self._visit_history):
            is_max = (score == '180')
            row = ctk.CTkFrame(self._hist_scroll,
                               fg_color=CARD2 if is_max else CARD,
                               corner_radius=6,
                               border_width=1 if is_max else 0,
                               border_color=ACCENT if is_max else CARD)
            row.pack(fill='x', pady=2, padx=6)
            ctk.CTkLabel(row, text=label, text_color=FG2,
                         font=("Rubik", 10), anchor='w').pack(side='left', padx=(10, 0), pady=4)
            score_col = ACCENT if is_max else FG
            ctk.CTkLabel(row, text=score, text_color=score_col,
                         font=("Uber Move Bold", 11, "bold"), anchor='e').pack(side='right', padx=(0, 10), pady=4)

    # ── Social media icon drawing ─────────────────────────────────────────────
    def _draw_social_icon(self, c, name, sz, hover=False):
        col = FG if hover else FG2
        cx, cy = sz // 2, sz // 2
        if name == 'instagram':
            # Rounded camera body
            m = 5
            r = 4
            c.create_rectangle(m, m, sz-m, sz-m, outline=col, width=1.5)
            # Lens circle
            c.create_oval(cx-5, cy-5, cx+5, cy+5, outline=col, width=1.5)
            # Flash dot
            c.create_oval(sz-m-5, m+2, sz-m-2, m+5, fill=col, outline='')
        elif name == 'tiktok':
            # Musical note shape
            x0 = cx - 1
            # Vertical stem
            c.create_line(x0+3, 7, x0+3, 22, fill=col, width=2)
            # Note head circle
            c.create_oval(x0-4, 19, x0+4, 26, outline=col, width=1.5)
            # Top flag curve
            c.create_line(x0+3, 7, x0+8, 5, x0+10, 9, fill=col, width=1.5, smooth=True)
        elif name == 'youtube':
            # Rounded play button rectangle
            m = 5
            c.create_rectangle(m, m+3, sz-m, sz-m-3, outline=col, width=1.5)
            # Play triangle
            c.create_polygon(cx-3, cy-5, cx-3, cy+5, cx+5, cy,
                             fill=col, outline='')
        elif name == 'x':
            # X / Twitter logo — two crossed strokes
            m = 8
            c.create_line(m, m, sz-m, sz-m, fill=col, width=2)
            c.create_line(sz-m, m, m, sz-m, fill=col, width=2)
        elif name == 'facebook':
            # Lowercase f
            c.create_text(cx, cy, text="f", font=("Rubik", 14, "bold"),
                          fill=col, anchor='center')

    # ── Geometry helper ──────────────────────────────────────────────────────
    def _right_of(self, w, h):
        self.update_idletasks()
        x = self.winfo_x() + self.winfo_width() + 10
        y = self.winfo_y()
        return f"{w}x{h}+{x}+{y}"

    # ── Score canvas ─────────────────────────────────────────────────────────
    def _redraw_score(self):
        c = self._score_canvas
        c.delete('all')
        w = c.winfo_width()  or 400
        h = c.winfo_height() or 160
        L = 18  # bracket arm length
        T = 2

        is_live = (self.cfg.get('live_checkout', False) and
                   self.cfg.get('game_mode', 'X01') == 'X01' and
                   not self.cfg.get('per_dart_mode', False))
        val = self._remaining_str.get() if is_live else self._score_str.get()
        is_180 = (val == '180') and not is_live
        col = ACCENT if self._active else SEP

        # Radial glow behind score (active state)
        if self._active:
            ah = ACCENT.lstrip('#')
            ar, ag, ab = int(ah[0:2], 16), int(ah[2:4], 16), int(ah[4:6], 16)
            bg_h = BG.lstrip('#')
            glow_steps = [
                (w * 0.9, h * 1.6, 0.06),
                (w * 0.65, h * 1.1, 0.10),
                (w * 0.42, h * 0.7, 0.13),
            ]
            for gw, gh, alpha in glow_steps:
                _hex = '#{:02X}{:02X}{:02X}'.format(
                    int(ar * alpha + int(bg_h[0:2], 16) * (1 - alpha)),
                    int(ag * alpha + int(bg_h[2:4], 16) * (1 - alpha)),
                    int(ab * alpha + int(bg_h[4:6], 16) * (1 - alpha)),
                )
                x0 = w / 2 - gw / 2
                y0 = h / 2 - gh / 2
                c.create_oval(x0, y0, x0 + gw, y0 + gh, fill=_hex, outline='')

        # Corner brackets
        for x0, y0, dx, dy in [
            (0, 0,    1,  1),
            (w, 0,   -1,  1),
            (0, h,    1, -1),
            (w, h,   -1, -1),
        ]:
            c.create_line(x0, y0+dy*L, x0, y0, x0+dx*L, y0, width=T, fill=col, capstyle='round')

        # Score text
        if not val:
            c.create_text(w//2, h//2, text="—", font=("Uber Move Bold", 64, "bold"),
                          fill=FG3, anchor='center')
        else:
            score_cy = h // 2
            if is_180:
                c.create_text(w // 2, score_cy - 50, text="MAXIMUM",
                              font=("Rubik", 9, "bold"), fill=ACCENT, anchor='center')
                score_cy = score_cy - 6

            max_w = w - 32
            size = 96 if is_live else 72
            while size > 16:
                fnt = ("Uber Move Bold", size, "bold")
                tid = c.create_text(-1000, -1000, text=val, font=fnt)
                tw = c.bbox(tid)[2] - c.bbox(tid)[0]
                c.delete(tid)
                if tw <= max_w:
                    break
                size -= 2

            fnt = ("Uber Move Bold", size, "bold")
            cx = w // 2

            if self._active:
                layers = _glow_layers(ACCENT)
                for offset, glow_col in zip((5, 4, 3, 2, 1), layers):
                    for ox, oy in [(-offset,0),(offset,0),(0,-offset),(0,offset),
                                   (-offset,-offset),(offset,offset)]:
                        c.create_text(cx+ox, score_cy+oy, text=val, font=fnt,
                                      fill=glow_col, anchor='center')
            c.create_text(cx, score_cy, text=val, font=fnt,
                          fill=(ACCENT if (is_180 or is_live) else FG), anchor='center')

    # ── Bullseye logo ─────────────────────────────────────────────────────────
    @staticmethod
    def _draw_bullseye(canvas, cx, cy, radii):
        colors = [FG3, ACCENT_DIM, FG3, ACCENT]
        for r, col in zip(radii, colors):
            canvas.create_oval(cx-r, cy-r, cx+r, cy+r, outline=col, width=1, fill='')
        # Centre dot
        canvas.create_oval(cx-2, cy-2, cx+2, cy+2, fill=ACCENT, outline='')

    # ── SVG icon renderer ─────────────────────────────────────────────────────
    def _draw_svg_icon(self, canvas, icon_name, color, size=20):
        """Draw a Lucide-style icon on a tkinter Canvas using geometric primitives.
        Supports: mic, settings, user, rotate-ccw, corner-down-left.
        Icons are drawn centred within the canvas at the given pixel size.
        """
        canvas.delete('all')
        cw = canvas.winfo_reqwidth() or (size + 4)
        ch = canvas.winfo_reqheight() or (size + 4)
        ox = (cw - size) / 2
        oy = (ch - size) / 2
        s  = size / 24.0
        lw = max(1.5, size / 14.0)

        def px(x): return ox + x * s
        def py(y): return oy + y * s

        if icon_name == 'mic':
            # Body: rounded rect (9,2)–(15,14)
            bx1, by1, bx2, by2 = px(9), py(2), px(15), py(14)
            r = 3 * s
            canvas.create_arc(bx1,      by1,      bx1+r*2, by1+r*2, start=90,  extent=90,  outline=color, width=lw, style='arc')
            canvas.create_arc(bx2-r*2,  by1,      bx2,     by1+r*2, start=0,   extent=90,  outline=color, width=lw, style='arc')
            canvas.create_arc(bx1,      by2-r*2,  bx1+r*2, by2,     start=180, extent=90,  outline=color, width=lw, style='arc')
            canvas.create_arc(bx2-r*2,  by2-r*2,  bx2,     by2,     start=270, extent=90,  outline=color, width=lw, style='arc')
            canvas.create_line(bx1+r, by1, bx2-r, by1, fill=color, width=lw)
            canvas.create_line(bx1+r, by2, bx2-r, by2, fill=color, width=lw)
            canvas.create_line(bx1, by1+r, bx1, by2-r,  fill=color, width=lw)
            canvas.create_line(bx2, by1+r, bx2, by2-r,  fill=color, width=lw)
            # Stand arc (D-shape below body) + stem + base
            canvas.create_arc(px(5), py(10), px(19), py(20), start=180, extent=-180,
                              outline=color, width=lw, style='arc')
            canvas.create_line(px(12), py(20), px(12), py(23), fill=color, width=lw)
            canvas.create_line(px(8),  py(23), px(16), py(23), fill=color, width=lw)

        elif icon_name == 'settings':
            # Gear polygon: alternating outer/inner radius vertices
            cx2, cy2 = px(12), py(12)
            ro, ri = 9.5 * s, 6.0 * s
            teeth = 8
            pts = []
            for i in range(teeth * 2):
                angle = math.radians(i * 180 / teeth - 90)
                r = ro if i % 2 == 0 else ri
                pts.extend([cx2 + r * math.cos(angle), cy2 + r * math.sin(angle)])
            canvas.create_polygon(pts, outline=color, fill='', width=lw)
            # Centre hole
            rh = 3.5 * s
            canvas.create_oval(cx2-rh, cy2-rh, cx2+rh, cy2+rh, outline=color, width=lw)

        elif icon_name == 'user':
            # Head circle at (12, 7) r=4
            hx, hy = px(12), py(7)
            r = 4 * s
            canvas.create_oval(hx-r, hy-r, hx+r, hy+r, outline=color, width=lw)
            # Shoulders arc
            canvas.create_arc(px(4), py(13), px(20), py(23), start=0, extent=180,
                              outline=color, width=lw, style='arc')

        elif icon_name == 'rotate-ccw':
            # 270° arc + two-line arrow at start point
            cx2, cy2 = px(12), py(12)
            r = 8 * s
            canvas.create_arc(cx2-r, cy2-r, cx2+r, cy2+r, start=60, extent=270,
                              outline=color, width=lw, style='arc')
            canvas.create_line(px(3), py(7),  px(9),  py(7),  fill=color, width=lw)
            canvas.create_line(px(3), py(7),  px(3),  py(13), fill=color, width=lw)

        elif icon_name == 'corner-down-left':
            # Vertical drop → curve → horizontal → arrowhead
            canvas.create_line(px(20), py(4),  px(20), py(11), fill=color, width=lw)
            canvas.create_arc(px(12), py(11), px(20), py(19), start=0, extent=-90,
                              outline=color, width=lw, style='arc')
            canvas.create_line(px(12), py(15), px(4),  py(15), fill=color, width=lw)
            canvas.create_line(px(4),  py(15), px(9),  py(10), fill=color, width=lw)
            canvas.create_line(px(4),  py(15), px(9),  py(20), fill=color, width=lw)

        elif icon_name == 'target':
            # Bullseye: 3 concentric circles + crosshair lines
            for r_u in (9, 6, 3):
                r_p = r_u * s
                cx2, cy2 = px(12), py(12)
                canvas.create_oval(cx2-r_p, cy2-r_p, cx2+r_p, cy2+r_p,
                                   outline=color, width=lw)
            canvas.create_line(px(12), py(1),  px(12), py(5),  fill=color, width=lw)
            canvas.create_line(px(12), py(19), px(12), py(23), fill=color, width=lw)
            canvas.create_line(px(1),  py(12), px(5),  py(12), fill=color, width=lw)
            canvas.create_line(px(19), py(12), px(23), py(12), fill=color, width=lw)

        elif icon_name == 'zap':
            # Lightning bolt
            pts = [px(13), py(2), px(6), py(13), px(12), py(13),
                   px(11), py(22), px(18), py(11), px(12), py(11), px(13), py(2)]
            canvas.create_polygon(pts, outline=color, fill='', width=lw)

        elif icon_name == 'sliders':
            # Three horizontal slider lines with knobs
            for row, knob_x in [(4, 16), (12, 8), (20, 13)]:
                canvas.create_line(px(2), py(row), px(22), py(row),
                                   fill=color, width=lw)
                r_k = 2.2 * s
                kx = px(knob_x)
                ky = py(row)
                canvas.create_oval(kx-r_k, ky-r_k, kx+r_k, ky+r_k,
                                   outline=color, fill=canvas['bg'], width=lw)

        elif icon_name == 'help-circle':
            # Outer circle
            r_o = 10 * s
            cx2, cy2 = px(12), py(12)
            canvas.create_oval(cx2-r_o, cy2-r_o, cx2+r_o, cy2+r_o,
                               outline=color, width=lw)
            # "?" shape: arc top + vertical drop
            canvas.create_arc(px(8), py(7), px(16), py(14),
                               start=0, extent=180, outline=color, width=lw, style='arc')
            canvas.create_line(px(12), py(11), px(12), py(16), fill=color, width=lw)
            r_dot = 0.9 * s
            canvas.create_oval(px(12)-r_dot, py(18.5)-r_dot,
                               px(12)+r_dot, py(18.5)+r_dot,
                               fill=color, outline='')

        elif icon_name == 'chevron-right':
            canvas.create_line(px(9), py(6),  px(15), py(12), fill=color, width=lw)
            canvas.create_line(px(15), py(12), px(9), py(18), fill=color, width=lw)

        elif icon_name == 'book-open':
            # Open book outline
            canvas.create_line(px(12), py(20), px(12), py(5), fill=color, width=lw)
            canvas.create_line(px(2), py(3), px(12), py(5), px(22), py(3),
                               fill=color, width=lw)
            canvas.create_line(px(2),  py(3),  px(2),  py(20), fill=color, width=lw)
            canvas.create_line(px(22), py(3),  px(22), py(20), fill=color, width=lw)
            canvas.create_line(px(2),  py(20), px(12), py(22), px(22), py(20),
                               fill=color, width=lw)

    # ── Screen Recorder ──────────────────────────────────────────────────────
    def _toggle_record(self):
        if getattr(self, '_recorder_thread', None) and self._recorder_thread.is_alive():
            self._stop_record()
        else:
            self._start_record_flow()

    def _start_record_flow(self):
        """Show region selector overlay, then begin recording."""
        sel_win = tk.Toplevel(self)
        sel_win.overrideredirect(True)
        sw = sel_win.winfo_screenwidth()
        sh = sel_win.winfo_screenheight()
        sel_win.geometry(f"{sw}x{sh}+0+0")
        sel_win.attributes('-alpha', 0.35)
        sel_win.attributes('-topmost', True)
        sel_win.config(bg='#000018')
        sel_win.update_idletasks()
        sel_win.lift(); sel_win.focus_force()

        canvas = tk.Canvas(sel_win, bg='#000018', highlightthickness=0, cursor='crosshair')
        canvas.pack(fill='both', expand=True)
        sel_win.update_idletasks()

        # Instruction label
        inst = canvas.create_text(sw // 2, 40, text="Click and drag to select the area to record  ·  ESC to cancel",
                                  fill='white', font=("Rubik", 14, "bold"))

        _drag = {}
        _rect = [None]

        def _on_press(e):
            _drag['x0'] = e.x; _drag['y0'] = e.y
            if _rect[0]: canvas.delete(_rect[0])

        def _on_drag(e):
            if _rect[0]: canvas.delete(_rect[0])
            x0, y0 = _drag['x0'], _drag['y0']
            _rect[0] = canvas.create_rectangle(
                x0, y0, e.x, e.y,
                outline=ACCENT, width=2, dash=(6, 3))
            w = abs(e.x - x0); h = abs(e.y - y0)
            canvas.itemconfig(inst,
                text=f"{w}×{h} px  ·  release to confirm  ·  ESC to cancel")

        def _on_release(e):
            x0 = min(_drag['x0'], e.x); y0 = min(_drag['y0'], e.y)
            x1 = max(_drag['x0'], e.x); y1 = max(_drag['y0'], e.y)
            sel_win.destroy()
            w = x1 - x0; h = y1 - y0
            if w < 20 or h < 20:
                return
            region = {'left': x0, 'top': y0, 'width': w, 'height': h}
            self.after(80, lambda: self._begin_recording(region))

        canvas.bind('<ButtonPress-1>',   _on_press)
        canvas.bind('<B1-Motion>',       _on_drag)
        canvas.bind('<ButtonRelease-1>', _on_release)
        sel_win.bind('<Escape>', lambda e: sel_win.destroy())

    def _begin_recording(self, region):
        import os, datetime
        ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        # Use saved dir from config, defaulting to ~/Videos/DartVoice
        out_dir = self.cfg.get('rec_save_dir', '')
        if not out_dir or not os.path.isdir(out_dir):
            out_dir = os.path.join(os.path.expanduser('~'), 'Videos', 'DartVoice')
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f'DartVoice_{ts}.mp4')

        try:
            import mss as _mss      # noqa
            import cv2 as _cv2      # noqa
            import numpy as _np     # noqa
        except ImportError as err:
            from tkinter import messagebox
            messagebox.showerror("Missing package",
                f"Screen recording needs mss and opencv-python.\n\npip install mss opencv-python\n\n({err})")
            return

        mic_on = self.cfg.get('rec_mic', False)
        fps = int(self.cfg.get('rec_fps', 30))
        self._recorder_thread = _RecordThread(region, out_path, fps=fps, mic=mic_on)
        self._recorder_thread.start()
        self._record_out_path = out_path

        # Update button to show recording state
        self._rec_btn.configure(text="⏹", fg_color='#2A0000',
                                text_color='#FF4444', border_color='#CC2222')

        # Floating REC indicator
        self._show_rec_hud(region)

    def _show_rec_hud(self, region):
        hud = tk.Toplevel(self)
        hud.overrideredirect(True)
        hud.attributes('-topmost', True)
        hud.config(bg='#0D0D0F')
        self._rec_hud = hud
        x = region['left'] + region['width'] - 180
        y = region['top'] + 8
        hud.geometry(f"172x38+{x}+{y}")

        f = tk.Frame(hud, bg='#0D0D0F')
        f.pack(fill='both', expand=True, padx=2, pady=2)

        # DartVoice brand dot
        lc = tk.Canvas(f, width=12, height=12, bg='#0D0D0F', highlightthickness=0)
        lc.pack(side='left', padx=(6, 0), pady=12)
        self._draw_bullseye(lc, 6, 6, [5, 3, 2, 1])

        tk.Label(f, text=" DARTVOICE", bg='#0D0D0F', fg='#CCCCDD',
                 font=("Uber Move Bold", 8, "bold")).pack(side='left')

        # Blinking REC dot
        _dot = tk.Label(f, text="● REC", bg='#0D0D0F', fg='#FF3333',
                        font=("Rubik", 8, "bold"))
        _dot.pack(side='right', padx=6)

        _blink = [True]
        def _do_blink():
            if not hud.winfo_exists(): return
            if not (getattr(self, '_recorder_thread', None) and
                    self._recorder_thread.is_alive()):
                hud.destroy(); return
            _dot.config(fg='#FF3333' if _blink[0] else '#440000')
            _blink[0] = not _blink[0]
            hud.after(600, _do_blink)
        hud.after(600, _do_blink)

        # Drag
        _d = {}
        def _dp(e): _d['x'] = e.x_root - hud.winfo_x(); _d['y'] = e.y_root - hud.winfo_y()
        def _dm(e): hud.geometry(f"+{e.x_root-_d['x']}+{e.y_root-_d['y']}")
        for w in (hud, f, _dot, lc):
            w.bind('<ButtonPress-1>', _dp)
            w.bind('<B1-Motion>', _dm)

    def _stop_record(self):
        if getattr(self, '_recorder_thread', None):
            self._recorder_thread.stop()
            self._recorder_thread.join(timeout=4)
        self._rec_btn.configure(text="⏺", fg_color=CARD2,
                                text_color='#CC2222', border_color=SEP)
        if hasattr(self, '_rec_hud') and self._rec_hud.winfo_exists():
            self._rec_hud.destroy()
        path = getattr(self, '_record_out_path', None)
        if path:
            import os
            from tkinter import messagebox
            if messagebox.askyesno("Recording saved",
                    f"Saved to:\n{path}\n\nOpen folder?"):
                os.startfile(os.path.dirname(path))

    # ── PiP Streamer Widget ───────────────────────────────────────────────────
    def _open_ingame(self):
        if hasattr(self, '_igw') and self._igw.winfo_exists():
            self._igw.lift(); return

        is_live = (self.cfg.get('live_checkout', False) and
                   self.cfg.get('game_mode', 'X01') == 'X01' and
                   not self.cfg.get('per_dart_mode', False))

        # Window: borderless, transparent chrome, always-on-top
        win = tk.Toplevel(self)
        self._igw = win
        win.overrideredirect(True)
        win.config(bg=BG)
        win.attributes('-topmost', True)
        if sys.platform == 'win32':
            win.attributes('-transparentcolor', BG)
        pill_w = 320
        pill_h = 340 if is_live else 310
        self.update_idletasks()
        px = self.winfo_x() + self.winfo_width() - pill_w - 20
        py = self.winfo_y() + 60
        win.geometry(f"{pill_w}x{pill_h}+{px}+{py}")

        # ── Drag (native Win32) ───────────────────────────────────────────
        _drag = {'x': 0, 'y': 0}

        def _drag_start(e):
            try:
                import ctypes
                hwnd = ctypes.windll.user32.GetParent(win.winfo_id()) or win.winfo_id()
                ctypes.windll.user32.ReleaseCapture()
                ctypes.windll.user32.PostMessageW(hwnd, 0xA1, 0x2, 0)
            except Exception:
                _drag['x'] = e.x_root - win.winfo_x()
                _drag['y'] = e.y_root - win.winfo_y()
                _drag['fb'] = True

        def _drag_move(e):
            if _drag.get('fb'):
                win.geometry(f"+{e.x_root - _drag['x']}+{e.y_root - _drag['y']}")

        # ── Pill — auto-sizes to content, window matches ─────────────────
        pill = ctk.CTkFrame(win, fg_color=CARD, corner_radius=16,
                            border_width=1, border_color=SEP)
        pill.pack(fill='both', expand=True)

        def _bind_drag(w):
            w.bind('<ButtonPress-1>', _drag_start)
            w.bind('<B1-Motion>',     _drag_move)

        _bind_drag(pill)

        # ── Top strip: accent bar + header row ────────────────────────────
        # 2px accent bar
        accent_bar = tk.Canvas(pill, width=pill_w, height=2,
                               bg=CARD, highlightthickness=0)
        accent_bar.pack(fill='x')
        _bind_drag(accent_bar)

        def _draw_accent_bar(*_):
            accent_bar.delete('all')
            bw = accent_bar.winfo_width() or pill_w
            accent_bar.create_rectangle(0, 0, bw, 2, fill=ACCENT, outline='')
        accent_bar.bind('<Configure>', _draw_accent_bar)

        # Header: bullseye + DARTVOICE + mic dot + — + ✕
        hdr = tk.Frame(pill, bg=CARD)
        hdr.pack(fill='x', padx=10, pady=(4, 0))
        _bind_drag(hdr)

        lc = tk.Canvas(hdr, width=12, height=12, bg=CARD, highlightthickness=0)
        lc.pack(side='left')
        _bind_drag(lc)
        self._draw_bullseye(lc, 6, 6, [5, 3, 2, 1])

        tk.Label(hdr, text=" DARTVOICE", bg=CARD, fg=FG,
                 font=("Uber Move Bold", 8, "bold")).pack(side='left')

        close_btn = tk.Label(hdr, text="✕", bg=CARD, fg=FG2,
                             font=("Rubik", 8), cursor='hand2')
        close_btn.pack(side='right')
        close_btn.bind('<Button-1>', lambda e: win.destroy())
        close_btn.bind('<Enter>',    lambda e: close_btn.config(fg=FG))
        close_btn.bind('<Leave>',    lambda e: close_btn.config(fg=FG2))

        # Collapse / expand toggle
        _collapsed    = [False]
        _full_height  = [pill_h]
        _body_widgets = []   # filled below — toggled on collapse

        min_btn = tk.Label(hdr, text="—", bg=CARD, fg=FG2,
                           font=("Rubik", 8), cursor='hand2')
        min_btn.pack(side='right', padx=(0, 4))

        def _toggle_collapse():
            if _collapsed[0]:
                _collapsed[0] = False
                min_btn.config(text="—")
                _restore_body()
                win.geometry(f"{win.winfo_width()}x{_full_height[0]}")
            else:
                _collapsed[0] = True
                _full_height[0] = win.winfo_height()
                min_btn.config(text="□")
                _hide_body()
                win.geometry(f"{win.winfo_width()}x34")

        min_btn.bind('<Button-1>', lambda e: _toggle_collapse())
        min_btn.bind('<Enter>',    lambda e: min_btn.config(fg=FG))
        min_btn.bind('<Leave>',    lambda e: min_btn.config(fg=FG2))

        # Mic status dot (right of header)
        mic_c = tk.Canvas(hdr, width=10, height=10, bg=CARD, highlightthickness=0)
        mic_c.pack(side='right', padx=(0, 4))
        _bind_drag(mic_c)

        def _redraw_mic_dot(*_):
            mic_c.delete('all')
            col = ACCENT if self._active else FG3
            mic_c.create_oval(1, 1, 9, 9, fill=col, outline='')

        self._active_pip_cb = _redraw_mic_dot
        _redraw_mic_dot()

        # ── Score canvas (dominant centre) ───────────────────────────────
        score_c = tk.Canvas(pill, height=70, bg=CARD, highlightthickness=0)
        score_c.pack(fill='x', padx=10, pady=(2, 0))
        _bind_drag(score_c)

        def _redraw_pip(*_):
            score_c.delete('all')
            w = score_c.winfo_width()  or (pill_w - 20)
            h = score_c.winfo_height() or 70
            val = self._remaining_str.get() if is_live else self._score_str.get()
            if not val:
                score_c.create_text(w // 2, h // 2, text="—",
                                    font=("Uber Move Bold", 28, "bold"),
                                    fill=FG3, anchor='center')
                return
            is_180 = (val == '180' and not is_live)
            max_w = w - 8
            size  = 44
            while size > 14:
                fnt = ("Uber Move Bold", size, "bold")
                tid = score_c.create_text(-999, -999, text=val, font=fnt)
                tw  = score_c.bbox(tid)[2] - score_c.bbox(tid)[0]
                score_c.delete(tid)
                if tw <= max_w: break
                size -= 2
            fnt = ("Uber Move Bold", size, "bold")
            cy2 = h // 2
            if self._active:
                for off, gc in zip((2, 1), _glow_layers(ACCENT)[3:]):
                    for ox, oy in [(-off,0),(off,0),(0,-off),(0,off)]:
                        score_c.create_text(w//2+ox, cy2+oy, text=val,
                                            font=fnt, fill=gc, anchor='center')
            score_c.create_text(w//2, cy2, text=val, font=fnt,
                                fill=ACCENT if is_180 else FG, anchor='center')

        self._score_str.trace_add('write',     _redraw_pip)
        self._remaining_str.trace_add('write', _redraw_pip)
        _redraw_pip()

        # ── Equalizer animation ───────────────────────────────────────────
        import math as _math
        eq_c = tk.Canvas(pill, height=18, bg=CARD, highlightthickness=0)
        eq_c.pack(fill='x', padx=10, pady=(3, 0))
        _bind_drag(eq_c)

        _EQ_BARS    = 9
        _EQ_BAR_W   = 4
        _EQ_GAP     = 3
        _EQ_OFFSETS = [i * (_math.pi * 2 / _EQ_BARS) for i in range(_EQ_BARS)]
        _eq_phase   = [0.0]
        _eq_job     = [None]

        def _draw_eq(*_):
            eq_c.delete('all')
            cw = eq_c.winfo_width()  or (pill_w - 20)
            ch = eq_c.winfo_height() or 18
            total = _EQ_BARS * _EQ_BAR_W + (_EQ_BARS - 1) * _EQ_GAP
            x0 = (cw - total) // 2
            for i in range(_EQ_BARS):
                x = x0 + i * (_EQ_BAR_W + _EQ_GAP)
                if self._active:
                    h = int(3 + 13 * (0.5 + 0.5 * _math.sin(
                        _eq_phase[0] + _EQ_OFFSETS[i])))
                    col = ACCENT
                else:
                    h = 3
                    col = FG3
                eq_c.create_rectangle(x, ch - 1 - h, x + _EQ_BAR_W,
                                      ch - 1, fill=col, outline='')

        def _eq_tick():
            if not win.winfo_exists(): return
            _eq_phase[0] = (_eq_phase[0] + 0.28) % (_math.pi * 2)
            _draw_eq()
            if self._active:
                _eq_job[0] = win.after(55, _eq_tick)

        def _eq_start():
            if _eq_job[0]: win.after_cancel(_eq_job[0])
            _eq_job[0] = None
            _eq_tick()

        def _eq_stop():
            if _eq_job[0]: win.after_cancel(_eq_job[0])
            _eq_job[0] = None
            _draw_eq()

        _draw_eq()
        if self._active:
            win.after(100, _eq_start)

        # ── Stats row: AVG  ·  DARTS ─────────────────────────────────────
        bot = tk.Frame(pill, bg=CARD)
        bot.pack(fill='x', padx=12, pady=(4, 0))
        _bind_drag(bot)

        avg_f = tk.Frame(bot, bg=CARD)
        avg_f.pack(side='left')
        tk.Label(avg_f, text="AVG", bg=CARD, fg=FG3,
                 font=("Rubik", 6, "bold")).pack(anchor='w')
        avg_val = tk.Label(avg_f, bg=CARD, fg=FG2, font=("Uber Move Bold", 11, "bold"))
        avg_val.pack(anchor='w')

        def _sync_avg(*_): avg_val.config(text=self._avg_str.get())
        self._avg_str.trace_add('write', _sync_avg); _sync_avg()

        drt_f = tk.Frame(bot, bg=CARD)
        drt_f.pack(side='right')
        tk.Label(drt_f, text="DARTS", bg=CARD, fg=FG3,
                 font=("Rubik", 6, "bold")).pack(anchor='e')
        drt_val = tk.Label(drt_f, bg=CARD, fg=FG2, font=("Uber Move Bold", 11, "bold"))
        drt_val.pack(anchor='e')

        def _sync_darts(*_): drt_val.config(text=self._darts_str.get())
        self._darts_str.trace_add('write', _sync_darts); _sync_darts()

        # ── Checkout hint (live X01 only) ─────────────────────────────────
        if is_live:
            co_sep = tk.Frame(pill, bg=SEP, height=1)
            co_sep.pack(fill='x', padx=10, pady=(2, 0))
            co_f = tk.Frame(pill, bg=CARD)
            co_f.pack(fill='x', padx=10, pady=(3, 0))
            _bind_drag(co_f)
            tk.Label(co_f, text="CHECKOUT", bg=CARD, fg=FG3,
                     font=("Rubik", 6, "bold")).pack(side='left')
            co_lbl = tk.Label(co_f, bg=CARD, fg=ACCENT,
                              font=("Uber Move Bold", 11, "bold"))
            co_lbl.pack(side='right')
            _bind_drag(co_lbl)

            def _sync_co(*_): co_lbl.config(text=self._checkout_str.get() or "—")
            self._checkout_str.trace_add('write', _sync_co); _sync_co()

        # ── Action row: Listen + Calibrate ───────────────────────────────
        btn_sep = tk.Frame(pill, bg=SEP, height=1)
        btn_sep.pack(fill='x', padx=10, pady=(5, 0))

        action_row = tk.Frame(pill, bg=CARD)
        action_row.pack(fill='x', padx=10, pady=(4, 0))

        listen_btn = tk.Label(
            action_row,
            text="◼  STOP" if self._active else "▶  START",
            bg=STOP_BG if self._active else ACCENT,
            fg=ACCENT   if self._active else PRI_FG,
            font=("Uber Move Bold", 8, "bold"),
            cursor='hand2', pady=6,
        )
        listen_btn.pack(side='left', fill='x', expand=True, padx=(0, 4))

        cal_btn = tk.Label(
            action_row,
            text="⊕ CALIBRATE",
            bg=CARD, fg=FG2,
            font=("Rubik", 7, "bold"),
            cursor='hand2', pady=6,
            relief='flat',
        )
        cal_btn.pack(side='left')
        cal_btn.bind('<Button-1>', lambda e: (win.withdraw(),
                                              self.after(50, lambda: (self._calibrate_x01(),
                                              win.deiconify()))))
        cal_btn.bind('<Enter>',    lambda e: cal_btn.config(fg=ACCENT))
        cal_btn.bind('<Leave>',    lambda e: cal_btn.config(fg=FG2))

        def _on_listen_click(e):
            self.after(0, self._toggle)
        listen_btn.bind('<Button-1>', _on_listen_click)

        def _update_listen_btn():
            if not win.winfo_exists(): return
            if self._active:
                listen_btn.config(text="◼  STOP", bg=STOP_BG, fg=ACCENT)
            else:
                listen_btn.config(text="▶  START", bg=ACCENT, fg=PRI_FG)

        # ── Diagonal resize grip — placed at corner, always visible ─────────
        _GRIP = 22
        grip = tk.Canvas(pill, width=_GRIP, height=_GRIP, bg=CARD,
                         highlightthickness=0, cursor='size_nw_se')
        grip.place(relx=1.0, rely=1.0, anchor='se')

        def _draw_grip(col):
            grip.delete('all')
            # Solid diagonal triangle
            grip.create_polygon(
                _GRIP, 0, _GRIP, _GRIP, 0, _GRIP,
                fill=col, outline='')
            # Two accent lines for visual clarity
            grip.create_line(_GRIP-4, _GRIP, _GRIP, _GRIP-4, fill=CARD, width=1)
            grip.create_line(_GRIP-9, _GRIP, _GRIP, _GRIP-9, fill=CARD, width=1)

        _draw_grip(FG3)
        grip.bind('<Enter>', lambda e: _draw_grip(ACCENT))
        grip.bind('<Leave>', lambda e: _draw_grip(FG3))

        _rsz = {}
        def _rsz_press(e):
            _rsz['x'] = e.x_root; _rsz['y'] = e.y_root
            _rsz['w'] = win.winfo_width(); _rsz['h'] = win.winfo_height()
        def _rsz_drag(e):
            nw = max(200, _rsz['w'] + e.x_root - _rsz['x'])
            nh = max(80,  _rsz['h'] + e.y_root - _rsz['y'])
            win.geometry(f"{nw}x{nh}")   # pill fills via pack(fill='both')
            if not _collapsed[0]:
                _full_height[0] = nh
        grip.bind('<ButtonPress-1>', _rsz_press)
        grip.bind('<B1-Motion>',     _rsz_drag)

        # ── Body widget list (for collapse/expand) ────────────────────────
        _body_widgets.extend([score_c, eq_c, bot, btn_sep, action_row])

        def _hide_body():
            for w in _body_widgets:
                w.pack_forget()
            if is_live:
                try: co_sep.pack_forget(); co_f.pack_forget()
                except Exception: pass

        def _restore_body():
            score_c.pack(fill='x', padx=10, pady=(2, 0))
            eq_c.pack(fill='x', padx=10, pady=(3, 0))
            bot.pack(fill='x', padx=12, pady=(4, 0))
            if is_live:
                co_sep.pack(fill='x', padx=10, pady=(2, 0))
                co_f.pack(fill='x', padx=10, pady=(3, 0))
            btn_sep.pack(fill='x', padx=10, pady=(5, 0))
            action_row.pack(fill='x', padx=10, pady=(4, 0))

        _full_height[0] = pill_h

        # ── Hook _set_active so PiP stays in sync ─────────────────────────
        _prev_set_active = self._set_active

        def _pip_set_active(active):
            _prev_set_active(active)
            if not win.winfo_exists(): return
            _redraw_mic_dot()
            _redraw_pip()
            _update_listen_btn()
            if active:
                _eq_start()
            else:
                _eq_stop()

        self._set_active = _pip_set_active

    # ── Dartboard FULL BACKGROUND graphic ─────────────────────────────────────
    @staticmethod
    def _draw_dartboard_wire(canvas, w, h):
        cx  = w // 2
        cy  = 55           # Radiate exactly from behind the logo centre
        wire = '#131318'   # Extremely subtle wire colour
        inner = '#1A1A22'  # Slightly brighter for inner rings
        hint = _WIRE_HINT  # Faint accent hint for bullseye rings

        # Concentric rings filling the background
        ring_radii  = [30, 60, 95, 130, 165, 200, 240, 280, 330, 390, 460, 540, 630, 730]
        ring_colors = [hint, hint, inner, wire, inner, wire, wire, wire, wire, wire, wire, wire, wire, wire]
        for r, rc in zip(ring_radii, ring_colors):
            canvas.create_oval(cx-r, cy-r, cx+r, cy+r, outline=rc, width=1)

        # Radial spokes — 20 segments, fan out all 360 degrees
        for i in range(20):
            ang = math.radians(i * 18 - 9)
            ex  = cx + 800 * math.cos(ang)
            ey  = cy + 800 * math.sin(ang)
            canvas.create_line(cx, cy, int(ex), int(ey), fill=wire, width=1)

    # ── Active state ─────────────────────────────────────────────────────────
    def _set_active(self, active):
        self._active = active
        self._redraw_score()
        if hasattr(self, '_redraw_ig'):
            self._redraw_ig()
        if active:
            self._toggle_btn.configure(
                text="STOP LISTENING", fg_color=STOP_BG,
                hover_color=STOP_HOV, text_color=ACCENT,
                border_width=1, border_color=STOP_BDR,
            )
        else:
            self._toggle_btn.configure(
                text="START LISTENING", fg_color=ACCENT,
                hover_color=PRI_HOV, text_color=PRI_FG,
                border_width=0,
            )

    def _pulse(self):
        alive = (self._listener and self._listener.is_alive()) or \
                (self._video_scorer and self._video_scorer.is_alive())
        if hasattr(self, '_dot'):
            col = (ACCENT if int(time.time()*2)%2==0 else ACCENT_DIM) if alive else FG3
            if getattr(self, '_dot_col', None) != col:
                self._dot.configure(text_color=col)
                self._dot_col = col
        self.after(600, self._pulse)

    def _save_mode(self, v):
        self.cfg['game_mode'] = v
        save_config(self.cfg)
        self._session_scores = []
        self._avg_str.set("—")
        self._darts_str.set("0")
    def _save_setting(self, k, v): self.cfg[k] = v; save_config(self.cfg)

    # ── Toggle listener ───────────────────────────────────────────────────────
    def _toggle(self):
        # ── Stop ─────────────────────────────────────────────────────────
        if self._active:
            if self._listener and self._listener.is_alive():
                self._listener.stop(); self._listener = None
            if self._video_scorer and self._video_scorer.is_alive():
                self._video_scorer.stop(); self._video_scorer = None
            self._set_active(False); self._status.set("Ready"); return

        # ── Start ─────────────────────────────────────────────────────────
        mode     = self.cfg.get('game_mode', 'X01')
        video_on = self.cfg.get('video_scoring', False)

        if mode == 'X01' and not self.cfg.get('input_box', {}).get('x'):
            messagebox.showwarning("Calibrate", "Calibrate the X01 box in Settings first."); return
        if mode == 'Cricket' and not self.cfg.get('cricket_grid', {}).get('s20'):
            messagebox.showwarning("Calibrate", "Calibrate the Cricket grid in Settings first."); return

        # ── Init live checkout remaining ───────────────────────────────────
        if self.cfg.get('live_checkout', False) and mode == 'X01' and self._x01_remaining is None:
            self._x01_remaining = self.cfg.get('x01_start', 501)
            self._update_remaining_display()

        if video_on:
            if not self.cfg.get('video_region', {}).get('w'):
                messagebox.showwarning("Video Scoring", "Select a screen region in Settings → Video Scoring first."); return
            self._video_scorer = VideoScorerThread(
                self.cfg['video_region'], self.cfg, self._on_score, self._set_status,
            )
            self._video_scorer.start()
        else:
            if self.cfg.get('mic_index') is None:
                self._select_mic(); return
            self._listener = SpeechListener(
                resource_path(self.cfg['model']), self.cfg['mic_index'],
                self.cfg, self._on_score, self._set_status,
                on_cancel=self._on_cancel,
                on_new_leg=self._on_new_leg,
            )
            self._listener.start()

        self._set_active(True)

    # ── Custom colour picker ──────────────────────────────────────────────────
    def _pick_custom_colour(self, theme_name: str, redraw_cb=None):
        """Open a colour-picker dialog then apply the custom accent."""
        from tkinter import colorchooser
        current = self.cfg.get('custom_accent', '#FFFFFF')
        result  = colorchooser.askcolor(
            color=current,
            title='Pick your accent colour',
            parent=self,
        )
        if result[1] is None:
            return   # cancelled
        chosen = result[1].upper()
        self._save_setting('custom_accent', chosen)
        THEMES['Custom']['accent'] = chosen
        _apply_theme('Custom', chosen)
        self._save_setting('theme', 'Custom')
        if redraw_cb:
            redraw_cb('Custom')
        self._rebuild_ui()
        self.after(50, self._open_settings)

    # ── Settings window ───────────────────────────────────────────────────────
    def _open_settings(self):
        if hasattr(self, '_sw_overlay') and self._sw_overlay.winfo_exists():
            self._sw_overlay.lift(); return

        # ── Full-window dim overlay ───────────────────────────────────────
        ov = tk.Frame(self, bg='#05050A')
        ov.place(x=0, y=0, relwidth=1.0, relheight=1.0)
        ov.lift()
        self._sw_overlay = ov
        ov.update_idletasks()   # paint dim overlay before building content

        def _close():
            if ov.winfo_exists():
                ov.destroy()
            if hasattr(self, '_sw_overlay'):
                del self._sw_overlay

        ov.bind('<Button-1>', lambda e: _close())
        self.bind('<Escape>', lambda e: _close())

        # ── Modal card ────────────────────────────────────────────────────
        modal = ctk.CTkFrame(ov, fg_color=CARD, corner_radius=16,
                             border_width=1, border_color=SEP,
                             width=860, height=540)
        modal.pack_propagate(False)
        modal.place(relx=0.5, rely=0.5, anchor='center')
        modal.update_idletasks()   # paint modal shell before building tabs
        modal.bind('<Button-1>', lambda e: 'break')

        # Footer (packed first so it anchors to bottom)
        footer = ctk.CTkFrame(modal, fg_color=CARD, corner_radius=0, height=58)
        footer.pack(side='bottom', fill='x')
        footer.pack_propagate(False)
        ctk.CTkFrame(footer, fg_color=SEP, height=1, corner_radius=0).pack(fill='x')
        ctk.CTkButton(footer, text="Close",
                      font=("Rubik", 11, "bold"),
                      fg_color='transparent', hover_color=CARD2, text_color=FG2,
                      height=38, corner_radius=8, command=_close
                      ).pack(side='right', padx=16, pady=8)

        # Main area: sidebar | sep | content
        main_area = ctk.CTkFrame(modal, fg_color='transparent', corner_radius=0)
        main_area.pack(fill='both', expand=True)

        sidebar = ctk.CTkFrame(main_area, fg_color=BG, corner_radius=0, width=210)
        sidebar.pack(side='left', fill='y')
        sidebar.pack_propagate(False)

        _sep_bar = ctk.CTkFrame(main_area, fg_color=SEP, width=1, corner_radius=0)
        _sep_bar.pack_propagate(False)
        _sep_bar.pack(side='left', fill='y')

        content_host = ctk.CTkFrame(main_area, fg_color=CARD, corner_radius=0)
        content_host.pack(side='left', fill='both', expand=True)

        # Sidebar title
        ctk.CTkLabel(sidebar, text="Settings", text_color=FG,
                     font=("Uber Move Bold", 17, "bold")
                     ).pack(anchor='w', padx=16, pady=(18, 10))

        # ── Tab management ────────────────────────────────────────────────
        _pages    = {}
        _tab_btns = {}

        def _switch(tab_name):
            for name, page in _pages.items():
                page.lower() if name != tab_name else page.lift()
            for name, btn in _tab_btns.items():
                btn.configure(
                    fg_color=SEP   if name == tab_name else 'transparent',
                    text_color=FG  if name == tab_name else FG2,
                )

        _builders  = {}  # tab_name -> build function, called once on first visit
        _built     = set()

        def _switch_lazy(tab_name):
            if tab_name not in _built:
                _built.add(tab_name)
                if tab_name in _builders:
                    _builders[tab_name]()
            _switch(tab_name)

        def _make_tab(name, label):
            btn = ctk.CTkButton(
                sidebar, text=f"  {label}",
                font=("Rubik", 12, "bold"),
                fg_color='transparent', hover_color=CARD2,
                text_color=FG2, anchor='w', height=38, corner_radius=8,
                command=lambda n=name: _switch_lazy(n),
            )
            btn.pack(fill='x', padx=8, pady=1)
            _tab_btns[name] = btn
            page = ctk.CTkScrollableFrame(
                content_host, fg_color=CARD, corner_radius=0,
                scrollbar_button_color=SEP,
                scrollbar_button_hover_color=FG3,
            )
            page.place(x=0, y=0, relwidth=1.0, relheight=1.0)
            _pages[name] = page
            return page

        p_audio    = _make_tab('audio',    'Audio & Mic')
        p_appear   = _make_tab('appear',   'Appearance')
        p_gameplay = _make_tab('gameplay', 'Gameplay')
        p_video    = _make_tab('video',    'Video Scoring')
        p_record   = _make_tab('record',   'Recordings')

        # ── Shared widget helpers ─────────────────────────────────────────
        def _section(parent, text):
            row = ctk.CTkFrame(parent, fg_color='transparent')
            row.pack(fill='x', padx=24, pady=(18, 6))
            ctk.CTkFrame(row, fg_color=ACCENT, width=3, height=14,
                         corner_radius=2).pack(side='left', padx=(0, 8))
            ctk.CTkLabel(row, text=text, text_color=FG2,
                         font=("Rubik", 8, "bold")).pack(side='left')

        def _switch_row(parent, label, sublabel, var, cmd):
            row = ctk.CTkFrame(parent, fg_color=BG, corner_radius=10,
                               border_width=1, border_color=SEP)
            row.pack(fill='x', padx=24, pady=(0, 6))
            txt = ctk.CTkFrame(row, fg_color='transparent')
            txt.pack(side='left', fill='x', expand=True, padx=14, pady=10)
            ctk.CTkLabel(txt, text=label, text_color=FG,
                         font=("Rubik", 12, "bold")).pack(anchor='w')
            if sublabel:
                ctk.CTkLabel(txt, text=sublabel, text_color=FG2,
                             font=("Rubik", 9)).pack(anchor='w')
            ctk.CTkSwitch(row, variable=var, text='',
                          fg_color=SEP, progress_color=ACCENT,
                          command=cmd, width=48,
                          ).pack(side='right', padx=14)

        def _option_menu(parent, var, values, cmd):
            ctk.CTkOptionMenu(
                parent, variable=var, values=values,
                font=("Rubik", 11),
                fg_color=BG, button_color=ACCENT_DIM, button_hover_color=ACCENT,
                text_color=FG, dropdown_fg_color=CARD, dropdown_text_color=FG,
                dropdown_hover_color=CARD2, corner_radius=10, height=44,
                command=cmd,
            ).pack(fill='x', padx=24, pady=(0, 6))

        def _action_btn(parent, label, cmd):
            ctk.CTkButton(
                parent, text=label, font=("Rubik", 11),
                fg_color=CARD2, hover_color=SEP, text_color=FG,
                border_width=1, border_color=SEP,
                height=40, corner_radius=10, command=cmd,
            ).pack(fill='x', padx=24, pady=(0, 6))

        def _slider_row(parent, label, var, from_, to_, steps, unit, save_key):
            ctk.CTkLabel(parent, text=label, text_color=FG2,
                         font=("Rubik", 9)).pack(anchor='w', padx=24, pady=(4, 0))
            val_lbl = ctk.CTkLabel(parent, text=f"{var.get()} {unit}",
                                   text_color=FG, font=("Rubik", 11, "bold"))
            val_lbl.pack(anchor='e', padx=24)
            ctk.CTkSlider(
                parent, from_=from_, to=to_, variable=var, number_of_steps=steps,
                fg_color=SEP, progress_color=ACCENT_DIM,
                button_color=ACCENT, button_hover_color=PRI_HOV,
                command=lambda v, vl=val_lbl, u=unit, sk=save_key: [
                    self._save_setting(sk, int(v)),
                    vl.configure(text=f"{int(v)} {u}"),
                ],
            ).pack(fill='x', padx=24, pady=(0, 4))

        # ══════════════════════════════ AUDIO TAB ════════════════════════

        # ── Quick-setup strip: Mic + Scoring Mode ─────────────────────────
        quick_row = ctk.CTkFrame(p_audio, fg_color='transparent')
        quick_row.pack(fill='x', padx=24, pady=(14, 4))

        # Mic tile
        mic_tile = ctk.CTkFrame(quick_row, fg_color=BG, corner_radius=12,
                                border_width=1, border_color=SEP)
        mic_tile.pack(side='left', fill='both', expand=True, padx=(0, 6))
        ctk.CTkLabel(mic_tile, text="🎙  MICROPHONE", text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(anchor='w', padx=12, pady=(10, 2))

        # Use pre-scanned mic list (populated at startup in background thread)
        _mic_cache = self._cached_mic_list or (['Default'], {0: None})
        qs_mic_labels, qs_mic_index_map = _mic_cache[0][:], dict(_mic_cache[1])

        _qs_cur_lbl = 'Default'
        for _li2, _di2 in qs_mic_index_map.items():
            if _di2 == self.cfg.get('mic_index') and _li2 > 0:
                _qs_cur_lbl = qs_mic_labels[_li2]; break

        qs_mic_var = ctk.StringVar(value=_qs_cur_lbl)
        def _qs_on_mic(label):
            for _li2, _name2 in enumerate(qs_mic_labels):
                if _name2 == label:
                    self.cfg['mic_index'] = qs_mic_index_map.get(_li2)
                    save_config(self.cfg); break
        ctk.CTkOptionMenu(
            mic_tile, variable=qs_mic_var, values=qs_mic_labels,
            font=("Rubik", 10),
            fg_color=CARD2, button_color=ACCENT_DIM, button_hover_color=ACCENT,
            text_color=FG, dropdown_fg_color=CARD, dropdown_text_color=FG,
            dropdown_hover_color=CARD2, corner_radius=8, height=36,
            command=_qs_on_mic,
        ).pack(fill='x', padx=8, pady=(0, 10))

        # Scoring mode tile
        mode_tile = ctk.CTkFrame(quick_row, fg_color=BG, corner_radius=12,
                                 border_width=1, border_color=SEP)
        mode_tile.pack(side='left', fill='both', expand=True)
        ctk.CTkLabel(mode_tile, text="🎯  SCORING MODE", text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(anchor='w', padx=12, pady=(10, 2))

        seg_frame = ctk.CTkFrame(mode_tile, fg_color='transparent')
        seg_frame.pack(fill='x', padx=8, pady=(0, 10))
        _pd_active = self.cfg.get('per_dart_mode', False)

        def _make_seg_btn(parent, label, is_active_fn, on_click):
            b = ctk.CTkButton(
                parent, text=label, font=("Rubik", 10, "bold"),
                height=36, corner_radius=8,
                fg_color=ACCENT if is_active_fn() else CARD2,
                hover_color=PRI_HOV if is_active_fn() else SEP,
                text_color=PRI_FG if is_active_fn() else FG2,
                command=on_click,
            )
            return b

        def _set_mode(per_dart: bool):
            self._save_setting('per_dart_mode', per_dart)
            btn_per.configure(
                fg_color=ACCENT if per_dart else CARD2,
                hover_color=PRI_HOV if per_dart else SEP,
                text_color=PRI_FG if per_dart else FG2,
            )
            btn_3d.configure(
                fg_color=ACCENT if not per_dart else CARD2,
                hover_color=PRI_HOV if not per_dart else SEP,
                text_color=PRI_FG if not per_dart else FG2,
            )

        btn_per = ctk.CTkButton(
            seg_frame, text="Per Dart", font=("Rubik", 10, "bold"),
            height=36, corner_radius=8,
            fg_color=ACCENT if _pd_active else CARD2,
            hover_color=PRI_HOV if _pd_active else SEP,
            text_color=PRI_FG if _pd_active else FG2,
            command=lambda: _set_mode(True),
        )
        btn_per.pack(side='left', fill='x', expand=True, padx=(0, 4))

        btn_3d = ctk.CTkButton(
            seg_frame, text="3 Darts", font=("Rubik", 10, "bold"),
            height=36, corner_radius=8,
            fg_color=ACCENT if not _pd_active else CARD2,
            hover_color=PRI_HOV if not _pd_active else SEP,
            text_color=PRI_FG if not _pd_active else FG2,
            command=lambda: _set_mode(False),
        )
        btn_3d.pack(side='left', fill='x', expand=True)

        _section(p_audio, "MICROPHONE DEVICE")

        _mic_cache2 = self._cached_mic_list or (['Default'], {0: None})
        mic_labels, mic_index_map = _mic_cache2[0][:], dict(_mic_cache2[1])

        cur_mic_idx   = self.cfg.get('mic_index')
        cur_mic_label = 'Default'
        for _li, _di in mic_index_map.items():
            if _di == cur_mic_idx and _li > 0:
                cur_mic_label = mic_labels[_li]; break

        mic_var = ctk.StringVar(value=cur_mic_label)

        def _on_mic_change(label):
            for _li, _name in enumerate(mic_labels):
                if _name == label:
                    self.cfg['mic_index'] = mic_index_map.get(_li)
                    save_config(self.cfg); break

        ctk.CTkOptionMenu(
            p_audio, variable=mic_var, values=mic_labels,
            font=("Rubik", 11),
            fg_color=BG, button_color=ACCENT_DIM, button_hover_color=ACCENT,
            text_color=FG, dropdown_fg_color=CARD, dropdown_text_color=FG,
            dropdown_hover_color=CARD2, corner_radius=10, height=44,
            command=_on_mic_change,
        ).pack(fill='x', padx=24, pady=(0, 6))

        _section(p_audio, "VOICE ASSISTANT")
        vc_var = ctk.BooleanVar(value=self.cfg.get('voice_confirm', True))
        _switch_row(p_audio, "Read back scores (TTS)",
                    "App will say the score out loud",
                    vc_var,
                    lambda: self._save_setting('voice_confirm', vc_var.get()))

        va_var = ctk.BooleanVar(value=self.cfg.get('voice_assist', False))
        _switch_row(p_audio, "Enable voice assistant", '',
                    va_var,
                    lambda: self._save_setting('voice_assist', va_var.get()))

        vs_var = ctk.BooleanVar(value=self.cfg.get('voice_stats', True))
        _switch_row(p_audio, "Announce session average (X01)", '',
                    vs_var,
                    lambda: self._save_setting('voice_stats', vs_var.get()))

        _section(p_audio, "VOICE VOLUME")
        vv2 = ctk.DoubleVar(value=self.cfg.get('voice_volume', 0.9))
        vol_lbl = ctk.CTkLabel(p_audio, text=f"{int(vv2.get()*100)}%",
                               text_color=FG, font=("Rubik", 11, "bold"))
        vol_lbl.pack(anchor='e', padx=24)
        ctk.CTkSlider(
            p_audio, from_=0.1, to=1.0, variable=vv2,
            fg_color=SEP, progress_color=ACCENT,
            button_color=ACCENT, button_hover_color=PRI_HOV,
            command=lambda v, vl=vol_lbl: [
                self._save_setting('voice_volume', round(float(v), 2)),
                vl.configure(text=f"{int(float(v)*100)}%"),
            ],
        ).pack(fill='x', padx=24, pady=(0, 6))

        _section(p_audio, "SPEECH SPEED")
        vr = ctk.IntVar(value=self.cfg.get('voice_rate', 170))
        rate_lbl = ctk.CTkLabel(p_audio, text=f"{vr.get()} wpm",
                                text_color=FG, font=("Rubik", 11, "bold"))
        rate_lbl.pack(anchor='e', padx=24)
        ctk.CTkSlider(
            p_audio, from_=100, to=250, variable=vr,
            fg_color=SEP, progress_color=ACCENT,
            button_color=ACCENT, button_hover_color=PRI_HOV,
            command=lambda v, rl=rate_lbl: [
                self._save_setting('voice_rate', int(v)),
                rl.configure(text=f"{int(v)} wpm"),
            ],
        ).pack(fill='x', padx=24, pady=(0, 6))

        _action_btn(p_audio, "Test Voice",
                    lambda: speak("One hundred and eighty!", self.cfg))

        _section(p_audio, "TRIGGER WORD")
        rv = ctk.BooleanVar(value=self.cfg.get('require_trigger', True))
        _switch_row(p_audio, "Require trigger word", '',
                    rv,
                    lambda: self._save_setting('require_trigger', rv.get()))
        te = ctk.CTkEntry(p_audio, font=("Rubik", 12), fg_color=BG,
                          border_color=SEP, text_color=FG,
                          justify='center', height=40, corner_radius=10)
        te.insert(0, self.cfg.get('trigger', 'score'))
        te.pack(fill='x', padx=24, pady=(0, 6))
        te.bind('<KeyRelease>',
                lambda e: self._save_setting('trigger', te.get().strip().lower()))

        _section(p_audio, "CANCEL WORD")
        ctk.CTkLabel(p_audio, text='Say to undo last dart / score',
                     text_color=FG2, font=("Rubik", 9)
                     ).pack(anchor='w', padx=24, pady=(0, 2))
        cw_entry = ctk.CTkEntry(p_audio, font=("Rubik", 12), fg_color=BG,
                                border_color=SEP, text_color=FG,
                                justify='center', height=40, corner_radius=10)
        cw_entry.insert(0, self.cfg.get('cancel_word', 'wait'))
        cw_entry.pack(fill='x', padx=24, pady=(0, 6))
        cw_entry.bind('<KeyRelease>',
                      lambda e: self._save_setting('cancel_word',
                                                   cw_entry.get().strip().lower()))

        _section(p_audio, "TYPING SPEED")
        sv = ctk.StringVar(value=self.cfg.get('speed', 'Fast'))
        _option_menu(p_audio, sv, ['Lightning', 'Fast', 'Normal', 'Slow'],
                     lambda v: self._save_setting('speed', v))

        # ══════════════════════════ GAMEPLAY TAB ═════════════════════════
        def _build_gameplay():
            _section(p_gameplay, "X01 GAME TRACKING")

            pd_var = ctk.BooleanVar(value=self.cfg.get('per_dart_mode', False))
            _switch_row(p_gameplay, "Per-dart scoring",
                        "Say each dart individually",
                        pd_var,
                        lambda: self._save_setting('per_dart_mode', pd_var.get()))

            lc_var = ctk.BooleanVar(value=self.cfg.get('live_checkout', False))

            def _toggle_live_checkout():
                self._save_setting('live_checkout', lc_var.get())
                self._x01_remaining = None
                self._update_remaining_display()
                self._rebuild_ui()
                _close()
                self.after(80, self._open_settings)

            _switch_row(p_gameplay, "Live checkout tracking",
                        "Show remaining + route",
                        lc_var, _toggle_live_checkout)

            _section(p_gameplay, "STARTING SCORE")
            start_var = ctk.StringVar(value=str(self.cfg.get('x01_start', 501)))
            _option_menu(p_gameplay, start_var, ['501', '301', '701', '170'],
                         lambda v: self._save_setting('x01_start', int(v)))

            ctk.CTkLabel(p_gameplay,
                         text='Say "new leg" at any time to reset the counter.',
                         text_color=FG3, font=("Rubik", 9), justify='left'
                         ).pack(anchor='w', padx=24, pady=(0, 6))

            _section(p_gameplay, "CALIBRATION")
            _action_btn(p_gameplay, "Calibrate X01 Box",       self._calibrate_x01)
            _action_btn(p_gameplay, "Calibrate Cricket Grid",   self._calibrate_cricket)

            _section(p_gameplay, "CRICKET GRID FINE-TUNING")

            cas_var2 = ctk.BooleanVar(value=self.cfg.get('cricket_auto_submit', True))
            _switch_row(p_gameplay, "Auto-submit after entering darts", '',
                        cas_var2,
                        lambda: self._save_setting('cricket_auto_submit', cas_var2.get()))

            cib_var2 = ctk.BooleanVar(value=self.cfg.get('cricket_include_bull', True))
            _switch_row(p_gameplay, "Include Bull row (7 rows)", '',
                        cib_var2,
                        lambda: self._save_setting('cricket_include_bull', cib_var2.get()))

            cox_v = ctk.IntVar(value=self.cfg.get('cricket_offset_x', 0))
            coy_v = ctk.IntVar(value=self.cfg.get('cricket_offset_y', 0))
            ccd_v = ctk.IntVar(value=self.cfg.get('cricket_click_delay', 0))
            _slider_row(p_gameplay, "Grid offset X (pixels)",  cox_v, -50,  50,  100, 'px', 'cricket_offset_x')
            _slider_row(p_gameplay, "Grid offset Y (pixels)",  coy_v, -50,  50,  100, 'px', 'cricket_offset_y')
            _slider_row(p_gameplay, "Extra click delay (ms)",  ccd_v,   0, 500,   50, 'ms', 'cricket_click_delay')

            ctk.CTkLabel(p_gameplay,
                         text='Adjust offsets if clicks land slightly off.\n'
                              'Increase delay if your scoring app misses clicks.',
                         text_color=FG3, font=("Rubik", 9), justify='left'
                         ).pack(anchor='w', padx=24, pady=(4, 16))

        _builders['gameplay'] = _build_gameplay

        # ══════════════════════════ VIDEO SCORING TAB ════════════════════
        def _build_video():
            _section(p_video, "VIDEO SCORING")

            vv = ctk.BooleanVar(value=self.cfg.get('video_scoring', False))
            _switch_row(p_video, "Use screen-capture instead of mic", '',
                        vv,
                        lambda: self._save_setting('video_scoring', vv.get()))

            region = self.cfg.get('video_region', {})
            region_lbl_text = (f"Region: {region['w']}x{region['h']} at ({region['x']},{region['y']})"
                               if region.get('w') else "No region selected")
            region_info = ctk.CTkLabel(p_video, text=region_lbl_text,
                                       text_color=FG2, font=("Rubik", 9))
            region_info.pack(anchor='w', padx=24, pady=(0, 4))

            def _select_region():
                self._calibrate_video_region()
                def _poll():
                    r = self.cfg.get('video_region', {})
                    if r.get('w'):
                        region_info.configure(
                            text=f"Region: {r['w']}x{r['h']} at ({r['x']},{r['y']})")
                ov.after(500, _poll)

            _action_btn(p_video, "Select Camera Region  (drag)", _select_region)
            _action_btn(p_video, "Calibrate Board in Video",      self._calibrate_video_board)
            _action_btn(p_video, "Show Video Debug",              self._open_video_debug)

            cal = self.cfg.get('video_board_cal', {})
            cal_text = (f"Board calibrated  v={cal['r_v']:.0f}  h={cal['r_h']:.0f}  "
                        f"rot={cal.get('rot', 0):.1f}") if cal.get('r_v') else "Board not calibrated"
            ctk.CTkLabel(p_video, text=cal_text, text_color=FG2,
                         font=("Rubik", 9)).pack(anchor='w', padx=24, pady=(0, 6))

            _section(p_video, "DEVELOPER")
            try:
                from billing import is_admin_unlocked, admin_unlock, admin_lock
                _is_admin = is_admin_unlocked()
            except ImportError:
                _is_admin = False

            admin_status_var = ctk.StringVar(
                value="Admin mode: ON" if _is_admin else "Admin mode: OFF")
            ctk.CTkLabel(p_video, textvariable=admin_status_var,
                         text_color=FG3, font=("Rubik", 9)
                         ).pack(anchor='w', padx=24, pady=(0, 4))

            admin_entry = ctk.CTkEntry(p_video, placeholder_text="Enter admin passcode",
                                       show='*', fg_color=BG, border_color=SEP,
                                       text_color=FG, font=("Rubik", 11), height=34,
                                       corner_radius=8)
            admin_entry.pack(fill='x', padx=24, pady=(0, 6))

            def _toggle_admin():
                try:
                    from billing import is_admin_unlocked, admin_unlock, admin_lock
                except ImportError:
                    return
                if is_admin_unlocked():
                    admin_lock()
                    admin_status_var.set("Admin mode: OFF")
                    admin_entry.delete(0, 'end')
                else:
                    code = admin_entry.get().strip()
                    if admin_unlock(code):
                        admin_status_var.set("Admin mode: ON")
                        admin_entry.delete(0, 'end')
                    else:
                        admin_status_var.set("Wrong passcode")

            ctk.CTkButton(p_video, text="Toggle Admin Mode",
                          fg_color=CARD2, hover_color=SEP, text_color=FG2,
                          height=32, corner_radius=8, border_width=1, border_color=SEP,
                          font=("Rubik", 10, "bold"),
                          command=_toggle_admin,
                          ).pack(fill='x', padx=24, pady=(0, 16))

        _builders['video'] = _build_video

        # ══════════════════════ APPEARANCE TAB (full) ════════════════════
        def _build_appear():
            _section(p_appear, "COLOUR THEME")

            theme_names   = list(THEMES.keys())
            current_theme = self.cfg.get('theme', 'Littler')
            self._theme_indicators = {}

            theme_frame = ctk.CTkFrame(p_appear, fg_color='transparent')
            theme_frame.pack(fill='x', padx=24, pady=(0, 4))

            def _effective_accent(name):
                t = THEMES[name]
                return self.cfg.get('custom_accent', '#FFFFFF') if t.get('_custom') else t['accent']

            def _redraw_dots(active_name):
                for sn, (dc, lbl) in self._theme_indicators.items():
                    sel = (sn == active_name)
                    dc.delete('ring')
                    dc.create_oval(2, 2, 22, 22,
                                   fill=_effective_accent(sn),
                                   outline=FG if sel else SEP,
                                   width=2, tags='ring')
                    lbl.configure(text_color=FG if sel else FG3)

            def _pick(n):
                if THEMES[n].get('_custom'):
                    _close()
                    from tkinter import colorchooser
                    result = colorchooser.askcolor(
                        color=self.cfg.get('custom_accent', '#FFFFFF'),
                        title='Pick your accent colour', parent=self)
                    if result[1] is None:
                        self.after(60, self._open_settings); return
                    chosen = result[1].upper()
                    self._save_setting('custom_accent', chosen)
                    THEMES['Custom']['accent'] = chosen
                    _apply_theme('Custom', chosen)
                    self._save_setting('theme', 'Custom')
                    self._rebuild_ui()
                    self.after(60, self._open_settings)
                    return
                _apply_theme(n)
                self._save_setting('theme', n)
                _redraw_dots(n)
                self._rebuild_ui()
                _close()
                self.after(80, self._open_settings)

            cols = 3
            for i, name in enumerate(theme_names):
                t       = THEMES[name]
                col_idx = i % cols
                row_idx = i // cols
                swatch  = ctk.CTkFrame(theme_frame, fg_color='transparent',
                                       width=88, height=62, cursor='hand2')
                swatch.grid(row=row_idx, column=col_idx, padx=4, pady=4, sticky='nsew')
                swatch.grid_propagate(False)
                theme_frame.grid_columnconfigure(col_idx, weight=1)
                dot_c = tk.Canvas(swatch, width=24, height=24, bg=BG, highlightthickness=0)
                dot_c.pack(pady=(6, 0))
                sel = (name == current_theme)
                dot_c.create_oval(2, 2, 22, 22,
                                  fill=_effective_accent(name),
                                  outline=FG if sel else SEP,
                                  width=2, tags='ring')
                surname = t['player'].split()[-1] if not t.get('_custom') else 'Custom'
                lbl = ctk.CTkLabel(swatch, text=surname,
                                   text_color=FG if sel else FG3,
                                   font=("Rubik", 8))
                lbl.pack(pady=(1, 0))
                self._theme_indicators[name] = (dot_c, lbl)
                for w in (swatch, dot_c, lbl):
                    w.bind('<Button-1>', lambda e, n=name: _pick(n))

            _section(p_appear, "GHOST MODE")

            aot_var = ctk.BooleanVar(value=self.cfg.get('always_on_top', True))

            def _toggle_aot():
                v = aot_var.get()
                self._save_setting('always_on_top', v)
                self.attributes('-topmost', v)

            _switch_row(p_appear, "Always on Top",
                        "Keep DartVoice above all other windows",
                        aot_var, _toggle_aot)

            _section(p_appear, "WINDOW OPACITY")
            op_var = ctk.DoubleVar(value=self.cfg.get('ghost_opacity', 1.0))
            op_lbl = ctk.CTkLabel(p_appear, text=f"{int(op_var.get()*100)}%",
                                  text_color=FG, font=("Rubik", 11, "bold"))
            op_lbl.pack(anchor='e', padx=24)
            ctk.CTkSlider(
                p_appear, from_=0.3, to=1.0, variable=op_var,
                fg_color=SEP, progress_color=ACCENT,
                button_color=ACCENT, button_hover_color=PRI_HOV,
                command=lambda v, ol=op_lbl: [
                    self._save_setting('ghost_opacity', round(float(v), 2)),
                    self.attributes('-alpha', float(v)),
                    ol.configure(text=f"{int(float(v)*100)}%"),
                ],
            ).pack(fill='x', padx=24, pady=(0, 4))
            ctk.CTkLabel(p_appear,
                         text="Drag left to see through the window (\"Ghost Mode\").",
                         text_color=FG3, font=("Rubik", 9), justify='left'
                         ).pack(anchor='w', padx=24, pady=(0, 16))

        _builders['appear'] = _build_appear

        # ══════════════════════════ RECORDINGS TAB ═══════════════════════
        def _build_record():
            import os

            _section(p_record, "SAVE LOCATION")
            save_dir = self.cfg.get('rec_save_dir', '') or os.path.join(
                os.path.expanduser('~'), 'Videos', 'DartVoice')
            dir_var = ctk.StringVar(value=save_dir)

            dir_frame = ctk.CTkFrame(p_record, fg_color='transparent')
            dir_frame.pack(fill='x', padx=24, pady=(0, 6))
            ctk.CTkEntry(
                dir_frame, textvariable=dir_var, font=("Rubik", 10),
                fg_color=BG, border_color=SEP, text_color=FG2,
                height=34, corner_radius=8,
            ).pack(side='left', fill='x', expand=True, padx=(0, 6))

            def _pick_dir():
                from tkinter import filedialog
                chosen = filedialog.askdirectory(
                    title="Choose recordings folder",
                    initialdir=dir_var.get() if os.path.isdir(dir_var.get()) else os.path.expanduser('~'))
                if chosen:
                    dir_var.set(chosen)
                    self._save_setting('rec_save_dir', chosen)

            ctk.CTkButton(
                dir_frame, text="Browse", width=72,
                fg_color=CARD2, hover_color=SEP, text_color=FG,
                height=34, corner_radius=8, border_width=1, border_color=SEP,
                command=_pick_dir,
            ).pack(side='left')

            _section(p_record, "AUDIO")
            mic_var = ctk.BooleanVar(value=self.cfg.get('rec_mic', False))
            _switch_row(p_record, "Record microphone audio",
                        "Requires pyaudio + ffmpeg installed",
                        mic_var,
                        lambda: self._save_setting('rec_mic', mic_var.get()))

            _section(p_record, "QUALITY")
            fps_var = ctk.StringVar(value=str(self.cfg.get('rec_fps', 30)))
            _option_menu(p_record, fps_var, ['15', '24', '30', '60'],
                         lambda v: self._save_setting('rec_fps', int(v)))

            _section(p_record, "SAVED RECORDINGS")

            rec_list_frame = ctk.CTkScrollableFrame(
                p_record, fg_color=BG, corner_radius=10,
                border_width=1, border_color=SEP, height=220)
            rec_list_frame.pack(fill='x', padx=24, pady=(0, 8))

            def _refresh_recordings():
                for w in rec_list_frame.winfo_children():
                    w.destroy()
                d = dir_var.get()
                if not os.path.isdir(d):
                    ctk.CTkLabel(rec_list_frame, text="Folder not found",
                                 text_color=FG3, font=("Rubik", 10)).pack(pady=12)
                    return
                files = sorted(
                    [f for f in os.listdir(d) if f.startswith('DartVoice_') and f.endswith('.mp4')],
                    reverse=True)
                if not files:
                    ctk.CTkLabel(rec_list_frame, text="No recordings yet",
                                 text_color=FG3, font=("Rubik", 10)).pack(pady=12)
                    return
                for fname in files:
                    fpath = os.path.join(d, fname)
                    try:
                        size_mb = os.path.getsize(fpath) / (1024 * 1024)
                        size_str = f"{size_mb:.1f} MB"
                    except Exception:
                        size_str = ""
                    row = ctk.CTkFrame(rec_list_frame, fg_color='transparent')
                    row.pack(fill='x', pady=1)
                    ctk.CTkLabel(row, text=fname, text_color=FG,
                                 font=("Rubik", 10), anchor='w').pack(
                        side='left', fill='x', expand=True, padx=(4, 0))
                    ctk.CTkLabel(row, text=size_str, text_color=FG3,
                                 font=("Rubik", 9)).pack(side='left', padx=4)
                    ctk.CTkButton(
                        row, text="▶", width=28, height=26, corner_radius=6,
                        fg_color=CARD2, hover_color=SEP, text_color=FG,
                        command=lambda p=fpath: os.startfile(p),
                    ).pack(side='left', padx=1)
                    ctk.CTkButton(
                        row, text="📁", width=28, height=26, corner_radius=6,
                        fg_color=CARD2, hover_color=SEP, text_color=FG,
                        command=lambda p=fpath: os.startfile(os.path.dirname(p)),
                    ).pack(side='left', padx=1)
                    def _del(p=fpath):
                        from tkinter import messagebox
                        if messagebox.askyesno("Delete", f"Delete {os.path.basename(p)}?"):
                            try: os.remove(p)
                            except Exception: pass
                            _refresh_recordings()
                    ctk.CTkButton(
                        row, text="✕", width=28, height=26, corner_radius=6,
                        fg_color='#2A0000', hover_color='#440000', text_color='#FF6666',
                        command=_del,
                    ).pack(side='left', padx=(1, 4))

            _refresh_recordings()

            ctk.CTkButton(
                p_record, text="↺  Refresh", height=32, corner_radius=8,
                fg_color=CARD2, hover_color=SEP, text_color=FG2,
                border_width=1, border_color=SEP,
                command=_refresh_recordings,
            ).pack(fill='x', padx=24, pady=(0, 6))

            _action_btn(p_record, "Open Recordings Folder",
                        lambda: (os.makedirs(dir_var.get(), exist_ok=True),
                                 os.startfile(dir_var.get())))

        _builders['record'] = _build_record

        # ── Activate first tab ────────────────────────────────────────────
        _switch_lazy('audio')

    # ── Mic selector ─────────────────────────────────────────────────────────
    def _select_mic(self):
        # Use cached mic list to avoid blocking the UI thread
        _mc = self._cached_mic_list or (['Default'], {0: None})
        _labels, _idx_map = _mc
        # Build (device_index, name) pairs matching the cache
        mic_data = [(v, _labels[k]) for k, v in _idx_map.items() if v is not None]
        if not mic_data:
            mic_data = [(None, 'Default')]

        win = ctk.CTkToplevel(self)
        win.title("Select Microphone")
        win.geometry(self._right_of(400, 460))
        win.configure(fg_color=BG)
        win.attributes('-topmost', True)
        win.resizable(False, False)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        # ── Top accent bar ────────────────────────────────────────────────
        ctk.CTkFrame(win, fg_color=ACCENT, height=3, corner_radius=0).pack(fill='x')

        # Header
        hdr = ctk.CTkFrame(win, fg_color=CARD, corner_radius=0, height=52)
        hdr.pack(fill='x')
        hdr.pack_propagate(False)
        lc = tk.Canvas(hdr, width=22, height=22, bg=CARD, highlightthickness=0)
        lc.place(x=24, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 11, 11, [9, 6, 3, 1])
        ctk.CTkLabel(hdr, text="  SELECT MICROPHONE", text_color=FG,
                     font=("Uber Move Bold", 14, "bold")).place(x=50, rely=0.5, anchor='w')
        ctk.CTkLabel(hdr, text="Pick the mic closest to the board", text_color=FG2,
                     font=("Rubik", 9)).place(relx=1.0, x=-16, rely=0.5, anchor='e')
        ctk.CTkFrame(win, fg_color=SEP, height=1).pack(fill='x')

        # Scrollable mic list
        scroll = ctk.CTkScrollableFrame(win, fg_color=CARD, corner_radius=8,
                                         scrollbar_button_color=SEP,
                                         scrollbar_button_hover_color=FG3)
        scroll.pack(fill='both', expand=True, padx=24, pady=(12, 0))

        selected_idx = tk.IntVar(value=-1)

        def _make_row(idx, name):
            row = ctk.CTkFrame(scroll, fg_color='transparent', cursor='hand2')
            row.pack(fill='x', pady=1)

            num_lbl = ctk.CTkLabel(row, text=f"{idx}", text_color=FG3,
                                   font=("Rubik", 10), width=28)
            num_lbl.pack(side='left', padx=(6, 0))

            name_lbl = ctk.CTkLabel(row, text=name, text_color=FG2,
                                    font=("Rubik", 11), anchor='w')
            name_lbl.pack(side='left', fill='x', expand=True, padx=(4, 8), pady=10)

            def _select(i=idx, r=row, nl=name_lbl, numl=num_lbl):
                selected_idx.set(i)
                for child in scroll.winfo_children():
                    child.configure(fg_color='transparent')
                    for w in child.winfo_children():
                        try:
                            w.configure(text_color=FG2)
                        except Exception:
                            pass
                r.configure(fg_color=CARD2)
                nl.configure(text_color=FG)
                numl.configure(text_color=ACCENT)

            row.bind('<Button-1>', lambda _: _select())
            name_lbl.bind('<Button-1>', lambda _: _select())
            num_lbl.bind('<Button-1>', lambda _: _select())

        for idx, name in mic_data:
            _make_row(idx, name)

        # Confirm
        def _confirm():
            if selected_idx.get() >= 0:
                self.cfg['mic_index'] = selected_idx.get()
                save_config(self.cfg); win.destroy()
                if self._listener is None: self._toggle()

        ctk.CTkButton(win, text="CONFIRM MICROPHONE",
                      font=("Uber Move Bold", 12, "bold"),
                      fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
                      height=46, corner_radius=10, command=_confirm
                      ).pack(fill='x', padx=24, pady=14)

    # ── Video debug preview ─────────────────────────────────────────────────
    def _open_video_debug(self):
        """Live debug window — shows captured frame with board overlay +
        detected tip positions so the user can verify accuracy."""
        if hasattr(self, '_vdw') and self._vdw.winfo_exists():
            self._vdw.focus(); return
        region = self.cfg.get('video_region', {})
        if not region.get('w'):
            messagebox.showinfo("Video Debug", "No video region set."); return
        if not self._video_scorer:
            messagebox.showinfo("Video Debug",
                                "Start listening with video scoring first."); return

        win = ctk.CTkToplevel(self)
        self._vdw = win
        rw, rh = region['w'], region['h']
        win.title("Video Debug")
        win.geometry(f"{rw}x{rh}")
        win.configure(fg_color=BG)
        win.attributes('-topmost', True)
        win.resizable(True, True)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        cv = tk.Canvas(win, width=rw, height=rh,
                       bg='#111111', highlightthickness=0)
        cv.pack(fill='both', expand=True)

        def _poll():
            if not win.winfo_exists(): return
            vs = self._video_scorer
            if vs and vs.debug_img:
                try:
                    from PIL import ImageTk
                    self._vd_tkimg = ImageTk.PhotoImage(vs.debug_img)
                    cv.delete('all')
                    cv.create_image(0, 0, anchor='nw', image=self._vd_tkimg)
                except Exception:
                    pass
            win.after(200, _poll)
        _poll()

    # ── Video calibration ────────────────────────────────────────────────────
    def _calibrate_video_region(self):
        if hasattr(self, '_sw') and self._sw.winfo_exists(): self._sw.withdraw()
        self.withdraw()
        def done(region):
            self._save_setting('video_region', region)
            self.deiconify()
            if hasattr(self, '_sw') and self._sw.winfo_exists(): self._sw.deiconify()
            self._status.set(f"Region set  {region['w']}×{region['h']}")
        ScreenRegionSelector(self, done)

    def _calibrate_video_board(self):
        region = self.cfg.get('video_region', {})
        if not region.get('w'):
            messagebox.showwarning("Video Scoring", "Select a screen region first."); return
        def done(cal):
            self._save_setting('video_board_cal', cal)
            self._status.set("Board calibrated")
        VideoBoardCalibrator(self, region, done)

    # ── Calibration ──────────────────────────────────────────────────────────
    def _calibrate_x01(self):
        if hasattr(self, '_sw') and self._sw.winfo_exists(): self._sw.withdraw()
        self.withdraw()
        def done(c):
            self._save_setting('input_box', c); self.deiconify()
            if hasattr(self, '_sw') and self._sw.winfo_exists(): self._sw.deiconify()
            self._status.set("X01 box saved")
        X01CalibrationWizard(self, done)

    def _calibrate_cricket(self):
        if hasattr(self, '_sw') and self._sw.winfo_exists(): self._sw.withdraw()
        self.withdraw()
        def done(c):
            self._save_setting('cricket_grid', c); self.deiconify()
            if hasattr(self, '_sw') and self._sw.winfo_exists(): self._sw.deiconify()
            self._status.set("Cricket grid saved")
        CricketCalibrationWizard(self, done)

    # ── Score / status callbacks ──────────────────────────────────────────────
    def _on_score(self, data):
        mode  = self.cfg.get('game_mode', 'X01')
        speed = self.cfg.get('speed', 'Fast')

        # ── Cricket ───────────────────────────────────────────────────────
        if mode == 'Cricket':
            disp = "  ".join(f"{m.upper()} {t}" if t != 'miss' else "Miss" for t, m in data)
            self.after(0, lambda: self._score_str.set(disp))
            threading.Thread(target=enter_cricket_score,
                             args=(data, self.cfg.get('cricket_grid', {}), speed, self.cfg), daemon=True).start()
            if self.cfg.get('voice_confirm', True):
                speak(_cricket_speech(data), self.cfg)
            return

        # ── X01 per-dart: submit signal ────────────────────────────────────
        if isinstance(data, tuple) and data[0] == 'dart_submit':
            if self._current_darts:
                self._submit_current_visit()
            return

        # ── X01 per-dart: single dart ─────────────────────────────────────
        if isinstance(data, tuple) and data[0] == 'dart':
            _, dart_val, dart_disp = data
            self._current_darts.append((dart_val, dart_disp))
            # update live remaining
            if self.cfg.get('live_checkout', False) and self._x01_remaining is not None:
                self._x01_remaining -= dart_val
                self.after(0, self._update_remaining_display)
            self.after(0, self._update_dart_display)
            if self.cfg.get('voice_confirm', True):
                speak(dart_disp, self.cfg)
            if len(self._current_darts) == 3:
                self._submit_current_visit()
            return

        # ── X01 standard (total score) ────────────────────────────────────
        score = data
        self._session_scores.append(score)
        avg   = sum(self._session_scores) / len(self._session_scores)
        darts = len(self._session_scores) * 3
        visit_n = len(self._session_scores)
        self.after(0, lambda s=str(score), a=f"{avg:.1f}", d=str(darts),
                          lbl=f"Visit {visit_n}", sc=str(score): (
            self._score_str.set(s),
            self._avg_str.set(a),
            self._darts_str.set(d),
            self._push_history(lbl, sc),
        ))
        threading.Thread(target=enter_score,
                         args=(score, self.cfg.get('input_box', {}), speed), daemon=True).start()
        # update live remaining
        if self.cfg.get('live_checkout', False) and self._x01_remaining is not None:
            new_rem = self._x01_remaining - score
            if new_rem >= 0:
                self._x01_remaining = new_rem
            self.after(0, self._update_remaining_display)
        if self.cfg.get('voice_confirm', True):
            speak(str(score), self.cfg)
        if self.cfg.get('voice_stats', True) and len(self._session_scores) >= 3:
            speak(f"Average {avg:.0f}", self.cfg)

    def _submit_current_visit(self):
        """Tally + submit the accumulated per-dart visit."""
        total = sum(d[0] for d in self._current_darts)
        speed = self.cfg.get('speed', 'Fast')
        self._session_scores.append(total)
        avg   = sum(self._session_scores) / len(self._session_scores)
        darts = len(self._session_scores) * 3
        disp  = '  '.join(d[1] for d in self._current_darts)
        visit_n = len(self._session_scores)
        self.after(0, lambda s=disp, a=f"{avg:.1f}", d=str(darts),
                          lbl=f"Visit {visit_n}", sc=str(total): (
            self._score_str.set(s),
            self._avg_str.set(a),
            self._darts_str.set(d),
            self._push_history(lbl, sc),
        ))
        threading.Thread(target=enter_score,
                         args=(total, self.cfg.get('input_box', {}), speed), daemon=True).start()
        self._current_darts = []
        if self.cfg.get('voice_confirm', True):
            speak(str(total), self.cfg)
        if self.cfg.get('voice_stats', True) and len(self._session_scores) >= 3:
            avg2 = sum(self._session_scores) / len(self._session_scores)
            speak(f"Average {avg2:.0f}", self.cfg)

    def _on_cancel(self):
        """Undo the last dart (per-dart mode) or last visit (standard mode)."""
        if self.cfg.get('per_dart_mode', False) and self._current_darts:
            removed = self._current_darts.pop()
            if self.cfg.get('live_checkout', False) and self._x01_remaining is not None:
                self._x01_remaining += removed[0]
                self.after(0, self._update_remaining_display)
            self.after(0, self._update_dart_display)
            self._set_status(f"Cancelled: {removed[1]}")
        elif self._session_scores:
            removed = self._session_scores.pop()
            if self.cfg.get('live_checkout', False) and self._x01_remaining is not None:
                self._x01_remaining += removed
                self.after(0, self._update_remaining_display)
            if self._session_scores:
                avg   = sum(self._session_scores) / len(self._session_scores)
                darts = len(self._session_scores) * 3
                prev  = str(self._session_scores[-1])
                self.after(0, lambda s=prev, a=f"{avg:.1f}", d=str(darts): (
                    self._score_str.set(s), self._avg_str.set(a), self._darts_str.set(d)))
            else:
                self.after(0, lambda: (
                    self._score_str.set(''), self._avg_str.set('—'), self._darts_str.set('0')))
            self._set_status(f"Undid {removed} — also undo in your software")
        else:
            self._set_status("Nothing to cancel")

    def _on_manual_score(self):
        """Submit a score typed into the manual entry box."""
        if not hasattr(self, '_manual_var'):
            return
        text = self._manual_var.get().strip()
        if not text:
            return
        try:
            score = int(text)
        except ValueError:
            score = parse_score(text)
        if score is None or not (0 <= score <= 180):
            self._status.set("Invalid score (0–180)")
            return
        self._manual_var.set('')
        self._on_score(score)

    def _on_new_leg(self):
        """Reset remaining to the starting score for a new leg."""
        start = self.cfg.get('x01_start', 501)
        self._x01_remaining = start
        self._current_darts = []
        self.after(0, self._update_remaining_display)
        self._set_status(f"New leg — {start} remaining")

    def _update_remaining_display(self):
        if self._x01_remaining is not None and self.cfg.get('live_checkout', False):
            self._remaining_str.set(str(max(0, self._x01_remaining)))
            hint = checkout_hint(self._x01_remaining)
            self._checkout_str.set(hint or ('—' if 2 <= self._x01_remaining <= 170 else ''))
        else:
            self._remaining_str.set('')
            self._checkout_str.set('')

    def _update_dart_display(self):
        """Show accumulated darts with — placeholders."""
        slots = [d[1] for d in self._current_darts]
        while len(slots) < 3:
            slots.append('—')
        self._score_str.set('  '.join(slots))

    def _set_status(self, msg): self.after(0, lambda: self._status.set(msg))


if __name__ == '__main__':
    app = DartVoiceApp()
    app.mainloop()