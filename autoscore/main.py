import sys, os, traceback

# ── Crash logger ──────────────────────────────────────────────────────────────
def _get_log_path():
    try:
        if 'ANDROID_ARGUMENT' in os.environ:
            from android.storage import primary_external_storage_path  # type: ignore
            return os.path.join(primary_external_storage_path(), 'dartvoice_crash.txt')
    except Exception:
        pass
    return os.path.join(os.path.expanduser('~'), 'dartvoice_crash.txt')

def _crash_handler(exc_type, exc_value, exc_tb):
    msg = ''.join(traceback.format_exception(exc_type, exc_value, exc_tb))
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
