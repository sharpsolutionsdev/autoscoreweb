"""
DartVoice Android Background Service
=====================================
Runs as a separate Android foreground service process (python-for-android).
Keeps the speech listener alive when the screen is off or the app is in the
background.  Communicates with the main UI via a shared JSON state file.

The main app starts this service with:
    from android import AndroidService
    service = AndroidService('DartVoice', 'Listening for scores...')
    service.start('started')

The service writes recognised scores to  <app_storage>/dv_scores.json  which
the main app polls via Clock.schedule_interval.
"""

import os, sys, json, threading, time

# ── p4a service bootstrap ──────────────────────────────────────────────────
# This file runs inside a separate Android process.  Make the app's source
# directory importable so we can reuse the parsers.
_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.dirname(_here)
if _root not in sys.path:
    sys.path.insert(0, _root)

from android.storage import app_storage_path  # type: ignore
from android import mActivity                  # type: ignore  (may be None in service)

STATE_FILE  = os.path.join(app_storage_path(), 'dv_scores.json')
MODEL_NAME  = 'vosk-model-small-en-us'
MODEL_PATH  = os.path.join(app_storage_path(), MODEL_NAME)
CONFIG_FILE = os.path.join(app_storage_path(), 'dartvoice_config.json')

# ── Reuse parsers from main app ───────────────────────────────────────────
try:
    from dartvoice_android import (parse_score, parse_cricket_darts,
                                   parse_single_dart, _ensure_model)
except ImportError:
    # Fallback: define minimal versions inline
    def parse_score(text): return None
    def parse_cricket_darts(text): return []
    def parse_single_dart(text): return None
    def _ensure_model():
        # Check writable storage first
        if os.path.isdir(MODEL_PATH):
            return MODEL_PATH
        # Check beside this script (p4a copies source into private/)
        _local = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', MODEL_NAME)
        if os.path.isdir(_local):
            import shutil
            try:
                shutil.copytree(_local, MODEL_PATH)
                return MODEL_PATH
            except Exception:
                return _local
        return None

# ─────────────────────────────────────────────────────────────────────────────
# Shared state file helpers
# ─────────────────────────────────────────────────────────────────────────────
def _read_config():
    defaults = {
        'game_mode': 'X01', 'trigger': 'score',
        'require_trigger': True, 'mic_index': None,
    }
    try:
        with open(CONFIG_FILE) as f:
            return {**defaults, **json.load(f)}
    except Exception:
        return defaults

def _push_score(data):
    """Append a score event to the shared state file for the UI to consume."""
    events = []
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE) as f:
                events = json.load(f)
    except Exception:
        pass
    events.append({'ts': time.time(), 'data': data})
    # Keep only the last 50 events to prevent unbounded growth
    events = events[-50:]
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(events, f)
    except Exception:
        pass

def _post_status(msg):
    """Write a status string for the UI to pick up."""
    try:
        path = os.path.join(app_storage_path(), 'dv_status.txt')
        with open(path, 'w') as f:
            f.write(msg)
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
# Foreground notification (keeps Android from killing the service)
# ─────────────────────────────────────────────────────────────────────────────
def _start_foreground_notification():
    try:
        from jnius import autoclass, cast  # type: ignore
        PythonService      = autoclass('org.kivy.android.PythonService')
        NotificationBuilder = autoclass('android.app.Notification$Builder')
        NotificationManager = autoclass('android.app.NotificationManager')
        Context            = autoclass('android.content.Context')
        NotificationChannel = autoclass('android.app.NotificationChannel')

        service = PythonService.mService
        channel_id = 'dartvoice_channel'

        # Create notification channel (Android 8+)
        nm = cast(NotificationManager,
                  service.getSystemService(Context.NOTIFICATION_SERVICE))
        channel = NotificationChannel(
            channel_id, 'DartVoice', NotificationManager.IMPORTANCE_LOW,
        )
        channel.setDescription('DartVoice is listening for scores')
        nm.createNotificationChannel(channel)

        notification = NotificationBuilder(service, channel_id) \
            .setContentTitle('DartVoice') \
            .setContentText('Listening for scores…') \
            .setSmallIcon(service.getApplicationInfo().icon) \
            .setOngoing(True) \
            .build()

        service.startForeground(1, notification)
    except Exception as e:
        _post_status(f'Notification error: {e}')

