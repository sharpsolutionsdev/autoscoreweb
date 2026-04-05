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
    # Import or startup failed — show error on screen using minimal Kivy
    msg = traceback.format_exc()
    print('DARTVOICE CRASH:\n' + msg, file=sys.stderr, flush=True)
    try:
        with open(_get_log_path(), 'w') as f:
            f.write(msg)
    except Exception:
        pass
    try:
        from kivy.app import App
        from kivy.uix.label import Label
        from kivy.core.window import Window
        Window.clearcolor = (0.05, 0.05, 0.07, 1)
        class CrashApp(App):
            def build(self):
                lbl = Label(text=f'DARTVOICE CRASH\n\n{msg}',
                            font_size='10sp', color=(1, 0.3, 0.3, 1),
                            halign='left', valign='top')
                lbl.bind(size=lambda i, v: setattr(i, 'text_size', v))
                return lbl
        CrashApp().run()
    except Exception:
        pass  # Kivy itself is broken — nothing we can do
