import os
from kivy.app import App
from kivy.utils import platform

class DartVoiceWebApp(App):
    def build(self):
        if platform == 'android':
            from jnius import autoclass
            from android.runnable import run_on_ui_thread
            
            Activity = autoclass('org.kivy.android.PythonActivity').mActivity
            WebView = autoclass('android.webkit.WebView')
            WebChromeClient = autoclass('com.dartvoice.DartvoiceWebChromeClient')
            WebViewClient = autoclass('android.webkit.WebViewClient')
            
            @run_on_ui_thread
            def create_webview():
                webview = WebView(Activity)
                settings = webview.getSettings()
                
                # Enable WebRTC and JavaScript features
                settings.setJavaScriptEnabled(True)
                settings.setDomStorageEnabled(True)
                settings.setMediaPlaybackRequiresUserGesture(False)
                settings.setAllowFileAccessFromFileURLs(True)
                settings.setAllowUniversalAccessFromFileURLs(True)
                
                # Set custom clients
                webview.setWebChromeClient(WebChromeClient())
                
                # External links handled in Java override
                CustomWebViewClient = autoclass('com.dartvoice.DartvoiceWebViewClient')
                webview.setWebViewClient(CustomWebViewClient())
                
                # Attach to Android Activity
                Activity.setContentView(webview)
                
                # Load the DartVoice application
                webview.loadUrl('https://dartvoice.app/web-app.html')

            create_webview()

        from kivy.uix.widget import Widget
        return Widget()

if __name__ == '__main__':
    if platform == 'android':
        from android.permissions import request_permissions, Permission
        def perm_callback(permissions, results):
            pass
        request_permissions([Permission.RECORD_AUDIO], perm_callback)
        
    DartVoiceWebApp().run()