# ─────────────────────────────────────────────────────────────────────────────
# Audio + Vosk listener
# ─────────────────────────────────────────────────────────────────────────────
_stop_event = threading.Event()

def _listen_loop():
    model_path = _ensure_model()
    if not model_path:
        _post_status('Model not found')
        return

    try:
        from vosk_android import Model, KaldiRecognizer
        model = Model(model_path)
        rec   = KaldiRecognizer(model, 16000)
    except Exception as e:
        _post_status(f'Vosk error: {e}')
        return

    try:
        from jnius import autoclass  # type: ignore
        AudioRecord   = autoclass('android.media.AudioRecord')
        AudioFormat   = autoclass('android.media.AudioFormat')
        MediaRecorder = autoclass('android.media.MediaRecorder$AudioSource')
    except Exception as e:
        _post_status(f'Audio init error: {e}')
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
        _post_status(f'Mic error: {e}')
        return

    _post_status('Listening')
    cfg   = _read_config()
    chunk = bytearray(4096)

    while not _stop_event.is_set():
        try:
            # Re-read config periodically to pick up mode/trigger changes
            cfg = _read_config()

            n = recorder.read(chunk, len(chunk))
            if n <= 0:
                continue
            data = bytes(chunk[:n])

            if rec.AcceptWaveform(data):
                text = json.loads(rec.Result()).get('text', '').lower()
                _process(text, cfg)
            else:
                partial = json.loads(rec.PartialResult()).get('partial', '')
                trigger = cfg.get('trigger', 'score').lower()
                if cfg.get('require_trigger', True) and trigger in partial:
                    _post_status('Trigger heard…')
        except Exception:
            continue

    try:
        recorder.stop()
        recorder.release()
    except Exception:
        pass
    _post_status('Stopped')


def _process(text, cfg):
    text = text.lower().strip()

    # Cancel word (no trigger required)
    cancel = cfg.get('cancel_word', 'wait').lower().strip()
    if cancel and text == cancel:
        _push_score({'action': 'cancel'})
        _post_status('Cancelled')
        return

    # New leg / reset (no trigger required)
    if any(p in text for p in ('new leg', 'new game', 'next leg', 'reset leg',
                               'reset game', 'restart leg')):
        _push_score({'action': 'new_leg'})
        _post_status('New leg')
        return

    trigger = cfg.get('trigger', 'score').lower()
    require = cfg.get('require_trigger', True)
    if require:
        if trigger not in text:
            return
        after = text.split(trigger, 1)[-1].strip()
    else:
        after = text.replace(trigger, '').strip()

    mode = cfg.get('game_mode', 'X01')

    # "enter" command — submit accumulated darts early
    if after == 'enter' or text.strip() == 'enter':
        if cfg.get('per_dart_mode', False):
            _push_score({'action': 'dart_submit'})
            _post_status('Enter pressed')
        return

    if mode == 'Cricket':
        darts = parse_cricket_darts(after)
        if darts:
            _push_score({'mode': 'Cricket', 'darts': darts})
            _post_status('Darts recorded')
    elif cfg.get('per_dart_mode', False):
        dart = parse_single_dart(after)
        if dart is not None:
            _push_score({'mode': 'X01', 'dart': list(dart)})
            _post_status(f'Dart: {dart[1]}')
    else:
        score = parse_score(after)
        if score is not None and 0 <= score <= 180:
            _push_score({'mode': 'X01', 'score': score})
            _post_status(f'Score: {score}')


# ─────────────────────────────────────────────────────────────────────────────
# Service entry point
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    _start_foreground_notification()
    listen_thread = threading.Thread(target=_listen_loop, daemon=False)
    listen_thread.start()

    # Keep the service process alive until Android kills it
    while listen_thread.is_alive():
        time.sleep(1)
