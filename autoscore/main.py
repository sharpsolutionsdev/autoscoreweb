import sys, os, traceback

# ── Crash logger ──────────────────────────────────────────────────────────────
def _get_log_path():
    """Write crash log to app-private storage (always accessible)."""
    try:
        if 'ANDROID_ARGUMENT' in os.environ:
            from android.storage import app_storage_path  # type: ignore
            return os.path.join(app_storage_path(), 'dartvoice_crash.txt')
    except Exception:
        pass
    return os.path.join(os.path.expanduser('~'), 'dartvoice_crash.txt')

def _crash_handler(exc_type, exc_value, exc_tb):
    msg = ''.join(traceback.format_exception(exc_type, exc_value, exc_tb))
    # Always print to stderr (shows in logcat on Android)
    print('DARTVOICE CRASH:', msg, file=sys.stderr, flush=True)
    try:
        with open(_get_log_path(), 'w') as f:
            f.write(msg)
    except Exception:
        pass
    sys.__excepthook__(exc_type, exc_value, exc_tb)

sys.excepthook = _crash_handler

# ── App entry ─────────────────────────────────────────────────────────────────
try:
    from dartvoice_android import DartVoiceAndroidApp
    DartVoiceAndroidApp().run()
except Exception:
    _crash_handler(*sys.exc_info())
