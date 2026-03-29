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
# Parsers
# ─────────────────────────────────────────────────────────────────────────────
_ONES = {'zero':0,'oh':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19}
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
                 'devil':'d','doubles':'d','doubled':'d','dabble':'d',
                 'singles':'s','singled':'s'}

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
             'bull\'s eye', 'bulls eye'):
        return (50, 'Bull')
    if t in ('outer bull', 'twenty five', 'twenty-five', 'half bull'):
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
    if val is None or not (1 <= val <= 20):
        return None
    return (val * mod, f"{pfx}{val}" if pfx else str(val))

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

def enter_cricket_score(darts, grid, speed):
    with _score_lock:
        pause = {'Lightning':0.08,'Fast':0.12,'Normal':0.20,'Slow':0.35}.get(speed,0.12)
        pyautogui.PAUSE = pause
        if not grid or not all(k in grid for k in ('s20','t15','submit')): return
        s20, t15, submit = grid['s20'], grid['t15'], grid['submit']
        dx = (t15['x'] - s20['x']) / 2.0
        dy = (t15['y'] - s20['y']) / 5.0
        row = {'20':0,'19':1,'18':2,'17':3,'16':4,'15':5,'b':6}
        col = {'s':0,'d':1,'t':2}
        for tgt, mod in darts:
            if tgt == 'miss': continue
            pyautogui.click(s20['x'] + col[mod]*dx, s20['y'] + row[tgt]*dy)
            time.sleep(pause)
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
# Speech thread
# ─────────────────────────────────────────────────────────────────────────────
class SpeechListener(threading.Thread):
    def __init__(self, model_path, mic_index, cfg, on_score, on_status,
                 on_cancel=None, on_new_leg=None):
        super().__init__(daemon=True)
        self.model_path = model_path; self.mic_index = mic_index
        self.cfg = cfg; self.on_score = on_score; self.on_status = on_status
        self.on_cancel = on_cancel; self.on_new_leg = on_new_leg
        self._stop = threading.Event()

    def stop(self): self._stop.set()

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
        while not self._stop.is_set():
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
        text = text.lower().strip()

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
            after = text.split(trigger, 1)[-1].strip()
        else:
            after = text.replace(trigger, '').strip()

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
        self.geometry("380x720")
        self.configure(fg_color=BG)
        self.attributes('-topmost', True)
        self.resizable(False, False)

        # Set a blank icon to hide the default CTk icon
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
        # X01 game tracking
        self._x01_remaining  = None          # None = not tracking yet
        self._current_darts  = []            # per-dart mode accumulator [(val, disp), ...]
        self._remaining_str  = tk.StringVar(value="")
        self._checkout_str   = tk.StringVar(value="")

        self._tray = None
        self.protocol("WM_DELETE_WINDOW", self._hide_to_tray)
        if sys.platform == 'win32':
            self._setup_tray()

        self._build_ui()
        self._pulse()
        self.after(200, self._billing_gate)

    # ── Billing / trial gate ──────────────────────────────────────────────────
    # ── Billing gate (called 200ms after launch) ──────────────────────────────
    def _billing_gate(self):
        try:
            from billing import billing_status, check_subscription_async
        except ImportError:
            return

        bs = billing_status()
        check_subscription_async(self._on_billing_checked)

        if bs['subscribed']:
            if bs['account']:
                self._status.set(f"Signed in as {bs['account']['email']}")
            return

        if bs['trial_active']:
            days = bs['days_left']
            self._status.set(f"Trial — {days} day{'s' if days != 1 else ''} left")
            return

        self._show_paywall()

    def _on_billing_checked(self, subscribed: bool, account):
        if subscribed:
            msg = f"Signed in as {account['email']}" if account else "Ready"
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
                                 billing_status, check_subscription_async, get_checkout_url
        except ImportError:
            return

        if hasattr(self, '_acct_win') and self._acct_win.winfo_exists():
            self._acct_win.lift(); return

        win = ctk.CTkToplevel(self)
        self._acct_win = win
        win.title("DartVoice — Account")
        win.geometry(self._right_of(320, 400))
        win.configure(fg_color=BG)
        win.resizable(False, False)
        win.attributes('-topmost', True)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        # Header
        hdr = ctk.CTkFrame(win, fg_color=CARD, corner_radius=0, height=52)
        hdr.pack(fill='x'); hdr.pack_propagate(False)
        lc = tk.Canvas(hdr, width=22, height=22, bg=CARD, highlightthickness=0)
        lc.place(x=20, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 11, 11, [9, 6, 3, 1])
        ctk.CTkLabel(hdr, text="  ACCOUNT", text_color=FG,
                     font=("Uber Move Bold", 14, "bold")).place(x=48, rely=0.5, anchor='w')
        ctk.CTkFrame(win, fg_color=ACCENT_DIM, height=1).pack(fill='x')

        body = ctk.CTkFrame(win, fg_color='transparent')
        body.pack(fill='both', expand=True, padx=28, pady=20)

        account = get_account()

        if account:
            # ── Signed-in view ────────────────────────────────────────────
            ctk.CTkLabel(body, text="SIGNED IN", text_color=ACCENT,
                         font=("Rubik", 9, "bold")).pack(anchor='w', pady=(0, 4))
            ctk.CTkLabel(body, text=account['email'], text_color=FG,
                         font=("Uber Move Bold", 13, "bold")).pack(anchor='w', pady=(0, 16))

            bs = billing_status()
            if bs['subscribed']:
                status_text = "Subscription active"
                status_col  = '#22CC66'
            elif bs['trial_active']:
                status_text = f"Trial — {bs['days_left']} days remaining"
                status_col  = ACCENT
            else:
                status_text = "No active subscription"
                status_col  = FG2

            ctk.CTkLabel(body, text=status_text, text_color=status_col,
                         font=("Rubik", 11)).pack(anchor='w', pady=(0, 20))

            import webbrowser

            if not bs['subscribed']:
                ctk.CTkButton(
                    body, text="START FREE TRIAL  →  $4.99/mo",
                    font=("Uber Move Bold", 12, "bold"),
                    fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
                    height=44, corner_radius=10,
                    command=lambda: webbrowser.open(get_checkout_url()),
                ).pack(fill='x', pady=(0, 8))

            ctk.CTkButton(
                body, text="Manage subscription / billing",
                font=("Rubik", 11), fg_color=CARD2, hover_color=SEP,
                text_color=FG2, height=38, corner_radius=8,
                command=lambda: webbrowser.open(
                    f"{os.environ.get('DV_BILLING_URL','https://billing.dartvoice.com')}"
                    f"/portal?user_id={account['user_id']}"
                ),
            ).pack(fill='x', pady=(0, 8))

            def _do_signout():
                sign_out()
                win.destroy()
                self._status.set("Signed out")

            ctk.CTkButton(
                body, text="Sign out",
                font=("Rubik", 11), fg_color=CARD2, hover_color=SEP,
                text_color=FG2, height=38, corner_radius=8,
                command=_do_signout,
            ).pack(fill='x')

        else:
            # ── Sign-in view (email → OTP) ────────────────────────────────
            ctk.CTkLabel(body, text="SIGN IN  /  CREATE ACCOUNT",
                         text_color=ACCENT, font=("Rubik", 9, "bold")).pack(anchor='w', pady=(0, 4))
            ctk.CTkLabel(
                body,
                text="Enter your email to receive a\n6-digit sign-in code.",
                text_color=FG2, font=("Rubik", 11), justify='left',
            ).pack(anchor='w', pady=(0, 14))

            email_var = tk.StringVar()
            code_var  = tk.StringVar()
            msg_var   = tk.StringVar()

            email_entry = ctk.CTkEntry(
                body, textvariable=email_var,
                placeholder_text="your@email.com",
                font=("Rubik", 12), height=40, corner_radius=8,
                border_color=SEP, fg_color=CARD,
            )
            email_entry.pack(fill='x', pady=(0, 8))

            code_frame = ctk.CTkFrame(body, fg_color='transparent')

            code_entry = ctk.CTkEntry(
                code_frame, textvariable=code_var,
                placeholder_text="6-digit code",
                font=("Rubik", 13), height=40, corner_radius=8,
                border_color=SEP, fg_color=CARD, width=140,
            )
            code_entry.pack(side='left', padx=(0, 8))

            msg_lbl = ctk.CTkLabel(body, textvariable=msg_var,
                                   text_color=FG2, font=("Rubik", 10),
                                   wraplength=260)
            msg_lbl.pack(pady=(4, 8))

            send_btn = ctk.CTkButton(
                body, text="Send code",
                font=("Uber Move Bold", 12, "bold"),
                fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
                height=40, corner_radius=8,
            )
            send_btn.pack(fill='x', pady=(0, 0))

            verify_btn = ctk.CTkButton(
                code_frame, text="Verify",
                font=("Uber Move Bold", 12, "bold"),
                fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
                height=40, corner_radius=8,
            )
            verify_btn.pack(side='left')

            def _send():
                email = email_var.get().strip()
                if not email or '@' not in email:
                    msg_var.set("Enter a valid email address.")
                    return
                send_btn.configure(state='disabled', text='Sending…')
                msg_var.set('')
                def _do():
                    ok, err = send_otp(email)
                    def _ui():
                        send_btn.configure(state='normal', text='Resend code')
                        if ok:
                            msg_var.set(f"Code sent to {email}")
                            send_btn.pack_forget()
                            code_frame.pack(fill='x', pady=(0, 0))
                            msg_lbl.pack_forget()
                            msg_lbl.pack(pady=(4, 8))
                        else:
                            msg_var.set(f"Error: {err}")
                    win.after(0, _ui)
                threading.Thread(target=_do, daemon=True).start()

            def _verify():
                email = email_var.get().strip()
                code  = code_var.get().strip()
                if not code:
                    msg_var.set("Enter the code from your email.")
                    return
                verify_btn.configure(state='disabled', text='Verifying…')
                msg_var.set('')
                def _do():
                    ok, err = verify_otp(email, code)
                    def _ui():
                        verify_btn.configure(state='normal', text='Verify')
                        if ok:
                            win.destroy()
                            self._billing_gate()
                        else:
                            msg_var.set(f"Invalid code — {err}")
                    win.after(0, _ui)
                threading.Thread(target=_do, daemon=True).start()

            send_btn.configure(command=_send)
            verify_btn.configure(command=_verify)
            email_entry.bind('<Return>', lambda e: _send())
            code_entry.bind('<Return>',  lambda e: _verify())

    # ── Paywall (trial expired, not signed in / not subscribed) ──────────────
    def _show_paywall(self):
        if hasattr(self, '_paywall') and self._paywall.winfo_exists():
            self._paywall.lift(); return

        win = ctk.CTkToplevel(self)
        self._paywall = win
        win.title("DartVoice — Subscription")
        win.geometry("360x420")
        win.configure(fg_color=BG)
        win.resizable(False, False)
        win.attributes('-topmost', True)
        win.protocol("WM_DELETE_WINDOW", lambda: None)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        hdr = ctk.CTkFrame(win, fg_color=CARD, corner_radius=0, height=56)
        hdr.pack(fill='x'); hdr.pack_propagate(False)
        lc = tk.Canvas(hdr, width=28, height=28, bg=CARD, highlightthickness=0)
        lc.place(x=20, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 14, 14, [12, 8, 5, 2])
        ctk.CTkLabel(hdr, text="  DARTVOICE", text_color=FG,
                     font=("Uber Move Bold", 17, "bold")).place(x=56, rely=0.5, anchor='w')
        ctk.CTkFrame(win, fg_color=ACCENT_DIM, height=1).pack(fill='x')

        body = ctk.CTkFrame(win, fg_color='transparent')
        body.pack(fill='both', expand=True, padx=32, pady=24)

        ctk.CTkLabel(body, text="YOUR FREE TRIAL HAS ENDED",
                     text_color=ACCENT,
                     font=("Uber Move Bold", 13, "bold")).pack(pady=(0, 8))
        ctk.CTkLabel(
            body,
            text="Sign in or create an account to\ncontinue with your subscription.\n\n7 weeks free, then $4.99/month.\nCancel any time.",
            text_color=FG2, font=("Rubik", 11),
            justify='center', wraplength=280,
        ).pack(pady=(0, 20))

        ctk.CTkButton(
            body, text="Sign in / Create account",
            font=("Uber Move Bold", 13, "bold"),
            fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
            height=48, corner_radius=10,
            command=lambda: [win.destroy(), self._open_account_dialog()],
        ).pack(fill='x')

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
        self.withdraw()

    def _show_from_tray(self):
        self.deiconify()
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
        pad = 28

        # ── Background wire canvas (FULL WINDOW BACKGROUND) ───────────────
        self.bg_canvas = tk.Canvas(self, bg=BG, highlightthickness=0)
        self.bg_canvas.place(x=0, y=0, relwidth=1, relheight=1)
        self.bg_canvas.bind('<Configure>', lambda e: [
            self.bg_canvas.delete('all'),
            self._draw_dartboard_wire(self.bg_canvas, e.width, e.height)
        ])

        # ── Hero header (centred) ──────────────────────────────────────────
        hero = ctk.CTkFrame(self, fg_color='transparent')
        hero.pack(pady=(30, 0))

        logo_c = tk.Canvas(hero, width=52, height=52, bg=BG, highlightthickness=0)
        logo_c.pack()
        self._draw_bullseye(logo_c, 26, 26, [23, 16, 10, 4])

        ctk.CTkLabel(hero, text="DARTVOICE", text_color=FG,
                     font=("Uber Move Bold", 32, "bold")).pack(pady=(8, 0))
        ctk.CTkLabel(hero, text="v2", text_color=FG2,
                     font=("Rubik", 10)).pack(pady=(2, 0))

        # Sharp Solutions branding
        brand = ctk.CTkFrame(hero, fg_color='transparent')
        brand.pack(pady=(4, 0))
        ctk.CTkLabel(brand, text="by ", text_color=FG3,
                     font=("Rubik", 9)).pack(side='left')
        ctk.CTkLabel(brand, text="Sharp Solutions", text_color=ACCENT,
                     font=("Rubik", 9, "bold")).pack(side='left')

        # ── Thin accent line ──────────────────────────────────────────────
        ctk.CTkFrame(self, fg_color=ACCENT_DIM, height=1).pack(fill='x', padx=pad, pady=(20, 0))

        # ── Mode ──────────────────────────────────────────────────────────
        row = ctk.CTkFrame(self, fg_color='transparent')
        row.pack(fill='x', padx=pad, pady=(16, 6))
        ctk.CTkLabel(row, text="MODE", text_color=FG2,
                     font=("Rubik", 9, "bold")).pack(side='left')

        self.mode_var = ctk.StringVar(value=self.cfg.get('game_mode', 'X01'))
        ctk.CTkSegmentedButton(
            self, values=["X01", "Cricket"], variable=self.mode_var,
            command=self._save_mode,
            font=("Uber Move Bold", 12, "bold"),
            fg_color=CARD2, selected_color=ACCENT, selected_hover_color=PRI_HOV,
            unselected_color=CARD2, unselected_hover_color=SEP,
            text_color=PRI_FG, corner_radius=8, height=38,
        ).pack(fill='x', padx=pad)

        # ── Score card ────────────────────────────────────────────────────
        self._card = ctk.CTkFrame(self, fg_color=CARD, corner_radius=12,
                                   border_width=1, border_color=SEP)
        self._card.pack(fill='x', padx=pad, pady=(14, 0))

        ctk.CTkLabel(self._card, text="LAST SCORE", text_color=FG2,
                     font=("Rubik", 9, "bold")).pack(pady=(16, 0))

        self._score_canvas = tk.Canvas(self._card, bg=CARD, highlightthickness=0,
                                        width=320, height=84)
        self._score_canvas.pack(padx=10, pady=(4, 14))
        self._score_canvas.bind('<Configure>', lambda e: self._redraw_score())
        self._score_str.trace_add('write', lambda *_: self._redraw_score())
        self._redraw_score()

        # ── Session stats (X01) ───────────────────────────────────────────
        stats_row = ctk.CTkFrame(self, fg_color='transparent')
        stats_row.pack(fill='x', padx=pad, pady=(10, 0))

        avg_card = ctk.CTkFrame(stats_row, fg_color=CARD, corner_radius=10,
                                border_width=1, border_color=SEP)
        avg_card.pack(side='left', expand=True, fill='x', padx=(0, 5))
        ctk.CTkLabel(avg_card, text="SESSION AVG", text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(pady=(12, 0))
        ctk.CTkLabel(avg_card, textvariable=self._avg_str, text_color=FG,
                     font=("Uber Move Bold", 24, "bold")).pack(pady=(0, 12))

        darts_card = ctk.CTkFrame(stats_row, fg_color=CARD, corner_radius=10,
                                  border_width=1, border_color=SEP)
        darts_card.pack(side='right', expand=True, fill='x', padx=(5, 0))
        ctk.CTkLabel(darts_card, text="DARTS", text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(pady=(12, 0))
        ctk.CTkLabel(darts_card, textvariable=self._darts_str, text_color=FG,
                     font=("Uber Move Bold", 24, "bold")).pack(pady=(0, 12))

        # ── Checkout / remaining row (X01 live tracking) ──────────────────
        co_row = ctk.CTkFrame(self, fg_color='transparent')
        show_co = self.cfg.get('live_checkout', False) and self.cfg.get('game_mode', 'X01') == 'X01'
        if show_co:
            co_row.pack(fill='x', padx=pad, pady=(10, 0))

        rem_card = ctk.CTkFrame(co_row, fg_color=CARD, corner_radius=10,
                                border_width=1, border_color=SEP)
        rem_card.pack(side='left', expand=True, fill='x', padx=(0, 5))
        ctk.CTkLabel(rem_card, text="REMAINING", text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(pady=(10, 0))
        ctk.CTkLabel(rem_card, textvariable=self._remaining_str, text_color=FG,
                     font=("Uber Move Bold", 22, "bold")).pack(pady=(0, 10))

        co_card = ctk.CTkFrame(co_row, fg_color=CARD, corner_radius=10,
                               border_width=1, border_color=SEP)
        co_card.pack(side='right', expand=True, fill='x', padx=(5, 0))
        ctk.CTkLabel(co_card, text="CHECKOUT", text_color=FG2,
                     font=("Rubik", 8, "bold")).pack(pady=(10, 0))
        ctk.CTkLabel(co_card, textvariable=self._checkout_str, text_color=ACCENT,
                     font=("Uber Move Bold", 14, "bold")).pack(pady=(0, 10))

        # ── Status ────────────────────────────────────────────────────────
        stat = ctk.CTkFrame(self, fg_color='transparent')
        stat.pack(pady=(14, 0))
        self._dot = ctk.CTkLabel(stat, text="●", text_color=FG3, font=("Rubik", 10))
        self._dot.pack(side='left', padx=(0, 6))
        ctk.CTkLabel(stat, textvariable=self._status, text_color=FG2,
                     font=("Rubik", 11)).pack(side='left')

        # ── Primary CTA ───────────────────────────────────────────────────
        self._toggle_btn = ctk.CTkButton(
            self, text="START LISTENING",
            font=("Uber Move Bold", 14, "bold"),
            fg_color=ACCENT, hover_color=PRI_HOV, text_color=PRI_FG,
            height=52, corner_radius=10, command=self._toggle,
        )
        self._toggle_btn.pack(fill='x', padx=pad, pady=(12, 0))

        # ── Buttons row (Settings | Account | In-Game) ────────────────────
        btn_row = ctk.CTkFrame(self, fg_color='transparent')
        btn_row.pack(fill='x', padx=pad, pady=(10, 0))

        ctk.CTkButton(
            btn_row, text="Settings",
            font=("Rubik", 11),
            fg_color='transparent', hover_color=CARD2, text_color=FG2,
            border_width=1, border_color=SEP,
            height=38, corner_radius=8, command=self._open_settings,
        ).pack(side='left', expand=True, fill='x', padx=(0, 4))

        # Account button — shows email initial when signed in
        try:
            from billing import get_account
            acct = get_account()
            acct_label = acct['email'][0].upper() if acct else '→'
            acct_tip   = acct['email'] if acct else 'Sign in'
        except Exception:
            acct_label, acct_tip = '→', 'Account'

        self._acct_btn = ctk.CTkButton(
            btn_row, text=acct_label,
            font=("Uber Move Bold", 13, "bold"),
            fg_color=CARD2, hover_color=SEP, text_color=ACCENT,
            border_width=1, border_color=SEP,
            width=38, height=38, corner_radius=8,
            command=self._open_account_dialog,
        )
        self._acct_btn.pack(side='left', padx=(0, 4))

        ctk.CTkButton(
            btn_row, text="In-Game",
            font=("Rubik", 11),
            fg_color='transparent', hover_color=CARD2, text_color=FG2,
            border_width=1, border_color=SEP,
            height=38, corner_radius=8, command=self._open_ingame,
        ).pack(side='left', expand=True, fill='x')

        # ── Footer ────────────────────────────────────────────────────────
        footer = ctk.CTkFrame(self, fg_color='transparent')
        footer.pack(side='bottom', pady=(0, 14))

        # Social icons row
        socials = ctk.CTkFrame(footer, fg_color='transparent')
        socials.pack(pady=(0, 6))

        social_links = [
            ("instagram", "https://instagram.com/sharpsolutions"),
            ("tiktok",    "https://tiktok.com/@sharpsolutions"),
            ("youtube",   "https://youtube.com/@sharpsolutions"),
            ("x",         "https://x.com/sharpsolutions"),
            ("facebook",  "https://facebook.com/sharpsolutions"),
        ]

        for icon_name, url in social_links:
            sz = 30
            wrapper = ctk.CTkFrame(socials, fg_color=CARD2, corner_radius=8,
                                    width=sz+8, height=sz+8, cursor='hand2')
            wrapper.pack(side='left', padx=3)
            wrapper.pack_propagate(False)
            c = tk.Canvas(wrapper, width=sz, height=sz, bg=CARD2,
                          highlightthickness=0, cursor='hand2')
            c.pack(expand=True)
            self._draw_social_icon(c, icon_name, sz)
            for w in (wrapper, c):
                w.bind('<Button-1>', lambda e, u=url: __import__('webbrowser').open(u))
                w.bind('<Enter>', lambda e, cv=c, n=icon_name, s=sz: (
                    cv.delete('all'), self._draw_social_icon(cv, n, s, hover=True)))
                w.bind('<Leave>', lambda e, cv=c, n=icon_name, s=sz: (
                    cv.delete('all'), self._draw_social_icon(cv, n, s, hover=False)))

        ctk.CTkLabel(footer, text="SHARP SOLUTIONS", text_color=FG3,
                     font=("Rubik", 7, "bold")).pack()

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
        w, h = 320, 84
        L = 16  # bracket arm length
        T = 2

        col = ACCENT if self._active else SEP

        # Corner brackets
        for x0, y0, dx, dy in [
            (0, 0,    1,  1),   # top-left
            (w, 0,   -1,  1),   # top-right
            (0, h,    1, -1),   # bottom-left
            (w, h,   -1, -1),   # bottom-right
        ]:
            c.create_line(x0, y0+dy*L, x0, y0, x0+dx*L, y0, width=T, fill=col, capstyle='round')

        # Score text
        val = self._score_str.get()
        if not val:
            c.create_text(w//2, h//2, text="—", font=("Uber Move Bold", 40, "bold"),
                          fill=FG3, anchor='center')
        else:
            # Shrink font to fit cricket scores (e.g. "S 20  S 16  Miss")
            max_w = w - 24  # padding inside brackets
            size = 50
            while size > 16:
                fnt = ("Uber Move Bold", size, "bold")
                tid = c.create_text(-1000, -1000, text=val, font=fnt)
                tw = c.bbox(tid)[2] - c.bbox(tid)[0]
                c.delete(tid)
                if tw <= max_w:
                    break
                size -= 2
            c.create_text(w//2, h//2, text=val, font=("Uber Move Bold", size, "bold"),
                          fill=FG, anchor='center')

    # ── Bullseye logo ─────────────────────────────────────────────────────────
    @staticmethod
    def _draw_bullseye(canvas, cx, cy, radii):
        colors = [FG3, ACCENT_DIM, FG3, ACCENT]
        for r, col in zip(radii, colors):
            canvas.create_oval(cx-r, cy-r, cx+r, cy+r, outline=col, width=1, fill='')
        # Centre dot
        canvas.create_oval(cx-2, cy-2, cx+2, cy+2, fill=ACCENT, outline='')

    # ── In-game compact overlay ───────────────────────────────────────────────
    def _open_ingame(self):
        if hasattr(self, '_igw') and self._igw.winfo_exists():
            self._igw.focus(); return

        win = ctk.CTkToplevel(self)
        self._igw = win
        win.title("DartVoice")
        win.geometry("300x220")
        win.configure(fg_color=BG)
        win.attributes('-topmost', True)
        win.resizable(False, False)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        # ── Compact header ────────────────────────────────────────────────
        hf = ctk.CTkFrame(win, fg_color=CARD, corner_radius=0, height=40)
        hf.pack(fill='x')
        hf.pack_propagate(False)

        lc = tk.Canvas(hf, width=18, height=18, bg=CARD, highlightthickness=0)
        lc.place(x=12, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 9, 9, [7, 5, 3, 1])

        ctk.CTkLabel(hf, text="DARTVOICE", text_color=FG,
                     font=("Uber Move Bold", 12, "bold"),
                     fg_color=CARD).place(x=36, rely=0.5, anchor='w')

        ctk.CTkButton(hf, text="Exit", font=("Rubik", 9),
                      fg_color='transparent', hover_color=CARD2, text_color=FG2,
                      height=22, width=48, corner_radius=4,
                      command=win.destroy
                      ).place(relx=1.0, x=-8, rely=0.5, anchor='e')

        ctk.CTkFrame(win, fg_color=ACCENT_DIM, height=1).pack(fill='x')

        # ── Last score ────────────────────────────────────────────────────
        score_c = tk.Canvas(win, width=298, height=88, bg=BG, highlightthickness=0)
        score_c.pack(pady=(6, 0))

        def _redraw_ig(*_):
            score_c.delete('all')
            w, h = 298, 88
            L, T = 12, 2
            col = ACCENT if self._active else SEP
            for x0, y0, dx, dy in [(0,0,1,1),(w,0,-1,1),(0,h,1,-1),(w,h,-1,-1)]:
                score_c.create_line(x0, y0+dy*L, x0, y0, x0+dx*L, y0,
                                    width=T, fill=col, capstyle='round')
            val = self._score_str.get()
            if not val:
                score_c.create_text(w//2, h//2, text="—",
                                    font=("Uber Move Bold", 36, "bold"),
                                    fill=FG3, anchor='center')
            else:
                max_w = w - 20
                size = 46
                while size > 14:
                    fnt = ("Uber Move Bold", size, "bold")
                    tid = score_c.create_text(-1000, -1000, text=val, font=fnt)
                    tw = score_c.bbox(tid)[2] - score_c.bbox(tid)[0]
                    score_c.delete(tid)
                    if tw <= max_w:
                        break
                    size -= 2
                score_c.create_text(w//2, h//2, text=val,
                                    font=("Uber Move Bold", size, "bold"),
                                    fill=FG, anchor='center')

        self._score_str.trace_add('write', _redraw_ig)
        _redraw_ig()

        # ── Stats row ─────────────────────────────────────────────────────
        sr = ctk.CTkFrame(win, fg_color='transparent')
        sr.pack(fill='x', padx=12, pady=(8, 4))

        for label_text, var in [("SESSION AVG", self._avg_str),
                                 ("DARTS",       self._darts_str)]:
            card = ctk.CTkFrame(sr, fg_color=CARD, corner_radius=8,
                                border_width=1, border_color=SEP)
            card.pack(side='left', expand=True, fill='x', padx=3)
            ctk.CTkLabel(card, text=label_text, text_color=FG2,
                         font=("Rubik", 7, "bold")).pack(pady=(8, 0))
            ctk.CTkLabel(card, textvariable=var, text_color=FG,
                         font=("Uber Move Bold", 18, "bold")).pack(pady=(0, 8))

        # ── Checkout row (live tracking) ───────────────────────────────────
        if self.cfg.get('live_checkout', False) and self.cfg.get('game_mode', 'X01') == 'X01':
            cr = ctk.CTkFrame(win, fg_color='transparent')
            cr.pack(fill='x', padx=12, pady=(0, 8))
            for lbl_txt, var, col in [
                ("REMAINING", self._remaining_str, FG),
                ("CHECKOUT",  self._checkout_str,  ACCENT),
            ]:
                cc = ctk.CTkFrame(cr, fg_color=CARD, corner_radius=8,
                                  border_width=1, border_color=SEP)
                cc.pack(side='left', expand=True, fill='x', padx=3)
                ctk.CTkLabel(cc, text=lbl_txt, text_color=FG2,
                             font=("Rubik", 7, "bold")).pack(pady=(6, 0))
                ctk.CTkLabel(cc, textvariable=var, text_color=col,
                             font=("Uber Move Bold", 13, "bold")).pack(pady=(0, 6))

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
        if alive:
            self._dot.configure(text_color=ACCENT if int(time.time()*2)%2==0 else ACCENT_DIM)
        else:
            self._dot.configure(text_color=FG3)
        self.after(500, self._pulse)

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
        if hasattr(self, '_sw') and self._sw.winfo_exists():
            self._sw.focus(); return

        win = ctk.CTkToplevel(self)
        self._sw = win
        win.title("DartVoice — Settings")
        win.geometry(self._right_of(340, 720))
        win.configure(fg_color=BG)
        win.attributes('-topmost', True)
        win.resizable(False, True)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        # ── Fixed header ─────────────────────────────────────────────────
        hdr = ctk.CTkFrame(win, fg_color=CARD, corner_radius=0, height=52)
        hdr.pack(fill='x')
        hdr.pack_propagate(False)

        lc = tk.Canvas(hdr, width=22, height=22, bg=CARD, highlightthickness=0)
        lc.place(x=24, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 11, 11, [9, 6, 3, 1])
        ctk.CTkLabel(hdr, text="  SETTINGS", text_color=FG,
                     font=("Uber Move Bold", 15, "bold")).place(x=50, rely=0.5, anchor='w')

        ctk.CTkFrame(win, fg_color=ACCENT_DIM, height=1).pack(fill='x')

        # ── Scrollable content ───────────────────────────────────────────
        scroll = ctk.CTkScrollableFrame(win, fg_color=BG, corner_radius=0,
                                         scrollbar_button_color=SEP,
                                         scrollbar_button_hover_color=FG3)
        scroll.pack(fill='both', expand=True)

        def _sec(label, top=18):
            ctk.CTkLabel(scroll, text=label, text_color=ACCENT,
                         font=("Rubik", 9, "bold")).pack(anchor='w', padx=24, pady=(top, 4))

        def _sep():
            ctk.CTkFrame(scroll, fg_color=SEP, height=1).pack(fill='x', padx=24, pady=(4, 0))

        def _btn(label, cmd):
            ctk.CTkButton(scroll, text=label, font=("Rubik", 11, "bold"),
                          fg_color=CARD2, hover_color=SEP, text_color=FG,
                          height=38, corner_radius=8, command=cmd,
                          ).pack(fill='x', padx=24, pady=(0, 6))

        # Checkbox helper
        def _chk(parent, text, var, cmd):
            ctk.CTkCheckBox(parent, text=text, variable=var,
                            font=("Rubik", 11), fg_color=ACCENT, hover_color=PRI_HOV,
                            checkmark_color=PRI_FG, text_color=FG, border_color=SEP,
                            command=cmd
                            ).pack(anchor='w', padx=24, pady=(0, 7))

        # ── Theme picker ─────────────────────────────────────────────────
        _sec("COLOUR THEME", top=12)

        theme_names    = list(THEMES.keys())
        current_theme  = self.cfg.get('theme', 'Littler')
        self._theme_indicators = {}

        theme_frame = ctk.CTkFrame(scroll, fg_color='transparent')
        theme_frame.pack(fill='x', padx=24, pady=(0, 4))

        def _effective_accent(name):
            t = THEMES[name]
            if t.get('_custom'):
                return self.cfg.get('custom_accent', '#FFFFFF')
            return t['accent']

        def _pick(n):
            if THEMES[n].get('_custom'):
                self._pick_custom_colour(n, lambda active: _redraw_dots(active))
                return
            _apply_theme(n)
            self._save_setting('theme', n)
            _redraw_dots(n)
            self._rebuild_ui()
            self.after(50, self._open_settings)

        def _redraw_dots(active_name):
            for sn, (dc, lbl) in self._theme_indicators.items():
                selected = (sn == active_name)
                dc.delete('ring')
                dc.create_oval(2, 2, 22, 22,
                               fill=_effective_accent(sn),
                               outline=FG if selected else SEP,
                               width=2, tags='ring')
                lbl.configure(text_color=FG if selected else FG3)

        cols = 3
        for i, name in enumerate(theme_names):
            t       = THEMES[name]
            col_idx = i % cols
            row_idx = i // cols

            swatch = ctk.CTkFrame(theme_frame, fg_color='transparent',
                                  width=88, height=62, cursor='hand2')
            swatch.grid(row=row_idx, column=col_idx, padx=4, pady=4, sticky='nsew')
            swatch.grid_propagate(False)
            theme_frame.grid_columnconfigure(col_idx, weight=1)

            # Colour dot
            dot_c = tk.Canvas(swatch, width=24, height=24, bg=BG,
                              highlightthickness=0)
            dot_c.pack(pady=(6, 0))
            selected = (name == current_theme)
            dot_c.create_oval(2, 2, 22, 22,
                              fill=_effective_accent(name),
                              outline=FG if selected else SEP,
                              width=2, tags='ring')

            # Player surname only (fits in the small swatch)
            surname = t['player'].split()[-1] if not t.get('_custom') else 'Custom'
            lbl = ctk.CTkLabel(swatch, text=surname,
                               text_color=FG if selected else FG3,
                               font=("Rubik", 8))
            lbl.pack(pady=(1, 0))

            self._theme_indicators[name] = (dot_c, lbl)

            for w in (swatch, dot_c, lbl):
                w.bind('<Button-1>', lambda e, n=name: _pick(n))

        _sep()

        _sec("VIDEO SCORING")
        vv = ctk.BooleanVar(value=self.cfg.get('video_scoring', False))
        _chk(scroll, "Use screen-capture instead of mic", vv,
             lambda: self._save_setting('video_scoring', vv.get()))

        region = self.cfg.get('video_region', {})
        region_lbl_text = (f"Region: {region['w']}x{region['h']} at ({region['x']},{region['y']})"
                           if region.get('w') else "No region selected")
        region_info = ctk.CTkLabel(scroll, text=region_lbl_text, text_color=FG2,
                                   font=("Rubik", 9))
        region_info.pack(anchor='w', padx=24, pady=(0, 4))

        def _select_region():
            self._calibrate_video_region()
            def _poll():
                r = self.cfg.get('video_region', {})
                if r.get('w'):
                    region_info.configure(
                        text=f"Region: {r['w']}x{r['h']} at ({r['x']},{r['y']})")
            win.after(500, _poll)

        _btn("Select Camera Region  (drag)",  _select_region)
        _btn("Calibrate Board in Video",       self._calibrate_video_board)
        _btn("Show Video Debug",               self._open_video_debug)

        cal = self.cfg.get('video_board_cal', {})
        if cal.get('r_v'):
            cal_text = (f"Board calibrated  v={cal['r_v']:.0f}  h={cal['r_h']:.0f}  "
                        f"rot={cal.get('rot', 0):.1f}")
        else:
            cal_text = "Board not calibrated"
        ctk.CTkLabel(scroll, text=cal_text, text_color=FG2, font=("Rubik", 9)
                     ).pack(anchor='w', padx=24, pady=(0, 4))
        _sep()

        _sec("CALIBRATION")
        _btn("Calibrate X01 Box",    self._calibrate_x01)
        _btn("Calibrate Cricket Grid", self._calibrate_cricket)
        _sep()

        _sec("MICROPHONE")
        _btn("Select Microphone", self._select_mic)
        _sep()

        _sec("TYPING SPEED")
        sv = ctk.StringVar(value=self.cfg.get('speed', 'Fast'))
        ctk.CTkOptionMenu(scroll, variable=sv, values=['Lightning','Fast','Normal','Slow'],
                          font=("Rubik", 11),
                          fg_color=CARD2, button_color=ACCENT_DIM, button_hover_color=ACCENT,
                          text_color=FG, dropdown_fg_color=CARD, dropdown_text_color=FG,
                          dropdown_hover_color=CARD2, corner_radius=8,
                          command=lambda v: self._save_setting('speed', v)
                          ).pack(fill='x', padx=24, pady=(0, 0))
        _sep()

        _sec("TRIGGER WORD")
        rv = ctk.BooleanVar(value=self.cfg.get('require_trigger', True))
        _chk(scroll, "Require trigger word", rv,
             lambda: self._save_setting('require_trigger', rv.get()))
        te = ctk.CTkEntry(scroll, font=("Rubik", 12), fg_color=CARD2, border_color=SEP,
                          text_color=FG, justify='center', height=38, corner_radius=8)
        te.insert(0, self.cfg.get('trigger', 'score'))
        te.pack(fill='x', padx=24)
        te.bind('<KeyRelease>', lambda e: self._save_setting('trigger', te.get().strip().lower()))
        _sep()

        # ── X01 Game Tracking ─────────────────────────────────────────────
        _sec("X01 GAME TRACKING")

        pd_var = ctk.BooleanVar(value=self.cfg.get('per_dart_mode', False))
        _chk(scroll, "Per-dart scoring  (say each dart individually)", pd_var,
             lambda: self._save_setting('per_dart_mode', pd_var.get()))

        lc_var = ctk.BooleanVar(value=self.cfg.get('live_checkout', False))

        def _toggle_live_checkout():
            self._save_setting('live_checkout', lc_var.get())
            # reset remaining so it initialises fresh next time listening starts
            self._x01_remaining = None
            self._update_remaining_display()
            self._rebuild_ui()
            self.after(50, self._open_settings)

        ctk.CTkCheckBox(scroll, text="Live checkout tracking  (show remaining + route)",
                        variable=lc_var, font=("Rubik", 11),
                        fg_color=ACCENT, hover_color=PRI_HOV,
                        checkmark_color=PRI_FG, text_color=FG, border_color=SEP,
                        command=_toggle_live_checkout
                        ).pack(anchor='w', padx=24, pady=(0, 7))

        ctk.CTkLabel(scroll, text="Starting score", text_color=FG2,
                     font=("Rubik", 9)).pack(anchor='w', padx=24, pady=(0, 2))
        start_var = ctk.StringVar(value=str(self.cfg.get('x01_start', 501)))
        ctk.CTkOptionMenu(scroll, variable=start_var, values=['501', '301', '701', '170'],
                          font=("Rubik", 11),
                          fg_color=CARD2, button_color=ACCENT_DIM, button_hover_color=ACCENT,
                          text_color=FG, dropdown_fg_color=CARD, dropdown_text_color=FG,
                          dropdown_hover_color=CARD2, corner_radius=8,
                          command=lambda v: self._save_setting('x01_start', int(v))
                          ).pack(fill='x', padx=24, pady=(0, 6))

        ctk.CTkLabel(scroll, text="Cancel word  (say to undo last dart / score)",
                     text_color=FG2, font=("Rubik", 9)).pack(anchor='w', padx=24, pady=(0, 2))
        cw_entry = ctk.CTkEntry(scroll, font=("Rubik", 12), fg_color=CARD2, border_color=SEP,
                                text_color=FG, justify='center', height=38, corner_radius=8)
        cw_entry.insert(0, self.cfg.get('cancel_word', 'wait'))
        cw_entry.pack(fill='x', padx=24)
        cw_entry.bind('<KeyRelease>',
                      lambda e: self._save_setting('cancel_word', cw_entry.get().strip().lower()))

        ctk.CTkLabel(scroll, text='Say "new leg" at any time to reset the counter.',
                     text_color=FG3, font=("Rubik", 9), justify='left'
                     ).pack(anchor='w', padx=24, pady=(6, 0))
        _sep()

        # ── Voice Assistant ──────────────────────────────────────────────
        _sec("VOICE ASSISTANT")
        va = ctk.BooleanVar(value=self.cfg.get('voice_assist', False))
        _chk(scroll, "Enable voice assistant", va,
             lambda: self._save_setting('voice_assist', va.get()))

        vc = ctk.BooleanVar(value=self.cfg.get('voice_confirm', True))
        _chk(scroll, "Read back scores", vc,
             lambda: self._save_setting('voice_confirm', vc.get()))

        vs_var = ctk.BooleanVar(value=self.cfg.get('voice_stats', True))
        _chk(scroll, "Announce session average (X01)", vs_var,
             lambda: self._save_setting('voice_stats', vs_var.get()))

        ctk.CTkLabel(scroll, text="Speech speed", text_color=FG2,
                     font=("Rubik", 9)).pack(anchor='w', padx=24, pady=(0, 2))
        vr = ctk.IntVar(value=self.cfg.get('voice_rate', 170))
        ctk.CTkSlider(scroll, from_=100, to=250, variable=vr,
                       fg_color=SEP, progress_color=ACCENT_DIM,
                       button_color=ACCENT, button_hover_color=PRI_HOV,
                       command=lambda v: self._save_setting('voice_rate', int(v))
                       ).pack(fill='x', padx=24, pady=(0, 2))
        rate_lbl = ctk.CTkLabel(scroll, text=f"{vr.get()} wpm", text_color=FG3,
                                font=("Rubik", 9))
        rate_lbl.pack(anchor='w', padx=24, pady=(0, 4))
        vr.trace_add('write', lambda *_: rate_lbl.configure(text=f"{vr.get()} wpm"))

        ctk.CTkLabel(scroll, text="Volume", text_color=FG2,
                     font=("Rubik", 9)).pack(anchor='w', padx=24, pady=(0, 2))
        vv2 = ctk.DoubleVar(value=self.cfg.get('voice_volume', 0.9))
        ctk.CTkSlider(scroll, from_=0.1, to=1.0, variable=vv2,
                       fg_color=SEP, progress_color=ACCENT_DIM,
                       button_color=ACCENT, button_hover_color=PRI_HOV,
                       command=lambda v: self._save_setting('voice_volume', round(float(v), 2))
                       ).pack(fill='x', padx=24, pady=(0, 2))
        vol_lbl = ctk.CTkLabel(scroll, text=f"{int(vv2.get()*100)}%", text_color=FG3,
                               font=("Rubik", 9))
        vol_lbl.pack(anchor='w', padx=24, pady=(0, 6))
        vv2.trace_add('write', lambda *_: vol_lbl.configure(text=f"{int(vv2.get()*100)}%"))

        _btn("Test Voice", lambda: speak("One hundred and eighty!", self.cfg))

        # Bottom padding
        ctk.CTkFrame(scroll, fg_color='transparent', height=12).pack()

    # ── Mic selector ─────────────────────────────────────────────────────────
    def _select_mic(self):
        import pyaudio
        pa = pyaudio.PyAudio()

        # Build list: (index, clean_name)
        mic_data = []
        for i in range(pa.get_device_count()):
            info = pa.get_device_info_by_index(i)
            if info.get('maxInputChannels', 0) < 1:
                continue
            raw = info['name']
            try:                                   # fix pyaudio latin-1/utf-8 mismatch
                raw = raw.encode('latin-1').decode('utf-8')
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            mic_data.append((i, raw))
        pa.terminate()

        win = ctk.CTkToplevel(self)
        win.title("Select Microphone")
        win.geometry(self._right_of(400, 420))
        win.configure(fg_color=BG)
        win.attributes('-topmost', True)
        win.resizable(False, False)
        win.after(50, lambda: (win.lift(), win.focus_force()))

        # Header
        hdr = ctk.CTkFrame(win, fg_color=CARD, corner_radius=0, height=48)
        hdr.pack(fill='x')
        hdr.pack_propagate(False)
        lc = tk.Canvas(hdr, width=22, height=22, bg=CARD, highlightthickness=0)
        lc.place(x=24, rely=0.5, anchor='w')
        self._draw_bullseye(lc, 11, 11, [9, 6, 3, 1])
        ctk.CTkLabel(hdr, text="  SELECT MICROPHONE", text_color=FG,
                     font=("Uber Move Bold", 14, "bold")).place(x=50, rely=0.5, anchor='w')
        ctk.CTkFrame(win, fg_color=ACCENT_DIM, height=1).pack(fill='x')

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
                             args=(data, self.cfg.get('cricket_grid', {}), speed), daemon=True).start()
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
        self.after(0, lambda s=str(score), a=f"{avg:.1f}", d=str(darts): (
            self._score_str.set(s),
            self._avg_str.set(a),
            self._darts_str.set(d),
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
        self.after(0, lambda s=disp, a=f"{avg:.1f}", d=str(darts): (
            self._score_str.set(s),
            self._avg_str.set(a),
            self._darts_str.set(d),
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