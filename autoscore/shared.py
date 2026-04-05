import os, sys, json, re, threading, time

# ─────────────────────────────────────────────────────────────────────────────
# Platform detection
# ─────────────────────────────────────────────────────────────────────────────
ANDROID = sys.platform == 'linux' and 'ANDROID_ARGUMENT' in os.environ

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
        'calibrated_x': None,
        'calibrated_y': None,
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

    # Check for marker file to confirm a complete extraction
    marker = os.path.join(dest, '.extracted')
    if os.path.isdir(dest) and os.path.exists(marker):
        return dest

    # Also check if the model already exists beside the script (p4a copies
    # source tree into the APK's private area, so it may exist directly)
    _here = os.path.dirname(os.path.abspath(__file__))
    local = os.path.join(_here, MODEL_NAME)
    if os.path.isdir(local):
        # Vosk often needs writable path on Android, so symlink / copy
        if not os.path.isdir(dest):
            import shutil
            try:
                shutil.copytree(local, dest)
                open(marker, 'w').write('ok')
                return dest
            except Exception:
                pass
        return local  # fallback: use the bundled dir directly

    # Extract from APK zip (assets/ or private/ prefix)
    try:
        import zipfile
        from android import mActivity  # type: ignore

        apk_path = mActivity.getPackageCodePath()
        with zipfile.ZipFile(apk_path, 'r') as z:
            # Try multiple possible prefixes used by different p4a bootstraps
            prefixes = [
                f'assets/{MODEL_NAME}/',
                f'assets/private/{MODEL_NAME}/',
                f'private/{MODEL_NAME}/',
                f'{MODEL_NAME}/',
            ]
            members = []
            used_prefix = ''
            for prefix in prefixes:
                candidates = [m for m in z.namelist() if m.startswith(prefix)]
                if candidates:
                    members = candidates
                    used_prefix = prefix
                    break

            if not members:
                return None
            os.makedirs(dest, exist_ok=True)
            for member in members:
                rel = member[len(used_prefix):]
                if not rel:
                    continue
                target = os.path.join(dest, rel)
                if member.endswith('/'):
                    os.makedirs(target, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with z.open(member) as src_f, open(target, 'wb') as dst_f:
                        dst_f.write(src_f.read())
            open(marker, 'w').write('ok')
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
# Shared Helpers
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
                    if not ctx: return # In service, mActivity is None
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
