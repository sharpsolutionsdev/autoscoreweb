"""
Minimal Vosk wrapper for Android using ctypes.
================================================
The pip vosk package (0.3.45) imports srt, requests, tqdm, and cffi at the top
level — none of which are available on Android.  This module provides the same
Model + KaldiRecognizer API using only ctypes to load libvosk.so, which IS
bundled in the APK by python-for-android's vosk recipe.
"""

import ctypes, os, sys, json

# ── Locate and load libvosk.so ────────────────────────────────────────────────
_lib = None

def _load_libvosk():
    global _lib
    if _lib is not None:
        return _lib

    # Search paths (in priority order)
    candidates = []

    # 1. The pip vosk package ships libvosk.so beside __init__.py
    try:
        import vosk as _vosk_pkg
        pkg_dir = os.path.dirname(_vosk_pkg.__file__)
        candidates.append(os.path.join(pkg_dir, 'libvosk.so'))
    except Exception:
        pass

    # 2. Site-packages vosk dir (if vosk package import failed but .so exists)
    for p in sys.path:
        candidates.append(os.path.join(p, 'vosk', 'libvosk.so'))

    # 3. Next to this file
    here = os.path.dirname(os.path.abspath(__file__))
    candidates.append(os.path.join(here, 'libvosk.so'))

    # 4. Android app storage
    if 'ANDROID_ARGUMENT' in os.environ:
        try:
            from android.storage import app_storage_path
            base = app_storage_path()
            candidates.append(os.path.join(base, 'app', '_python_bundle',
                                           'site-packages', 'vosk', 'libvosk.so'))
        except Exception:
            pass

    for path in candidates:
        if os.path.isfile(path):
            try:
                _lib = ctypes.cdll.LoadLibrary(path)
                _setup_prototypes(_lib)
                return _lib
            except OSError:
                continue

    raise ImportError(
        f"Cannot find libvosk.so. Searched: {candidates}"
    )


def _setup_prototypes(lib):
    """Declare C function signatures so ctypes can marshal correctly."""
    # vosk_model_new / free
    lib.vosk_model_new.restype  = ctypes.c_void_p
    lib.vosk_model_new.argtypes = [ctypes.c_char_p]
    lib.vosk_model_free.restype  = None
    lib.vosk_model_free.argtypes = [ctypes.c_void_p]

    # vosk_recognizer_new / free
    lib.vosk_recognizer_new.restype  = ctypes.c_void_p
    lib.vosk_recognizer_new.argtypes = [ctypes.c_void_p, ctypes.c_float]
    lib.vosk_recognizer_free.restype  = None
    lib.vosk_recognizer_free.argtypes = [ctypes.c_void_p]

    # vosk_recognizer_accept_waveform
    lib.vosk_recognizer_accept_waveform.restype  = ctypes.c_int
    lib.vosk_recognizer_accept_waveform.argtypes = [
        ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int
    ]

    # vosk_recognizer_result / partial_result / final_result
    lib.vosk_recognizer_result.restype  = ctypes.c_char_p
    lib.vosk_recognizer_result.argtypes = [ctypes.c_void_p]
    lib.vosk_recognizer_partial_result.restype  = ctypes.c_char_p
    lib.vosk_recognizer_partial_result.argtypes = [ctypes.c_void_p]
    lib.vosk_recognizer_final_result.restype  = ctypes.c_char_p
    lib.vosk_recognizer_final_result.argtypes = [ctypes.c_void_p]

    # vosk_set_log_level
    lib.vosk_set_log_level.restype  = None
    lib.vosk_set_log_level.argtypes = [ctypes.c_int]

    # Suppress Kaldi log spam
    lib.vosk_set_log_level(0)


# ── Public API (drop-in replacement for vosk.Model / vosk.KaldiRecognizer) ──

class Model:
    """Wrapper around vosk_model_new."""

    def __init__(self, model_path):
        lib = _load_libvosk()
        self._handle = lib.vosk_model_new(model_path.encode('utf-8'))
        if not self._handle:
            raise Exception(f"Failed to create Vosk model from {model_path}")

    def __del__(self):
        if hasattr(self, '_handle') and self._handle:
            try:
                _load_libvosk().vosk_model_free(self._handle)
            except Exception:
                pass
            self._handle = None


class KaldiRecognizer:
    """Wrapper around vosk_recognizer_*."""

    def __init__(self, model, sample_rate):
        lib = _load_libvosk()
        self._handle = lib.vosk_recognizer_new(
            model._handle, ctypes.c_float(sample_rate)
        )
        if not self._handle:
            raise Exception("Failed to create Vosk recognizer")

    def AcceptWaveform(self, data):
        lib = _load_libvosk()
        return lib.vosk_recognizer_accept_waveform(
            self._handle, data, len(data)
        )

    def Result(self):
        lib = _load_libvosk()
        return lib.vosk_recognizer_result(self._handle).decode('utf-8')

    def PartialResult(self):
        lib = _load_libvosk()
        return lib.vosk_recognizer_partial_result(self._handle).decode('utf-8')

    def FinalResult(self):
        lib = _load_libvosk()
        return lib.vosk_recognizer_final_result(self._handle).decode('utf-8')

    def __del__(self):
        if hasattr(self, '_handle') and self._handle:
            try:
                _load_libvosk().vosk_recognizer_free(self._handle)
            except Exception:
                pass
            self._handle = None
