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
from kivy.uix.widget import Widget
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.utils import platform as kivy_platform
from kivy.metrics import dp, sp
from kivy.graphics import Color, RoundedRectangle, Ellipse, Line

# ─────────────────────────────────────────────────────────────────────────────
# Palette (matches desktop app)
# ─────────────────────────────────────────────────────────────────────────────
BG      = (0.031, 0.031, 0.039, 1)
CARD    = (0.067, 0.067, 0.078, 1)
FG      = (0.941, 0.941, 0.961, 1)
FG2     = (0.431, 0.431, 0.510, 1)
ACCENT  = (0.784, 0.063, 0.180, 1)   # Sharp Red default
SEP     = (0.145, 0.145, 0.188, 1)

def hex_to_kivy(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4)) + (1,)

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
        'voice_assist': True, 'voice_rate': 1.0,
        'mic_index': None,
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
_ONES = {
    'zero':0,'oh':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,
    'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,
    'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,
    'eighteen':18,'nineteen':19,
}
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
    'devil':'d','doubles':'d','doubled':'d','dabble':'d',
    'singles':'s','singled':'s',
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
    def __init__(self, model_path, cfg, on_score, on_status):
        super().__init__(daemon=True)
        self.model_path = model_path
        self.cfg        = cfg
        self.on_score   = on_score
        self.on_status  = on_status
        self._stop      = threading.Event()

    def stop(self):
        self._stop.set()

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
        while not self._stop.is_set():
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
        while not self._stop.is_set():
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
        text    = text.lower()
        trigger = self.cfg.get('trigger', 'score').lower()
        require = self.cfg.get('require_trigger', True)
        if require:
            if trigger not in text: return
            after = text.split(trigger, 1)[-1].strip()
        else:
            after = text.replace(trigger, '').strip()

        mode = self.cfg.get('game_mode', 'X01')
        if mode == 'Cricket':
            darts = parse_cricket_darts(after)
            if darts:
                self.on_score(darts)
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
        color=FG, size_hint_y=None, height=dp(52),
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
# Paywall overlay
# ─────────────────────────────────────────────────────────────────────────────
class PaywallOverlay(FloatLayout):
    """
    Full-screen overlay shown when the demo has expired and the user has
    no active subscription.  Two modes:
      - Subscribe: opens Stripe Checkout, polls for confirmation.
      - Sign In: email OTP flow, signs in and re-checks subscription.
    """

    def __init__(self, on_unlocked, **kwargs):
        super().__init__(**kwargs)
        self._on_unlocked = on_unlocked
        self._poll_event  = None
        self._card        = None
        self._build()

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

        # Mic ring icon (bullseye-style)
        icon_wrap = Widget(size_hint_y=None, height=dp(56))
        with icon_wrap.canvas:
            # Outer ring
            Color(ar * 0.15, ag * 0.01, ab * 0.03, 1)
            icon_wrap._ring2 = Ellipse(size=(dp(52), dp(52)), pos=(0, 0))
            # Inner ring
            Color(*ACCENT)
            icon_wrap._ring1 = Ellipse(size=(dp(36), dp(36)), pos=(0, 0))
            # Centre
            Color(*CARD)
            icon_wrap._dot = Ellipse(size=(dp(18), dp(18)), pos=(0, 0))
        def _upd_icon(*_):
            cx, cy = icon_wrap.center_x, icon_wrap.center_y
            for el, d in [(icon_wrap._ring2, 52), (icon_wrap._ring1, 36), (icon_wrap._dot, 18)]:
                r = dp(d) / 2
                el.pos = (cx - r, cy - r)
        icon_wrap.bind(pos=_upd_icon, size=_upd_icon)
        card.add_widget(icon_wrap)

        # Title
        card.add_widget(Label(
            text='DARTVOICE PRO',
            font_size=sp(20), bold=True, color=FG,
            size_hint_y=None, height=dp(28),
            halign='center', valign='middle',
        ))

        # Description
        card.add_widget(Label(
            text=(
                'Experience completely unrestricted\nvoice scoring.\n\n'
                'Start your 7-day free trial today.\n'
                'Auto-bills \u00a36.99/month. Cancel any time.'
            ),
            font_size=sp(12), color=FG2,
            halign='center', valign='middle',
            size_hint_y=None, height=dp(110),
        ))

        # Subscribe button
        self._sub_btn = _accent_btn(
            'START 7-DAY FREE TRIAL  \u2192  \u00a36.99/mo', self._open_checkout
        )
        card.add_widget(self._sub_btn)

        # Status label
        self._status_lbl = Label(
            text='', font_size=sp(11), color=FG2,
            size_hint_y=None, height=dp(20),
        )
        card.add_widget(self._status_lbl)

        # "Already paid" ghost button
        already_btn = _ghost_btn("I've already paid — check now", self._check_now)
        card.add_widget(already_btn)

        # Sign-in link
        signin_btn = _ghost_btn("Already have an account? Sign In", self._show_signin)
        card.add_widget(signin_btn)

        self._card = card
        self.add_widget(card)

    def _open_checkout(self):
        import webbrowser
        try:
            from billing import get_checkout_url
            url = get_checkout_url()
        except ImportError:
            return
        webbrowser.open(url)
        self._sub_btn.text = 'Waiting for payment…'
        # Auto-poll after a short delay
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

        def _got(subscribed):
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
                    self._sub_btn, 'text', 'START 7-DAY FREE TRIAL  \u2192  \u00a36.99/mo'
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
            font_size=sp(14), multiline=False,
            background_color=(0.1, 0.1, 0.12, 1),
            foreground_color=FG,
            cursor_color=ACCENT,
            size_hint_y=None, height=dp(46),
        )
        panel.add_widget(self._si_email)

        self._si_send_btn = _accent_btn('CONTINUE  →', self._si_send)
        panel.add_widget(self._si_send_btn)

        # OTP step (hidden initially)
        self._si_code = TextInput(
            hint_text='6-digit code',
            font_size=sp(22), multiline=False,
            halign='center',
            background_color=(0.1, 0.1, 0.12, 1),
            foreground_color=FG,
            cursor_color=ACCENT,
            input_filter='int',
            size_hint_y=None, height=dp(54),
            opacity=0, disabled=True,
        )
        panel.add_widget(self._si_code)

        self._si_verify_btn = _accent_btn('VERIFY CODE  →', self._si_verify)
        self._si_verify_btn.opacity  = 0
        self._si_verify_btn.disabled = True
        panel.add_widget(self._si_verify_btn)

        self._si_msg = Label(
            text='', font_size=sp(11), color=(0.87, 0.33, 0.33, 1),
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
class DartVoiceLayout(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(orientation='vertical', spacing=dp(6),
                         padding=dp(10), **kwargs)
        Window.clearcolor = BG

        self.cfg   = load_config()
        self.state = GameState(
            mode  = self.cfg.get('game_mode', 'X01'),
            start = int(self.cfg.get('x01_start', 501)),
        )
        self._listener  = None
        self._active    = False
        self._status_ev = None

        self._build()
        Clock.schedule_once(lambda dt: self._billing_gate(), 0.5)

    def _billing_gate(self):
        try:
            from billing import billing_status, check_subscription_async
        except ImportError:
            return

        bs = billing_status()
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

    def _on_billing_checked(self, subscribed: bool):
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

    def _show_paywall(self):
        if hasattr(self, '_paywall_overlay') and self._paywall_overlay.parent:
            return
        overlay = PaywallOverlay(
            on_unlocked=self._remove_paywall,
            size_hint=(1, 1),
            pos_hint={'x': 0, 'y': 0},
        )
        self._paywall_overlay = overlay
        self.add_widget(overlay)

    def _remove_paywall(self):
        if hasattr(self, '_paywall_overlay') and self._paywall_overlay.parent:
            self.remove_widget(self._paywall_overlay)
        self.status_lbl.text = 'Subscription active — welcome!'

    def _build(self):
        # ── Dartboard wire background ─────────────────────────────────────
        from kivy.graphics import Line
        with self.canvas.before:
            Color(*BG)
            self._bg_fill = RoundedRectangle(pos=self.pos, size=self.size, radius=[0])
        self.bind(pos=lambda *_: setattr(self._bg_fill, 'pos', self.pos),
                  size=lambda *_: setattr(self._bg_fill, 'size', self.size))
        self._wire_canvas = None  # drawn on first layout

        def _draw_wire(*_):
            if not self.width or not self.height:
                return
            cw, ch = self.width, self.height
            cx = cw / 2
            cy = ch + dp(40)  # origin above screen centre — radiates down
            # Redraw on the widget's canvas (after) as a subtle overlay
            self.canvas.after.clear()
            with self.canvas.after:
                import math
                wire_col = (0.075, 0.075, 0.09, 1)
                for r in (dp(80), dp(140), dp(200), dp(270), dp(360), dp(460), dp(570)):
                    Color(*wire_col)
                    points = []
                    steps = 64
                    for i in range(steps + 1):
                        a = math.radians(i * 360 / steps)
                        points += [cx + r * math.cos(a), cy + r * math.sin(a)]
                    Line(points=points, width=dp(0.6))
                for i in range(20):
                    ang = math.radians(i * 18)
                    ex = cx + dp(570) * math.cos(ang)
                    ey = cy + dp(570) * math.sin(ang)
                    Line(points=[cx, cy, ex, ey], width=dp(0.5))

        self.bind(size=_draw_wire, pos=_draw_wire)

        # ── Top accent bar ────────────────────────────────────────────────
        accent_bar = Widget(size_hint_y=None, height=dp(3))
        with accent_bar.canvas:
            Color(*ACCENT)
            accent_bar._rect = RoundedRectangle(pos=accent_bar.pos, size=accent_bar.size, radius=[0])
        accent_bar.bind(pos=lambda *_: setattr(accent_bar._rect, 'pos', accent_bar.pos),
                        size=lambda *_: setattr(accent_bar._rect, 'size', accent_bar.size))
        self.add_widget(accent_bar)

        # ── Header nav bar ────────────────────────────────────────────────
        hdr = BoxLayout(
            orientation='horizontal', size_hint_y=None, height=dp(52),
            padding=[dp(14), dp(8), dp(14), dp(8)], spacing=dp(10),
        )
        _card_bg(hdr, color=CARD, radius=0)

        # Bullseye logo (drawn on a Widget canvas)
        from kivy.graphics import Ellipse as KvEllipse
        logo = Widget(size_hint=(None, None), size=(dp(28), dp(28)))
        with logo.canvas:
            for r, col in [
                (dp(14), (0.2, 0.2, 0.24, 1)),
                (dp(9),  ACCENT),
                (dp(6),  (0.2, 0.2, 0.24, 1)),
                (dp(3),  ACCENT),
                (dp(1.2),(0.94, 0.94, 0.96, 1)),
            ]:
                Color(*col)
                KvEllipse(pos=(logo.center_x - r, logo.center_y - r), size=(r*2, r*2))
        logo.bind(
            pos=lambda w, *_: logo.canvas.clear() or _redraw_logo(w),
        )

        def _redraw_logo(w):
            with w.canvas:
                for r, col in [
                    (dp(14), (0.2, 0.2, 0.24, 1)),
                    (dp(9),  ACCENT),
                    (dp(6),  (0.2, 0.2, 0.24, 1)),
                    (dp(3),  ACCENT),
                    (dp(1.2),(0.94, 0.94, 0.96, 1)),
                ]:
                    Color(*col)
                    KvEllipse(pos=(w.center_x - r, w.center_y - r), size=(r*2, r*2))

        hdr.add_widget(logo)

        title_lbl = Label(
            text='DARTVOICE', font_size=sp(18), bold=True,
            color=FG, halign='left', valign='middle',
            size_hint_x=1,
        )
        hdr.add_widget(title_lbl)

        self.mode_spinner = Spinner(
            text=self.cfg.get('game_mode', 'X01'),
            values=['X01', 'Cricket'],
            size_hint=(None, None), size=(dp(90), dp(34)),
            font_size=sp(12), bold=True,
            background_normal='', background_color=(0, 0, 0, 0),
            color=FG2,
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
        self.add_widget(hdr)

        # Thin separator
        sep = Widget(size_hint_y=None, height=dp(1))
        with sep.canvas:
            Color(*SEP)
            sep._rect = RoundedRectangle(pos=sep.pos, size=sep.size, radius=[0])
        sep.bind(pos=lambda *_: setattr(sep._rect, 'pos', sep.pos),
                 size=lambda *_: setattr(sep._rect, 'size', sep.size))
        self.add_widget(sep)

        # ── Score canvas (corner brackets + radial glow) ─────────────────
        score_wrap = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(168))

        def _draw_score_canvas(w, *_):
            w.canvas.before.clear()
            cw, ch = w.width, w.height
            if not cw or not ch:
                return
            with w.canvas.before:
                # Card background
                Color(*CARD)
                RoundedRectangle(pos=w.pos, size=w.size, radius=[dp(14)])

                # Radial glow behind score (active state only)
                if self._active:
                    ar, ag, ab = ACCENT[0], ACCENT[1], ACCENT[2]
                    cr, cg, cb = CARD[0], CARD[1], CARD[2]
                    cx, cy = w.x + cw / 2, w.y + ch / 2
                    for gw_f, gh_f, alpha in ((0.9, 1.5, 0.06), (0.6, 1.0, 0.11), (0.35, 0.65, 0.16)):
                        gw2, gh2 = cw * gw_f, ch * gh_f
                        Color(
                            ar * alpha + cr * (1 - alpha),
                            ag * alpha + cg * (1 - alpha),
                            ab * alpha + cb * (1 - alpha),
                            1,
                        )
                        Ellipse(pos=(cx - gw2 / 2, cy - gh2 / 2), size=(gw2, gh2))

                # Corner bracket accent lines
                L = dp(18)
                T = dp(2)
                br_col = ACCENT if self._active else SEP
                Color(*br_col)
                x0, y0 = w.x, w.y
                x1, y1 = w.x + cw, w.y + ch
                Line(points=[x0, y0 + L, x0, y0, x0 + L, y0], width=T, cap='round')
                Line(points=[x1 - L, y0, x1, y0, x1, y0 + L], width=T, cap='round')
                Line(points=[x0, y1 - L, x0, y1, x0 + L, y1], width=T, cap='round')
                Line(points=[x1 - L, y1, x1, y1, x1, y1 - L], width=T, cap='round')

        score_wrap.bind(pos=_draw_score_canvas, size=_draw_score_canvas)
        self._score_wrap = score_wrap
        self._draw_score_canvas = _draw_score_canvas

        # "MAXIMUM" label — shown only on 180
        self.maximum_lbl = Label(
            text='', font_size=sp(9), bold=True,
            color=ACCENT, halign='center', valign='middle',
            size_hint=(1, None), height=dp(16),
        )
        score_wrap.add_widget(self.maximum_lbl)

        self.score_lbl = Label(
            text=str(self.state.remaining), font_size=sp(76), bold=True,
            color=FG, halign='center', valign='middle',
            size_hint=(1, 1),
        )
        score_wrap.add_widget(self.score_lbl)

        # Stat labels anchored at the bottom of the score card
        stats_row = BoxLayout(
            orientation='horizontal',
            size_hint=(1, None), height=dp(28),
        )
        self.avg_lbl   = Label(text='Avg —',   font_size=sp(12), color=FG2,
                                halign='center', valign='middle')
        self.darts_lbl = Label(text='Darts 0', font_size=sp(12), color=FG2,
                                halign='center', valign='middle')
        stats_row.add_widget(self.avg_lbl)
        stats_row.add_widget(self.darts_lbl)
        score_wrap.add_widget(stats_row)

        self.add_widget(score_wrap)

        # ── Cricket grid (hidden by default) ─────────────────────────────
        self.cricket_card = BoxLayout(
            orientation='vertical', size_hint_y=None, height=dp(260),
            padding=dp(10), spacing=dp(4),
        )
        _card_bg(self.cricket_card)
        self.cricket_grid = CricketGrid(self.state)
        self.cricket_card.add_widget(self.cricket_grid)
        self.add_widget(self.cricket_card)

        # ── Status pill ───────────────────────────────────────────────────
        status_wrap = BoxLayout(
            orientation='horizontal', size_hint_y=None, height=dp(32),
            padding=[0, dp(4), 0, dp(4)],
        )
        self.status_lbl = Label(
            text='Ready', font_size=sp(11), color=FG2,
            halign='center', valign='middle',
        )
        _card_bg(status_wrap, color=(0.11, 0.11, 0.14, 1), radius=20)
        status_wrap.add_widget(self.status_lbl)
        self.add_widget(status_wrap)

        # ── Toggle button ─────────────────────────────────────────────────
        self.toggle_btn = _accent_btn('START LISTENING', self._toggle)
        self.add_widget(self.toggle_btn)

        # ── History header ────────────────────────────────────────────────
        hist_hdr = BoxLayout(
            orientation='horizontal', size_hint_y=None, height=dp(28),
            padding=[dp(14), dp(6), dp(14), dp(0)],
        )
        hist_hdr.add_widget(Label(
            text='HISTORY', font_size=sp(9), bold=True,
            color=FG2, halign='left', valign='middle',
        ))
        self.add_widget(hist_hdr)

        # ── Scrollable history ────────────────────────────────────────────
        scroll = ScrollView(size_hint=(1, 1))
        self.history_box = BoxLayout(
            orientation='vertical', size_hint_y=None, spacing=0, padding=dp(4),
        )
        self.history_box.bind(minimum_height=self.history_box.setter('height'))
        scroll.add_widget(self.history_box)
        self.add_widget(scroll)

        # ── Reset button (ghost style) ────────────────────────────────────
        reset_btn = _ghost_btn('NEW GAME', self._reset)
        self.add_widget(reset_btn)

        self._refresh_mode_ui()

    # ── Mode switching ────────────────────────────────────────────────────────
    def _on_mode_change(self, spinner, value):
        self.cfg['game_mode'] = value
        save_config(self.cfg)
        self.state.mode = value
        self._reset()
        self._refresh_mode_ui()

    def _refresh_mode_ui(self):
        mode = self.cfg.get('game_mode', 'X01')
        if mode == 'Cricket':
            self.cricket_card.height  = dp(260)
            self.cricket_card.opacity = 1
            self.score_lbl.text = 'CRICKET'
            self.score_lbl.font_size = sp(48)
        else:
            self.cricket_card.height  = 0
            self.cricket_card.opacity = 0
            self.score_lbl.text = str(self.state.remaining)
            self.score_lbl.font_size = sp(76)

    # ── Listening toggle ──────────────────────────────────────────────────────
    def _toggle(self):
        if self._active:
            self._stop_listening()
        else:
            self._start_listening()

    def _set_toggle_style(self, active):
        """Repaint the toggle button background without stacking canvas instructions."""
        btn = self.toggle_btn
        # Active: dark tinted stop-bg with accent text + border; Inactive: full accent fill
        if active:
            r, g, b = ACCENT[0], ACCENT[1], ACCENT[2]
            bg_color = (r * 0.08, g * 0.06, b * 0.08, 1)
            fg_color = ACCENT
        else:
            bg_color = ACCENT
            fg_color = FG
        btn.color = fg_color
        btn.canvas.before.clear()
        with btn.canvas.before:
            if active:
                # Subtle border
                Color(*ACCENT)
                btn._border = RoundedRectangle(pos=btn.pos, size=btn.size, radius=[dp(12)])
                Color(*bg_color)
                pad = dp(1.5)
                btn._bg = RoundedRectangle(
                    pos=(btn.x + pad, btn.y + pad),
                    size=(btn.width - pad * 2, btn.height - pad * 2),
                    radius=[dp(11)],
                )
            else:
                Color(*bg_color)
                btn._bg = RoundedRectangle(pos=btn.pos, size=btn.size, radius=[dp(12)])
        if active:
            def _upd(*_):
                p = dp(1.5)
                btn._border.pos  = btn.pos
                btn._border.size = btn.size
                btn._bg.pos  = (btn.x + p, btn.y + p)
                btn._bg.size = (btn.width - p*2, btn.height - p*2)
            btn.bind(pos=_upd, size=_upd)
        else:
            btn.bind(
                pos=lambda *_: setattr(btn._bg, 'pos', btn.pos),
                size=lambda *_: setattr(btn._bg, 'size', btn.size),
            )
        # Trigger score wrap redraw (updates bracket colour + glow)
        if hasattr(self, '_draw_score_canvas') and hasattr(self, '_score_wrap'):
            self._draw_score_canvas(self._score_wrap)

    def _start_listening(self):
        if ANDROID:
            # Use the background service; it writes to dv_scores.json
            _start_foreground_service()
            self._poll_ev = Clock.schedule_interval(self._poll_service, 0.5)
        else:
            model_path = self._find_model()
            if not model_path:
                return
            self._listener = SpeechListener(
                model_path, self.cfg, self._on_score, self._set_status,
            )
            self._listener.start()
        self._active = True
        self.toggle_btn.text = 'STOP LISTENING'
        self._set_toggle_style(active=True)

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
            for ev in events:
                if ev.get('mode') == 'Cricket':
                    darts = [tuple(d) for d in ev.get('darts', [])]
                    if darts:
                        self._apply_cricket(darts)
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
    def _on_score(self, data):
        mode = self.cfg.get('game_mode', 'X01')
        if mode == 'Cricket':
            Clock.schedule_once(lambda dt: self._apply_cricket(data))
        else:
            Clock.schedule_once(lambda dt: self._apply_x01(data))

    def _apply_x01(self, score):
        result = self.state.apply_x01(score)
        self.score_lbl.text = str(self.state.remaining)
        # MAXIMUM treatment for 180
        if score == 180:
            self.maximum_lbl.text  = 'M A X I M U M'
            self.score_lbl.color   = ACCENT
        else:
            self.maximum_lbl.text  = ''
            self.score_lbl.color   = FG
        if self.state.scores:
            avg   = sum(self.state.scores) / len(self.state.scores)
            darts = len(self.state.scores) * 3
            self.avg_lbl.text   = f'Avg {avg:.1f}'
            self.darts_lbl.text = f'Darts {darts}'
        self._add_history(self.state.history[-1] if self.state.history else '')
        if result == 'bust':
            self._set_status('BUST!')
            speak('Bust', self.cfg)
        elif result == 'win':
            self._set_status('GAME SHOT!')
            speak('Game shot!', self.cfg)
        else:
            self._set_status(f'Score: {score}')
            speak(str(score), self.cfg)

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
        if self.state.mode == 'X01':
            self.score_lbl.text      = str(self.state.remaining)
            self.score_lbl.font_size = sp(76)
        else:
            self.score_lbl.text      = 'CRICKET'
            self.score_lbl.font_size = sp(48)
        self.score_lbl.color = FG
        if hasattr(self, 'maximum_lbl'):
            self.maximum_lbl.text = ''
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
            from android.permissions import request_permissions, Permission  # type: ignore
            request_permissions([Permission.RECORD_AUDIO])
            _start_foreground_service()
        Window.clearcolor = BG
        return DartVoiceLayout()

    def on_pause(self):
        # Allow the app to stay alive when home button is pressed
        return True

    def on_resume(self):
        pass


if __name__ == '__main__':
    DartVoiceAndroidApp().run()
