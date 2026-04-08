import os, sys

# ─────────────────────────────────────────────────────────────────────────────
# Platform detection & Settings
# ─────────────────────────────────────────────────────────────────────────────
os.environ.setdefault('KIVY_NO_ENV_CONFIG', '1')

# Ensure we're running under iOS (via Kivy-ios toolchain) if loaded in production
IOS = sys.platform == 'ios' or sys.platform == 'darwin'

from kivy.app import App
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.core.window import Window
from kivy.clock import Clock
from kivy.metrics import dp, sp

import shared

class DartVoiceIOSApp(App):
    """
    iOS Entry point. Mirrors dartvoice_android.py but uses pyobjus
    for native integrations (TTS, Microphone, WebView).
    """
    def build(self):
        Window.clearcolor = (0.031, 0.031, 0.039, 1) # BG
        self.root = FloatLayout()
        
        # Main layout stub
        lbl = Label(text="DartVoice iOS\n\nClose button will appear at top,\nWebView below it.", halign="center")
        self.root.add_widget(lbl)
        
        # Kivy Close Button (anchored at top)
        self.close_btn = Button(
            text="Close Web Scorer", 
            size_hint=(1, None), 
            height=dp(50), 
            pos_hint={'top': 1.0},
            background_color=(0.9, 0.2, 0.2, 1),
            opacity=0, # Hidden initially
            disabled=True
        )
        self.close_btn.bind(on_release=self._close_smart_browser)
        self.root.add_widget(self.close_btn)
        
        # Test launching after 1 second
        Clock.schedule_once(lambda dt: self._launch_smart_browser(), 1.0)
        return self.root

    def _launch_smart_browser(self):
        """
        Launches WKWebView on iOS.
        Uses pyobjus to access native iOS Safari WebKit.
        """
        if getattr(self, '_ios_wv', None):
            return
            
        try:
            from pyobjus import autoclass
            from pyobjus.dylib_manager import load_framework
            from pyobjus.objc_py_types import CGRect, CGPoint, CGSize
            
            load_framework('/System/Library/Frameworks/WebKit.framework')
            
            WKWebView = autoclass('WKWebView')
            NSURL = autoclass('NSURL')
            NSURLRequest = autoclass('NSURLRequest')
            UIScreen = autoclass('UIScreen')
            UIApplication = autoclass('UIApplication')
            
            # Constrain WKWebView to leave top 50dp for Kivy (Close Button)
            screen_bounds = UIScreen.mainScreen().bounds()
            w = screen_bounds.size.width
            h = screen_bounds.size.height
            # In iOS points, Kivy's dp(50) roughly translates to 50 points
            top_offset = 60 
            
            rect = CGRect(CGPoint(0, top_offset), CGSize(w, h - top_offset))
            wv = WKWebView.alloc().initWithFrame_(rect)
            
            # load url
            req = NSURLRequest.requestWithURL_(NSURL.URLWithString_("https://dartcounter.net"))
            wv.loadRequest_(req)
            
            # Add to main window over Kivy
            window = UIApplication.sharedApplication().keyWindow
            window.addSubview_(wv)
            
            shared.active_browser = shared.IOSBrowser(wv)
            self._ios_wv = wv
            
            # Reveal close button
            self.close_btn.opacity = 1
            self.close_btn.disabled = False
            
            # TODO: Start iOS Vosk background service here using AVAudioEngine
            
        except ImportError:
            print("pyobjus not available. Are you running on iOS?")
        except Exception as e:
            print(f"Failed to launch WKWebView: {e}")

    def _close_smart_browser(self, *args):
        """Removes the WKWebView from the screen"""
        wv = getattr(self, '_ios_wv', None)
        if wv:
            try:
                wv.removeFromSuperview()
                self._ios_wv = None
                shared.active_browser = None
                
                # Hide close button
                self.close_btn.opacity = 0
                self.close_btn.disabled = True
            except Exception as e:
                print(f"Error closing WKWebView: {e}")

    # ── Vosk iOS Integration Stub ─────────────────────────────────────────────
    def _on_score(self, data):
        """
        Callback fired by iOS AVAudioEngine background listener 
        when Vosk decodes a score.
        """
        if shared.active_browser is not None and isinstance(data, int):
            shared.active_browser.score(data)
            print(f"Sent {data} to IOSBrowser")

if __name__ == '__main__':
    DartVoiceIOSApp().run()
